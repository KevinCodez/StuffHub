# StuffHub self-hosting

StuffHub ships as one standalone Compose file. It starts the web application and
API together with PostgreSQL, Auth, PostgREST, private Storage, image processing,
and one-shot database migrations.

## Requirements

- Docker Engine 24+ with Docker Compose v2.23.1 or newer
- 4 GB RAM minimum; 8 GB recommended
- 40 GB of available SSD storage

## Install

Download the Compose file from the latest GitHub release and start it:

```bash
curl -fsSLO https://github.com/KevinCodez/StuffHub/releases/latest/download/compose.yaml
docker compose up -d --wait
```

Open <http://localhost:3000>. On its first run, the `bootstrap` container creates
a unique database password, JWT secret, and Supabase API keys. They are stored
in the `stuffhub_secrets-data` Docker volume and reused on every subsequent run.
No `.env` file or host-side script is required.

As a safety measure, bootstrap refuses to create replacement secrets when the
secrets volume is empty but an existing PostgreSQL database is present. Restore
`stuffhub_secrets-data` from backup if this guard is triggered; generating new
credentials would make the application unable to authenticate to that database.

## Reverse proxy and public URLs

The default configuration publishes the web app on port 3000 and the Supabase
gateway on port 8000. For Internet access, send two HTTPS hostnames through your
reverse proxy:

- `inventory.example.com` to port 3000
- `inventory-api.example.com` to port 8000

Provide the matching public URLs when starting the stack:

```bash
APP_URL=https://inventory.example.com \
SUPABASE_PUBLIC_URL=https://inventory-api.example.com \
COOKIE_SECURE=true \
docker compose up -d --wait
```

Docker Compose also reads these values from an optional `.env` file if keeping
server-specific settings there is more convenient. The installation does not
require one for local or LAN use.

## Email and password recovery

New accounts are confirmed immediately by default, so SMTP is not needed for a
basic home-server installation. Password-reset emails require SMTP. Configure
it with Compose environment variables (or an optional `.env`) and disable
automatic confirmation:

```dotenv
ENABLE_EMAIL_AUTOCONFIRM=false
SMTP_ADMIN_EMAIL=stuffhub@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=stuffhub
SMTP_PASS=replace-me
SMTP_SENDER_NAME=StuffHub
```

Restart the stack with `docker compose up -d --wait` after changing settings.

## Update and version pinning

Back up the installation and read the release notes, then pull and recreate:

```bash
docker compose pull
docker compose up -d --wait
```

The default `latest` tag follows the newest release. To pin or roll back all
StuffHub images together, set a release version for the command:

```bash
STUFFHUB_VERSION=1.0.0 docker compose up -d --wait
```

The `migrate` service applies only new migrations and rejects a migration whose
contents changed after it was applied.

## Persistent data and backups

`docker compose down` preserves all installation data. Four named volumes are
used:

- `stuffhub_database-data` — PostgreSQL data
- `stuffhub_database-config` — generated PostgreSQL configuration
- `stuffhub_storage-data` — uploaded photographs and documents
- `stuffhub_secrets-data` — database and JWT credentials

Create a database dump:

```bash
docker compose exec -T db pg_dump -U postgres -d postgres -Fc > stuffhub-db.dump
```

Back up uploaded files and installation secrets:

```bash
docker run --rm -v stuffhub_storage-data:/source:ro -v "$PWD":/backup alpine \
  tar -czf /backup/stuffhub-storage.tar.gz -C /source .
docker run --rm -v stuffhub_secrets-data:/source:ro -v "$PWD":/backup alpine \
  tar -czf /backup/stuffhub-secrets.tar.gz -C /source .
```

Keep the secrets archive encrypted. Losing it does not delete inventory data,
but restoring the same secrets preserves database credentials and active login
sessions.

Never run `docker compose down --volumes` unless permanently deleting the whole
installation is intentional.

## Local image testing

Build the four images from the repository and give them a shared local prefix:

```bash
docker build -t stuffhub:local .
docker build -f deploy/Dockerfile.db -t stuffhub-db:local .
docker build -f deploy/Dockerfile.gateway -t stuffhub-gateway:local .
docker build -f deploy/Dockerfile.migrate -t stuffhub-migrate:local .
STUFFHUB_IMAGE_ROOT=stuffhub STUFFHUB_VERSION=local docker compose -f deploy/compose.yaml up -d --wait
```

## Operations

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f migrate
docker compose stop
docker compose down
```
