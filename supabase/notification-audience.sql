-- Allow announcements to be sent to Captains. Safe to re-run, in the Supabase SQL editor.
alter table public.notifications drop constraint if exists notifications_audience_check;
alter table public.notifications add constraint notifications_audience_check
  check (audience in ('Everyone', 'Captain', 'ExComm', 'Management', 'Tech'));
notify pgrst, 'reload schema';
