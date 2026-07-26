-- Account deletion cascades home membership. Remove a home when its final
-- member disappears, while preserving homes that are still shared.
create function public.delete_memberless_home()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.home_members where home_id = old.home_id) then
    delete from public.homes where id = old.home_id;
  end if;
  return old;
end;
$$;

create trigger home_members_delete_empty_home
after delete on public.home_members
for each row execute function public.delete_memberless_home();
