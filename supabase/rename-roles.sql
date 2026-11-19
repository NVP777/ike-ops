-- Role rename: Captain becomes ExComm, and the old ExComm becomes Alumni.
-- Run this ONCE, in the Supabase SQL editor, right before the new version of the app goes live.
-- It runs as one step: if anything fails, nothing changes. Do not run it twice (the second run would turn the new ExComm into Alumni).

begin;

-- 1. The old "which roles are allowed" rule on members has to go first, or the update below is refused.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.members'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.members drop constraint %I', c.conname);
  end loop;
end $$;

-- 2. Rename the roles. One statement, so nobody is renamed twice.
update public.members
set role = case role when 'ExComm' then 'Alumni' when 'Captain' then 'ExComm' end
where role in ('ExComm', 'Captain');

alter table public.members add constraint members_role_check check (role in ('ExComm', 'Alumni', 'Management', 'Tech'));

-- 3. Everything in the database that asks "is this person the captain?" now means ExComm.
create or replace function public.is_captain()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower((select auth.jwt() ->> 'email')) and m.role = 'ExComm'
  );
$$;
revoke all on function public.is_captain() from public, anon;
grant execute on function public.is_captain() to authenticated;

-- 4. Announcements remember who they were sent to.
alter table public.notifications drop constraint if exists notifications_audience_check;
update public.notifications
set audience = case audience when 'ExComm' then 'Alumni' when 'Captain' then 'ExComm' end
where audience in ('ExComm', 'Captain');
alter table public.notifications add constraint notifications_audience_check
  check (audience in ('Everyone', 'ExComm', 'Alumni', 'Management', 'Tech'));

commit;
notify pgrst, 'reload schema';

-- Afterwards, run this to check nothing else in the database still mentions the old name. It should return no rows.
-- select schemaname, tablename, policyname from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ilike '%captain%';
