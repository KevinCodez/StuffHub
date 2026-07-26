-- Provenance must not prevent a user from deleting their account. Memberships
-- still cascade, while inventory shared with other home members remains intact.
alter table public.homes alter column created_by drop not null;
alter table public.homes drop constraint homes_created_by_fkey;
alter table public.homes add constraint homes_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.rooms alter column created_by drop not null;
alter table public.rooms drop constraint rooms_created_by_fkey;
alter table public.rooms add constraint rooms_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.items alter column created_by drop not null;
alter table public.items drop constraint items_created_by_fkey;
alter table public.items add constraint items_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.containers alter column created_by drop not null;
alter table public.containers drop constraint containers_created_by_fkey;
alter table public.containers add constraint containers_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.media_assets alter column created_by drop not null;
alter table public.media_assets drop constraint media_assets_created_by_fkey;
alter table public.media_assets add constraint media_assets_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.receipts alter column created_by drop not null;
alter table public.receipts drop constraint receipts_created_by_fkey;
alter table public.receipts add constraint receipts_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.warranties alter column created_by drop not null;
alter table public.warranties drop constraint warranties_created_by_fkey;
alter table public.warranties add constraint warranties_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.maintenance_reminders alter column created_by drop not null;
alter table public.maintenance_reminders drop constraint maintenance_reminders_created_by_fkey;
alter table public.maintenance_reminders add constraint maintenance_reminders_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.processing_jobs alter column created_by drop not null;
alter table public.processing_jobs drop constraint processing_jobs_created_by_fkey;
alter table public.processing_jobs add constraint processing_jobs_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.report_exports alter column created_by drop not null;
alter table public.report_exports drop constraint report_exports_created_by_fkey;
alter table public.report_exports add constraint report_exports_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.invitations alter column invited_by drop not null;
alter table public.invitations drop constraint invitations_invited_by_fkey;
alter table public.invitations add constraint invitations_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;

alter table public.qr_codes alter column created_by drop not null;
alter table public.qr_codes drop constraint qr_codes_created_by_fkey;
alter table public.qr_codes add constraint qr_codes_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
