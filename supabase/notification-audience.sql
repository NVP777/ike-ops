-- Allow announcements to be sent to ExComm and Alumni. Safe to re-run, in the Supabase SQL editor.
alter table public.notifications drop constraint if exists notifications_audience_check;
alter table public.notifications add constraint notifications_audience_check
  check (audience in ('Everyone', 'ExComm', 'Alumni', 'Management', 'Tech'));
notify pgrst, 'reload schema';
