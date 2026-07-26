# StuffHub self-hosting

This bundle starts the StuffHub web application and API together with its
PostgreSQL, Auth, PostgREST, and private Storage services.

## Requirements

- Docker Engine 24+ with Docker Compose v2
- 4 GB RAM minimum; 8 GB recommended
- 40 GB of available SSD storage

## Install

Download and unpack the self-host archive attached to a StuffHub GitHub
release, then run:

```bash
cd stuffhub
./generate-env.sh
docker compose up -d --wait
```

Open <http://localhost:3000>. The generated `.env` uses unique database and JWT
secrets and enables immediate email/password registration.

To use a locally built image from a source checkout:

```bash
docker build -t stuffhub:local ..
./generate-env.sh
sed -i.bak 's|^STUFFHUB_IMAGE=.*|STUFFHUB_IMAGE=stuffhub:local|' .env
docker compose up -d --wait
```

## Internet-facing configuration

Before exposing StuffHub outside a trusted network:

1. Put ports 3000 and 8000 behind a TLS reverse proxy.
2. Set `APP_URL` to the public web origin.
3. Set `SUPABASE_PUBLIC_URL` to the public Supabase gateway origin.
4. Set `COOKIE_SECURE=true`.
5. Configure SMTP, set `ENABLE_EMAIL_AUTOCONFIRM=false`, and verify recovery
   email delivery.
6. Restrict direct access to PostgreSQL. This Compose file does not publish the
   database port.

Example:

```dotenv
APP_URL=https://inventory.example.com
SUPABASE_PUBLIC_URL=https://inventory-api.example.com
COOKIE_SECURE=true
ENABLE_EMAIL_AUTOCONFIRM=false
SMTP_ADMIN_EMAIL=stuffhub@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=stuffhub
SMTP_PASS=replace-me
SMTP_SENDER_NAME=StuffHub
```

The reverse proxy must send the StuffHub hostname to port 3000 and the
Supabase hostname to port 8000.

## Update

Read the release notes and back up the installation first. Then change
`STUFFHUB_IMAGE` to the desired immutable version and run:

```bash
docker compose pull
docker compose up -d --wait
```

The one-shot `migrate` service applies only new migrations. An already-applied
migration whose contents changed is rejected.

Using `latest` is supported, but versioned tags make rollback and incident
diagnosis safer:

```dotenv
STUFFHUB_IMAGE=ghcr.io/OWNER/REPOSITORY:1.1.0
```

## Back up

Create a database dump:

```bash
docker compose exec -T db pg_dump -U postgres -d postgres -Fc > stuffhub-db.dump
```

Back up private media:

```bash
docker run --rm \
  -v stuffhub_storage-data:/source:ro \
  -v "$PWD":/backup \
  alpine tar -czf /backup/stuffhub-storage.tar.gz -C /source .
```

The volume name begins with the Compose project name. Confirm it with
`docker volume ls` if `stuffhub_storage-data` is not present.

Keep the generated `.env` in an encrypted backup. Its JWT secret is required to
validate existing sessions, and its database password is required for recovery.

## Restore

Restore into an empty installation using the same StuffHub release that created
the backup. Start the database, restore the dump, restore media, and then start
the complete stack:

```bash
docker compose up -d db
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists < stuffhub-db.dump
docker run --rm \
  -v stuffhub_storage-data:/target \
  -v "$PWD":/backup:ro \
  alpine tar -xzf /backup/stuffhub-storage.tar.gz -C /target
docker compose up -d --wait
```

Test restores periodically. A backup that has never been restored is not a
verified backup.

## Operations

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f migrate
docker compose stop
docker compose down
```

`docker compose down` preserves data. Do not add `--volumes` unless you intend
to permanently delete the database and stored media.
