# StuffHub database

The local database, authentication service, Storage API, and Studio are managed by the pinned Supabase CLI.

```bash
pnpm db:start
pnpm db:reset
pnpm db:types
pnpm db:status
pnpm db:stop
```

Local endpoints and development keys are printed by `pnpm db:status`. Supabase Studio is normally available at <http://127.0.0.1:54323> and captured development email at <http://127.0.0.1:54324>.

Migrations are the source of truth. Do not make schema-only changes in Studio without capturing them in a migration. Run `pnpm db:reset` before committing a migration to verify that the database can be rebuilt from scratch.

The seed script intentionally does not create a known-password account. Sign up through Auth first; subsequent resets seed representative inventory for the earliest local user if one exists. Application tests should create their own isolated users and homes.

## Storage paths

All buckets are private. Every object key must begin with the owning home UUID:

```text
inventory/{home_id}/rooms/{room_id}/{file_id}.jpg
inventory/{home_id}/items/{item_id}/{file_id}.jpg
receipts/{home_id}/{receipt_id}/original/{page}.jpg
documents/{home_id}/warranties/{warranty_id}/{file_id}.pdf
reports/{home_id}/{report_id}.pdf
```

Row-level security uses that first path segment to authorize access through `home_members`.
