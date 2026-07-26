alter table public.items drop column if exists verification_status;
drop type if exists public.verification_status;
