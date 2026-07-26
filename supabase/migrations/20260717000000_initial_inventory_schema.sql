-- StuffHub's initial relational model. Every inventory record is scoped to a home.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.home_role as enum ('owner', 'editor', 'viewer');
create type public.scan_status as enum ('not_started', 'ready', 'review_needed');
create type public.verification_status as enum ('suggested', 'verified');
create type public.media_kind as enum ('original', 'cropped', 'thumbnail', 'document', 'report');
create type public.processing_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.reminder_frequency as enum ('one_time', 'monthly', 'quarterly', 'semiannual', 'annual');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.homes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.home_members (
  home_id uuid not null references public.homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.home_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (home_id, user_id)
);
create index home_members_user_id_idx on public.home_members(user_id);

create function public.is_home_member(target_home_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.home_members
    where home_id = target_home_id and user_id = auth.uid()
  );
$$;

create function public.has_home_role(target_home_id uuid, allowed_roles public.home_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.home_members
    where home_id = target_home_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create function public.create_home(home_name text, currency text default 'USD')
returns public.homes
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_home public.homes;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(home_name)) = 0 then
    raise exception 'Home name is required';
  end if;

  insert into public.homes (name, currency_code, created_by)
  values (trim(home_name), upper(currency), auth.uid())
  returning * into new_home;

  insert into public.home_members (home_id, user_id, role)
  values (new_home.id, auth.uid(), 'owner');

  return new_home;
end;
$$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  scan_status public.scan_status not null default 'not_started',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_home_id_idx on public.rooms(home_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'Other',
  description text not null default '',
  estimated_replacement_value_cents bigint not null default 0 check (estimated_replacement_value_cents >= 0),
  purchase_year integer check (purchase_year between 1900 and 2200),
  serial_number text,
  model_number text,
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  verification_status public.verification_status not null default 'verified',
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(serial_number, '') || ' ' || coalesce(model_number, '')), 'A')
  ) stored,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_home_id_idx on public.items(home_id);
create index items_room_id_idx on public.items(room_id);
create index items_search_idx on public.items using gin(search_document);
create index items_name_trgm_idx on public.items using gin(name extensions.gin_trgm_ops);

