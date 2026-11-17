-- READ-ONLY. Run in the Supabase SQL editor and look at the results.
-- Goal: find any policy that lets "any logged-in user" in, instead of "a user who is in members".

-- 1) Every RLS policy. Red flags: qual / with_check = 'true', or only mentioning auth.uid() IS NOT NULL / auth.role().
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;

-- 2) Tables with RLS switched OFF (these are open to everyone with the anon key).
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 3) Source of submit_score and the other functions (check score bounds, the day, and who can call them).
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;
