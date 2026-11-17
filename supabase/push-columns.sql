-- Make sure push_subscriptions has every column the app uses. Safe to re-run, in the Supabase SQL editor.
alter table public.push_subscriptions add column if not exists user_id uuid default auth.uid();
alter table public.push_subscriptions add column if not exists email text;
alter table public.push_subscriptions add column if not exists p256dh text;
alter table public.push_subscriptions add column if not exists auth text;
alter table public.push_subscriptions add column if not exists created_at timestamptz not null default now();

-- Fill in the email for any old rows.
update public.push_subscriptions p set email = lower(u.email)
from auth.users u where u.id = p.user_id and p.email is null;

-- The app upserts on endpoint, so it needs a unique key.
create unique index if not exists push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);

notify pgrst, 'reload schema';

-- Check the result: should list endpoint, user_id, email, p256dh, auth, created_at
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'push_subscriptions' order by ordinal_position;
