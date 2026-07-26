-- Store QR identities separately from containers so a physical label can be
-- assigned, unassigned, or moved without needing to print a new QR code.
create type public.qr_code_status as enum ('active', 'disabled', 'retired');

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  token text not null unique
    check (length(token) between 20 and 128)
    check (token ~ '^[A-Za-z0-9_-]+$'),
  container_id uuid references public.containers(id) on delete set null,
  status public.qr_code_status not null default 'active',
  created_by uuid not null default auth.uid() references auth.users(id),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_assignment_metadata_check check (
    container_id is null or assigned_at is not null
  ),
  unique (home_id, id)
);

create index qr_codes_home_id_idx on public.qr_codes(home_id);
create index qr_codes_container_id_idx on public.qr_codes(container_id)
  where container_id is not null;

-- The composite key prevents associating a label with a container in another
-- home. Only container_id is cleared when the container is deleted.
alter table public.qr_codes add constraint qr_codes_home_container_fkey
  foreign key (home_id, container_id)
  references public.containers(home_id, id)
  on delete set null (container_id);

create trigger qr_codes_set_updated_at
before update on public.qr_codes
for each row execute function public.set_updated_at();

alter table public.qr_codes enable row level security;

create policy qr_codes_select on public.qr_codes
for select using (public.is_home_member(home_id));

create policy qr_codes_insert on public.qr_codes
for insert with check (
  public.has_home_role(home_id, array['owner', 'editor']::public.home_role[])
);

create policy qr_codes_update on public.qr_codes
for update using (
  public.has_home_role(home_id, array['owner', 'editor']::public.home_role[])
) with check (
  public.has_home_role(home_id, array['owner', 'editor']::public.home_role[])
);

create policy qr_codes_delete on public.qr_codes
for delete using (
  public.has_home_role(home_id, array['owner', 'editor']::public.home_role[])
);

grant select, insert, update, delete on table public.qr_codes to authenticated;
