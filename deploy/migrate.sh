#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists stuffhub_migrations;
create table if not exists stuffhub_migrations.schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
SQL

for migration in /migrations/*.sql; do
  [ -f "$migration" ] || continue
  version="$(basename "$migration" .sql)"
  checksum="$(sha256sum "$migration" | awk '{print $1}')"
  case "$version" in
    *[!0-9A-Za-z_-]*)
      echo "Unsafe migration filename: $version" >&2
      exit 1
      ;;
  esac
  applied_checksum="$(psql -v ON_ERROR_STOP=1 -At \
    -c "select checksum from stuffhub_migrations.schema_migrations where version = '$version'")"

  if [ -n "$applied_checksum" ]; then
    if [ "$applied_checksum" != "$checksum" ]; then
      echo "Migration $version was changed after it was applied." >&2
      exit 1
    fi
    echo "Already applied: $version"
    continue
  fi

  echo "Applying: $version"
  psql -v ON_ERROR_STOP=1 --single-transaction \
    -f "$migration" \
    -c "insert into stuffhub_migrations.schema_migrations(version, checksum) values ('$version', '$checksum')"
done

# PostgREST may become healthy before the application migrations finish.
# Refresh its cache so newly created tables and RPC functions are immediately
# available to the first web request.
psql -v ON_ERROR_STOP=1 -c "notify pgrst, 'reload schema'"
