alter table public.items add column owner_name text;
alter table public.containers add column owner_name text;

update public.containers
set label_payload = 'stuffhub://container/' || id::text,
    label_created_at = coalesce(label_created_at, now())
where label_payload is null;

comment on column public.items.owner_name is 'Optional display name of the person who owns the item.';
comment on column public.containers.owner_name is 'Optional display name of the person who owns the container.';
