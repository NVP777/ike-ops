-- Record who each announcement's push reached. Safe to re-run, in the Supabase SQL editor.
create table if not exists public.notification_recipients (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  email text not null,
  status text not null check (status in ('delivered', 'failed', 'not_enabled')),
  primary key (notification_id, email)
);
alter table public.notification_recipients enable row level security;
drop policy if exists "captain reads delivery" on public.notification_recipients;
create policy "captain reads delivery" on public.notification_recipients for select to authenticated
  using ((select public.is_captain()));
-- Writes happen only from the server (service role), so there is no insert/update policy.

-- Deleting an announcement must also remove people's "read" marks, or the delete is refused.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notif_reads'::regclass and contype = 'f' and confrelid = 'public.notifications'::regclass
  loop
    execute format('alter table public.notif_reads drop constraint %I', c.conname);
  end loop;
  alter table public.notif_reads add constraint notif_reads_notification_id_fkey
    foreign key (notification_id) references public.notifications(id) on delete cascade;
end $$;

notify pgrst, 'reload schema';