create table public.containers (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  label_payload text,
  label_created_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index containers_home_id_idx on public.containers(home_id);

create table public.container_items (
  home_id uuid not null references public.homes(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (container_id, item_id)
);
create index container_items_home_id_idx on public.container_items(home_id);
create unique index one_container_per_item_idx on public.container_items(item_id);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  kind public.media_kind not null default 'original',
  mime_type text not null,
  byte_size bigint check (byte_size >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  sha256 text,
  original_filename text,
  captured_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);
create index media_assets_home_id_idx on public.media_assets(home_id);

create table public.room_media (
  home_id uuid not null references public.homes(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (room_id, media_id)
);
create index room_media_home_id_idx on public.room_media(home_id);

create table public.item_media (
  home_id uuid not null references public.homes(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (item_id, media_id)
);
create index item_media_home_id_idx on public.item_media(home_id);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  merchant text not null default '',
  purchase_date date,
  total_cents bigint not null default 0 check (total_cents >= 0),
  description text not null default '',
  verified_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index receipts_home_id_idx on public.receipts(home_id);
create index receipts_merchant_trgm_idx on public.receipts using gin(merchant extensions.gin_trgm_ops);

create table public.receipt_pages (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  original_media_id uuid not null references public.media_assets(id),
  processed_media_id uuid references public.media_assets(id),
  page_number integer not null check (page_number > 0),
  crop_corners jsonb,
  created_at timestamptz not null default now(),
  unique (receipt_id, page_number)
);
create index receipt_pages_home_id_idx on public.receipt_pages(home_id);

create table public.receipt_items (
  home_id uuid not null references public.homes(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (receipt_id, item_id)
);
create index receipt_items_home_id_idx on public.receipt_items(home_id);

create table public.receipt_ocr_results (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  page_id uuid references public.receipt_pages(id) on delete cascade,
  engine text not null,
  engine_version text,
  raw_text text not null default '',
  structured_data jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);
create index receipt_ocr_results_home_id_idx on public.receipt_ocr_results(home_id);
create index receipt_ocr_search_idx on public.receipt_ocr_results using gin(to_tsvector('english', raw_text));

create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  provider text not null check (length(trim(provider)) > 0),
  policy_number text not null default '',
  purchase_date date,
  duration_months integer not null default 0 check (duration_months >= 0),
  description text not null default '',
  claim_contact text not null default '',
  receipt_id uuid references public.receipts(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index warranties_home_id_idx on public.warranties(home_id);

create table public.warranty_items (
  home_id uuid not null references public.homes(id) on delete cascade,
  warranty_id uuid not null references public.warranties(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  primary key (warranty_id, item_id)
);
create index warranty_items_home_id_idx on public.warranty_items(home_id);

create table public.warranty_media (
  home_id uuid not null references public.homes(id) on delete cascade,
  warranty_id uuid not null references public.warranties(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  primary key (warranty_id, media_id)
);
create index warranty_media_home_id_idx on public.warranty_media(home_id);

create table public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  start_date date not null,
  frequency public.reminder_frequency not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_reminders_home_id_idx on public.maintenance_reminders(home_id);

create table public.maintenance_items (
  home_id uuid not null references public.homes(id) on delete cascade,
  reminder_id uuid not null references public.maintenance_reminders(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  primary key (reminder_id, item_id)
);
create index maintenance_items_home_id_idx on public.maintenance_items(home_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  email text not null,
  role public.home_role not null default 'viewer' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid not null default auth.uid() references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index invitations_home_id_idx on public.invitations(home_id);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  job_type text not null,
  entity_id uuid,
  status public.processing_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index processing_jobs_pending_idx on public.processing_jobs(status, available_at);
create index processing_jobs_home_id_idx on public.processing_jobs(home_id);

create table public.report_exports (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  status public.processing_status not null default 'pending',
  media_id uuid references public.media_assets(id) on delete set null,
  options jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index report_exports_home_id_idx on public.report_exports(home_id);

-- Composite keys prevent a client from linking records that belong to different homes.
alter table public.rooms add constraint rooms_home_id_id_key unique (home_id, id);
alter table public.items add constraint items_home_id_id_key unique (home_id, id);
alter table public.containers add constraint containers_home_id_id_key unique (home_id, id);
alter table public.media_assets add constraint media_assets_home_id_id_key unique (home_id, id);
alter table public.receipts add constraint receipts_home_id_id_key unique (home_id, id);
alter table public.receipt_pages add constraint receipt_pages_home_id_id_key unique (home_id, id);
alter table public.warranties add constraint warranties_home_id_id_key unique (home_id, id);
alter table public.maintenance_reminders add constraint maintenance_reminders_home_id_id_key unique (home_id, id);

alter table public.items add constraint items_home_room_fkey
  foreign key (home_id, room_id) references public.rooms(home_id, id) on delete cascade;
alter table public.containers add constraint containers_home_room_fkey
  foreign key (home_id, room_id) references public.rooms(home_id, id) on delete cascade;
alter table public.container_items add constraint container_items_home_container_fkey
  foreign key (home_id, container_id) references public.containers(home_id, id) on delete cascade;
alter table public.container_items add constraint container_items_home_item_fkey
  foreign key (home_id, item_id) references public.items(home_id, id) on delete cascade;
alter table public.room_media add constraint room_media_home_room_fkey
  foreign key (home_id, room_id) references public.rooms(home_id, id) on delete cascade;
alter table public.room_media add constraint room_media_home_media_fkey
  foreign key (home_id, media_id) references public.media_assets(home_id, id) on delete cascade;
alter table public.item_media add constraint item_media_home_item_fkey
  foreign key (home_id, item_id) references public.items(home_id, id) on delete cascade;
alter table public.item_media add constraint item_media_home_media_fkey
  foreign key (home_id, media_id) references public.media_assets(home_id, id) on delete cascade;
alter table public.receipt_pages add constraint receipt_pages_home_receipt_fkey
  foreign key (home_id, receipt_id) references public.receipts(home_id, id) on delete cascade;
alter table public.receipt_pages add constraint receipt_pages_home_original_media_fkey
  foreign key (home_id, original_media_id) references public.media_assets(home_id, id);
alter table public.receipt_pages add constraint receipt_pages_home_processed_media_fkey
  foreign key (home_id, processed_media_id) references public.media_assets(home_id, id);
alter table public.receipt_items add constraint receipt_items_home_receipt_fkey
  foreign key (home_id, receipt_id) references public.receipts(home_id, id) on delete cascade;
alter table public.receipt_items add constraint receipt_items_home_item_fkey
  foreign key (home_id, item_id) references public.items(home_id, id) on delete cascade;
alter table public.receipt_ocr_results add constraint receipt_ocr_home_receipt_fkey
  foreign key (home_id, receipt_id) references public.receipts(home_id, id) on delete cascade;
alter table public.receipt_ocr_results add constraint receipt_ocr_home_page_fkey
  foreign key (home_id, page_id) references public.receipt_pages(home_id, id) on delete cascade;
alter table public.warranties add constraint warranties_home_receipt_fkey
  foreign key (home_id, receipt_id) references public.receipts(home_id, id) on delete set null (receipt_id);
alter table public.warranty_items add constraint warranty_items_home_warranty_fkey
  foreign key (home_id, warranty_id) references public.warranties(home_id, id) on delete cascade;
alter table public.warranty_items add constraint warranty_items_home_item_fkey
  foreign key (home_id, item_id) references public.items(home_id, id) on delete cascade;
alter table public.warranty_media add constraint warranty_media_home_warranty_fkey
  foreign key (home_id, warranty_id) references public.warranties(home_id, id) on delete cascade;
alter table public.warranty_media add constraint warranty_media_home_media_fkey
  foreign key (home_id, media_id) references public.media_assets(home_id, id) on delete cascade;
alter table public.maintenance_items add constraint maintenance_items_home_reminder_fkey
  foreign key (home_id, reminder_id) references public.maintenance_reminders(home_id, id) on delete cascade;
alter table public.maintenance_items add constraint maintenance_items_home_item_fkey
  foreign key (home_id, item_id) references public.items(home_id, id) on delete cascade;
alter table public.report_exports add constraint report_exports_home_media_fkey
  foreign key (home_id, media_id) references public.media_assets(home_id, id) on delete set null (media_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.ensure_same_home()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_home_id uuid;
begin
  if tg_table_name = 'items' then
    select home_id into parent_home_id from public.rooms where id = new.room_id;
  elsif tg_table_name = 'containers' then
    select home_id into parent_home_id from public.rooms where id = new.room_id;
  end if;
  if parent_home_id is distinct from new.home_id then
    raise exception 'Related records must belong to the same home';
  end if;
  return new;
end;
$$;

create trigger items_same_home before insert or update on public.items
for each row execute function public.ensure_same_home();
create trigger containers_same_home before insert or update on public.containers
for each row execute function public.ensure_same_home();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'homes', 'rooms', 'items', 'containers', 'receipts',
    'warranties', 'maintenance_reminders', 'processing_jobs', 'report_exports'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

-- Return a single ranked result set for the global search screen.
create function public.search_inventory(target_home_id uuid, search_query text)
returns table(record_type text, record_id uuid, title text, subtitle text, rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  select results.record_type, results.record_id, results.title, results.subtitle, results.rank
  from (
    select 'item'::text as record_type, i.id as record_id, i.name as title,
           concat_ws(' · ', i.category, i.model_number, i.serial_number) as subtitle,
           ts_rank(i.search_document, websearch_to_tsquery('english', search_query)) as rank
    from public.items i
    where i.home_id = target_home_id
      and (i.search_document @@ websearch_to_tsquery('english', search_query)
        or i.name operator(extensions.%) search_query)
    union all
    select 'receipt'::text, r.id, coalesce(nullif(r.merchant, ''), 'Receipt'),
           concat_ws(' · ', r.purchase_date::text, (r.total_cents::numeric / 100)::text),
           greatest(extensions.similarity(r.merchant, search_query), 0.1)::real
    from public.receipts r
    where r.home_id = target_home_id
      and (r.merchant operator(extensions.%) search_query or exists (
        select 1 from public.receipt_ocr_results o
        where o.receipt_id = r.id
          and to_tsvector('english', o.raw_text) @@ websearch_to_tsquery('english', search_query)
      ))
  ) as results
  order by results.rank desc, results.title;
$$;

-- RLS is the security boundary for both web and mobile clients.
alter table public.profiles enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;

create policy profiles_select_self on public.profiles for select using (id = auth.uid());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy homes_select_member on public.homes for select using (public.is_home_member(id));
create policy homes_update_owner on public.homes for update using (public.has_home_role(id, array['owner']::public.home_role[]));
create policy homes_delete_owner on public.homes for delete using (public.has_home_role(id, array['owner']::public.home_role[]));
create policy members_select_member on public.home_members for select using (public.is_home_member(home_id));
create policy members_insert_owner on public.home_members for insert with check (public.has_home_role(home_id, array['owner']::public.home_role[]));
create policy members_update_owner on public.home_members for update using (public.has_home_role(home_id, array['owner']::public.home_role[]));
create policy members_delete_owner on public.home_members for delete using (public.has_home_role(home_id, array['owner']::public.home_role[]));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'rooms', 'items', 'containers', 'container_items', 'media_assets', 'room_media',
    'item_media', 'receipts', 'receipt_pages', 'receipt_items', 'receipt_ocr_results',
    'warranties', 'warranty_items', 'warranty_media', 'maintenance_reminders',
    'maintenance_items', 'invitations', 'processing_jobs', 'report_exports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I_select on public.%I for select using (public.is_home_member(home_id))', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert with check (public.has_home_role(home_id, array[''owner'', ''editor'']::public.home_role[]))', table_name, table_name);
    execute format('create policy %I_update on public.%I for update using (public.has_home_role(home_id, array[''owner'', ''editor'']::public.home_role[])) with check (public.has_home_role(home_id, array[''owner'', ''editor'']::public.home_role[]))', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete using (public.has_home_role(home_id, array[''owner'', ''editor'']::public.home_role[]))', table_name, table_name);
  end loop;
end $$;

-- Keep user evidence private. The first path segment must be the home UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('inventory', 'inventory', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('receipts', 'receipts', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('documents', 'documents', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png']),
  ('reports', 'reports', false, 104857600, array['application/pdf'])
on conflict (id) do nothing;

create policy storage_select_home_member on storage.objects for select to authenticated
using (
  bucket_id in ('inventory', 'receipts', 'documents', 'reports')
  and exists (
    select 1 from public.home_members hm
    where hm.user_id = auth.uid() and hm.home_id::text = (storage.foldername(name))[1]
  )
);
create policy storage_insert_home_editor on storage.objects for insert to authenticated
with check (
  bucket_id in ('inventory', 'receipts', 'documents', 'reports')
  and exists (
    select 1 from public.home_members hm
    where hm.user_id = auth.uid() and hm.role in ('owner', 'editor')
      and hm.home_id::text = (storage.foldername(name))[1]
  )
);
create policy storage_update_home_editor on storage.objects for update to authenticated
using (
  exists (
    select 1 from public.home_members hm
    where hm.user_id = auth.uid() and hm.role in ('owner', 'editor')
      and hm.home_id::text = (storage.foldername(name))[1]
  )
);
create policy storage_delete_home_editor on storage.objects for delete to authenticated
using (
  exists (
    select 1 from public.home_members hm
    where hm.user_id = auth.uid() and hm.role in ('owner', 'editor')
      and hm.home_id::text = (storage.foldername(name))[1]
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.create_home(text, text) to authenticated;
grant execute on function public.search_inventory(uuid, text) to authenticated;
revoke all on function public.is_home_member(uuid) from public;
revoke all on function public.has_home_role(uuid, public.home_role[]) from public;
grant execute on function public.is_home_member(uuid) to authenticated;
grant execute on function public.has_home_role(uuid, public.home_role[]) to authenticated;
