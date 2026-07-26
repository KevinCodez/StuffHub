# StuffHub

StuffHub is an open-source, self-hostable home inventory application. Photograph a room, review detected items, attach evidence, and export an insurance-ready record.

## Workspace

- `apps/web` — Next.js web dashboard
- `apps/mobile` — Expo and React Native capture app
- `packages/domain` — shared inventory types, validation, and sample data

## Local development

Requirements: Node.js 22+ and pnpm 11.9+.

```bash
pnpm install
pnpm dev:web
```

In another terminal, run the mobile app:

```bash
pnpm dev:mobile
```

## Local backend

Docker Desktop is required for the local Supabase database, authentication, and private object storage services.

```bash
pnpm db:start
pnpm db:reset
pnpm db:types
```

Copy `.env.example` to `apps/web/.env.local`, then fill `SUPABASE_URL` and
`SUPABASE_ANON_KEY` from `pnpm db:status`. These variables are server-only.
Neither frontend contains a Supabase client or receives database credentials:

```text
Next.js / Expo -> StuffHub /api -> Supabase Auth, PostgreSQL, and Storage
```

For Expo on a physical device, set `EXPO_PUBLIC_STUFFHUB_API_URL` to the LAN URL
of the Next.js server. Mobile access and refresh tokens are stored with Expo
SecureStore; browser tokens are held in HTTP-only cookies.

Supabase Studio is available at <http://127.0.0.1:54323>. See [`supabase/README.md`](supabase/README.md) for schema and storage conventions.

## Self-hosted web deployment

StuffHub v1 is distributed as a standalone Docker Compose file. It starts the
web application, API, PostgreSQL, authentication, PostgREST, private object
storage, image processing, and database migrations. Unique installation secrets
are created automatically and kept in a persistent Docker volume.

```bash
curl -fsSLO https://github.com/KevinCodez/StuffHub/releases/latest/download/compose.yaml
docker compose up -d --wait
```

Open <http://localhost:3000>. No repository checkout, `.env` file, or setup
script is required. Updating is equally direct:

```bash
docker compose pull
docker compose up -d --wait
```

See [`deploy/README.md`](deploy/README.md) for HTTPS, SMTP, backups, restores,
version pinning, and local-image testing. Multi-architecture container releases
are published to GitHub Container Registry when a `v*` Git tag is pushed.

## Architecture direction

The web and mobile frontends use the StuffHub HTTP API. Only server-side
repository code accesses Supabase. The normalized PostgreSQL schema, Auth
foundation, row-level security policies, and private Storage buckets live in
`supabase/`.

## License

StuffHub is licensed under the [GNU Affero General Public License v3.0](LICENSE)
(`AGPL-3.0-only`).
If you modify StuffHub and make that version available to users over a network,
you must also offer those users the corresponding source code under the AGPL.
