-- Optional birthdays (day and month only, no year).
alter table public.members add column if not exists birth_month smallint check (birth_month between 1 and 12);
alter table public.members add column if not exists birth_day smallint check (birth_day between 1 and 31);
alter table public.members add column if not exists birthday_asked boolean not null default false;

-- Each person sets or clears their own birthday. p_month / p_day null = no birthday. Also marks the first-time question as answered.
create or replace function public.set_my_birthday(p_month smallint, p_day smallint)
returns void language sql security definer set search_path = '' as $$
  update public.members
  set birth_month = p_month, birth_day = p_day, birthday_asked = true
  where lower(email) = lower((select auth.jwt() ->> 'email'));
$$;
revoke all on function public.set_my_birthday(smallint, smallint) from public, anon;
grant execute on function public.set_my_birthday(smallint, smallint) to authenticated;

notify pgrst, 'reload schema';

-- ---- Birthday card: who has a birthday today (India time), and everyone's wishes ----
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where lower(m.email) = lower((select auth.jwt() ->> 'email')));
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- Any team member can see whose birthday it is. Feb 29 birthdays show on Feb 28 in years that are not leap years.
create or replace function public.birthdays_today()
returns table(email text, name text) language sql stable security definer set search_path = '' as $$
  with t as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select lower(m.email)::text, m.name::text from public.members m, t
  where (select public.is_member()) and m.birth_month is not null and m.birth_day is not null and (
    (m.birth_month = extract(month from t.d) and m.birth_day = extract(day from t.d))
    or (m.birth_month = 2 and m.birth_day = 29 and extract(month from t.d) = 2 and extract(day from t.d) = 28
        and not (extract(year from t.d)::int % 4 = 0 and (extract(year from t.d)::int % 100 <> 0 or extract(year from t.d)::int % 400 = 0)))
  );
$$;
revoke all on function public.birthdays_today() from public, anon;
grant execute on function public.birthdays_today() to authenticated;

-- One row per person per birthday per year: a tap-to-wish, optionally with a line for the send-off card.
create table if not exists public.birthday_wishes (
  birthday_email text not null,
  yr int not null,
  from_email text not null,
  message text check (message is null or char_length(message) <= 200),
  created_at timestamptz not null default now(),
  primary key (birthday_email, yr, from_email)
);
alter table public.birthday_wishes enable row level security; -- no policies: reached only through the functions below

create or replace function public.wish_birthday(p_email text, p_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me text := lower((select auth.jwt() ->> 'email')); msg text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not (select public.is_member()) then raise exception 'Not a team member'; end if;
  if lower(p_email) = me then raise exception 'You cannot wish yourself'; end if;
  if not exists (select 1 from public.birthdays_today() b where b.email = lower(p_email)) then raise exception 'It is not their birthday today'; end if;
  insert into public.birthday_wishes (birthday_email, yr, from_email, message)
  values (lower(p_email), extract(year from (now() at time zone 'Asia/Kolkata'))::int, me, msg)
  on conflict (birthday_email, yr, from_email) do update set message = coalesce(excluded.message, public.birthday_wishes.message);
end $$;
revoke all on function public.wish_birthday(text, text) from public, anon;
grant execute on function public.wish_birthday(text, text) to authenticated;

create or replace function public.unwish_birthday(p_email text)
returns void language sql security definer set search_path = '' as $$
  delete from public.birthday_wishes
  where birthday_email = lower(p_email) and from_email = lower((select auth.jwt() ->> 'email'))
    and yr = extract(year from (now() at time zone 'Asia/Kolkata'))::int;
$$;
revoke all on function public.unwish_birthday(text) from public, anon;
grant execute on function public.unwish_birthday(text) to authenticated;

create or replace function public.birthday_wishes_today()
returns table(birthday_email text, from_email text, from_name text, message text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.birthday_email, w.from_email, m.name::text, w.message, w.created_at
  from public.birthday_wishes w
  left join public.members m on lower(m.email) = w.from_email
  where (select public.is_member())
    and w.yr = extract(year from (now() at time zone 'Asia/Kolkata'))::int
    and w.birthday_email in (select b.email from public.birthdays_today() b)
  order by w.created_at;
$$;
revoke all on function public.birthday_wishes_today() from public, anon;
grant execute on function public.birthday_wishes_today() to authenticated;

notify pgrst, 'reload schema';
