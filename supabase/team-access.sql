-- Run once in the Supabase SQL editor.
alter table members add column if not exists year text default '';
alter table members add column if not exists page_grants text[] not null default '{}';
alter table members add column if not exists page_blocks text[] not null default '{}';

-- Captains can read and edit every member row.
-- (Adjust if you already have a helper for "is captain"; this one checks the members table.)
create policy "captain reads all members" on members for select
  using (exists (select 1 from members m where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'Captain'));
create policy "captain updates members" on members for update
  using (exists (select 1 from members m where lower(m.email) = lower(auth.jwt() ->> 'email') and m.role = 'Captain'));
-- Note: a policy that selects from its own table can recurse. If Supabase complains, move the check into a
-- security definer function, e.g. create function is_captain() ... and use it in both policies.
alter table members add column if not exists title text default '';

-- Make the API see the new columns right away (fixes 'column not found in the schema cache').
notify pgrst, 'reload schema';
