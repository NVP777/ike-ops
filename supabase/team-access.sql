-- Team manager. Safe to run more than once, in the Supabase SQL editor.

alter table public.members add column if not exists year text default '';
alter table public.members add column if not exists title text default '';
alter table public.members add column if not exists page_grants text[] not null default '{}';
alter table public.members add column if not exists page_blocks text[] not null default '{}';

-- Is the signed-in person a captain? (security definer, so policies on members can use it without recursing)
create or replace function public.is_captain()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower((select auth.jwt() ->> 'email')) and m.role = 'Captain'
  );
$$;
revoke all on function public.is_captain() from public, anon;
grant execute on function public.is_captain() to authenticated;

-- Captains can read and edit every member row.
drop policy if exists "captain reads all members" on public.members;
drop policy if exists "captain updates members" on public.members;
create policy "captain reads all members" on public.members for select to authenticated
  using ((select public.is_captain()));
create policy "captain updates members" on public.members for update to authenticated
  using ((select public.is_captain())) with check ((select public.is_captain()));

-- Captains see everyone's Google name.
create or replace function public.team_directory()
returns table(email text, full_name text) language sql stable security definer set search_path = '' as $$
  select lower(u.email)::text, (u.raw_user_meta_data ->> 'full_name')::text
  from auth.users u where (select public.is_captain());
$$;
revoke all on function public.team_directory() from public, anon;
grant execute on function public.team_directory() to authenticated;

-- Each person's Google name is saved to their own team row when they sign in (only if it has no real name yet).
create or replace function public.sync_my_name(p_name text)
returns void language sql security definer set search_path = '' as $$
  update public.members set name = p_name
  where lower(email) = lower((select auth.jwt() ->> 'email')) and (name is null or name = '' or name like '%@%');
$$;
revoke all on function public.sync_my_name(text) from public, anon;
grant execute on function public.sync_my_name(text) to authenticated;

notify pgrst, 'reload schema';

-- Push notifications: one row per device that turned notifications on.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid(),
  email text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push rows" on public.push_subscriptions;
create policy "own push rows" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
notify pgrst, 'reload schema';
