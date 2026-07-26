-- Development data is added after signing up through the local app or Studio.
-- This block gives the first local user a representative StuffHub home while
-- remaining safe when no local account exists yet.
do $$
declare
  seed_user_id uuid;
  seed_home_id uuid := '1db035fd-f8b4-4f37-8702-8fab721f5420';
  living_room_id uuid := '9f117ee2-f36c-4b48-bc94-c2e28559d33d';
begin
  select id into seed_user_id from auth.users order by created_at limit 1;
  if seed_user_id is null then
    raise notice 'No auth user exists; skipping optional inventory seed data.';
    return;
  end if;

  insert into public.homes (id, name, created_by)
  values (seed_home_id, 'My Home', seed_user_id)
  on conflict (id) do nothing;
  insert into public.home_members (home_id, user_id, role)
  values (seed_home_id, seed_user_id, 'owner')
  on conflict (home_id, user_id) do nothing;
  insert into public.rooms (id, home_id, name, scan_status, created_by)
  values
    (living_room_id, seed_home_id, 'Living room', 'review_needed', seed_user_id),
    ('84a2b96c-fcac-41e0-a207-60e31ee90939', seed_home_id, 'Kitchen', 'not_started', seed_user_id),
    ('139391cc-f992-402a-b0b6-c88c6f2dafae', seed_home_id, 'Primary bedroom', 'ready', seed_user_id)
  on conflict (id) do nothing;
  insert into public.items (
    id, home_id, room_id, name, category, description,
    estimated_replacement_value_cents, purchase_year, confidence, created_by
  ) values
    ('84d3eeab-47cf-479c-80bc-4dc447ea3fa3', seed_home_id, living_room_id,
      '55-inch television', 'Electronics', 'Flat-screen television on media console',
      64900, null, 0.94, seed_user_id),
    ('8b93e66c-4864-4e9e-92b6-4d8118c65a39', seed_home_id, living_room_id,
      'Sectional sofa', 'Furniture', 'Five-seat upholstered sectional',
      180000, 2022, 0.89, seed_user_id)
  on conflict (id) do nothing;
end $$;
