-- ABDUZIU online: profiles (nickname + RP), weekly ranked runs, cloud save.
-- All writes to profiles / ranked_runs go through SECURITY DEFINER RPCs, so a
-- client can never set its own RP or insert a run without the server-side checks.

-- ── tables ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z0-9_.-]{3,16}$'),
  rp integer not null default 0 check (rp >= 0),
  peak_rp integer not null default 0 check (peak_rp >= 0),
  games integer not null default 0 check (games >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_nickname_lower_key on public.profiles (lower(nickname));

create table public.ranked_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week text not null check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  city text not null,
  seed bigint not null,
  score integer not null check (score >= 0),
  objects integer not null check (objects >= 0),
  duration real not null check (duration >= 0),
  extracted boolean not null,
  rp_before integer not null,
  rp_delta integer not null,
  created_at timestamptz not null default now()
);
create index ranked_runs_week_user_score_idx on public.ranked_runs (week, user_id, score desc, created_at);
create index ranked_runs_user_created_idx on public.ranked_runs (user_id, created_at desc);

create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 262144),
  updated_at timestamptz not null default now()
);

-- ── row level security ────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.ranked_runs enable row level security;
alter table public.saves enable row level security;

-- leaderboard data is public (nickname, RP, scores — no e-mail lives here)
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "ranked runs are public" on public.ranked_runs for select to anon, authenticated using (true);
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.ranked_runs from anon, authenticated;

-- cloud save: strictly the owner's row
create policy "read own save" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own save" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own save" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own save" on public.saves for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.saves from anon;

-- ── new user → profile with a placeholder nickname (renamed in-game) ──────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, nickname)
    values (new.id, 'ET-' || upper(substr(md5(new.id::text), 1, 6)))
    on conflict do nothing;
  exception when others then
    -- never block a sign-up because of the game profile
    null;
  end;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RPC: nickname ─────────────────────────────────────────────────────────
create or replace function public.set_nickname(p_nickname text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  p_nickname := btrim(coalesce(p_nickname, ''));
  if p_nickname !~ '^[A-Za-z0-9_.-]{3,16}$' then
    raise exception 'bad_nickname';
  end if;
  begin
    insert into public.profiles as pr (id, nickname)
    values (v_uid, p_nickname)
    on conflict (id) do update set nickname = excluded.nickname, updated_at = now()
    returning pr.* into v_row;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;
  return v_row;
end;
$$;

-- ── RPC: weekly leaderboard (best run per player) ─────────────────────────
create or replace function public.get_weekly_leaderboard(p_week text default null, p_limit integer default 50)
returns table (pos bigint, user_id uuid, nickname text, score integer, rp integer, city text, extracted boolean, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.city, r.extracted, r.created_at
    from public.ranked_runs r
    where r.week = coalesce(p_week, to_char(now(), 'IYYY-"W"IW'))
    order by r.user_id, r.score desc, r.created_at asc
  )
  select rank() over (order by b.score desc, b.created_at asc), b.user_id, p.nickname, b.score, p.rp, b.city, b.extracted, b.created_at
  from best b
  join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.get_my_weekly_standing(p_week text default null)
returns table (pos bigint, score integer, players bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.created_at
    from public.ranked_runs r
    where r.week = coalesce(p_week, to_char(now(), 'IYYY-"W"IW'))
    order by r.user_id, r.score desc, r.created_at asc
  ),
  ranked as (
    select b.user_id, b.score, rank() over (order by b.score desc, b.created_at asc) as pos, count(*) over () as players
    from best b
  )
  select ranked.pos, ranked.score, ranked.players
  from ranked
  where ranked.user_id = (select auth.uid());
$$;

-- ── RPC: submit a ranked run (server-authoritative RP) ────────────────────
-- Mirrors src/progression/RankSystem.ts: log2(score / par) * 25, ±10 for
-- extraction/death, clamped to [-40, 60]. Division pars must stay in sync.
create or replace function public.submit_ranked_run(
  p_week text,
  p_city text,
  p_seed bigint,
  p_score integer,
  p_objects integer,
  p_duration real,
  p_extracted boolean
)
returns table (rp integer, delta integer, rp_before integer, week_best integer, week_pos bigint, players bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_rp integer;
  v_par numeric;
  v_delta integer;
  v_new integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  -- the client computes the ISO week in local time: accept either side of UTC
  if p_week is null or p_week not in (to_char(now() - interval '14 hours', 'IYYY-"W"IW'), to_char(now() + interval '14 hours', 'IYYY-"W"IW')) then
    raise exception 'wrong_week';
  end if;
  if p_city is null or p_city !~ '^[a-z_]{2,24}$' then
    raise exception 'bad_city';
  end if;
  if p_score is null or p_objects is null or p_duration is null or p_extracted is null
     or p_score < 0 or p_score > 60000000
     or p_duration < 15 or p_duration > 3600
     or p_objects < 0 or p_objects > 20000
     or p_score > greatest(p_duration, 1) * 150000 then
    raise exception 'implausible_run';
  end if;

  select pr.rp into v_rp from public.profiles pr where pr.id = v_uid for update;
  if not found then
    raise exception 'no_profile';
  end if;
  if exists (select 1 from public.ranked_runs r where r.user_id = v_uid and r.created_at > now() - interval '15 seconds') then
    raise exception 'too_fast';
  end if;

  v_par := case
    when v_rp >= 2300 then 9000000
    when v_rp >= 1600 then 5500000
    when v_rp >= 1050 then 3200000
    when v_rp >= 600 then 1800000
    when v_rp >= 250 then 900000
    else 400000
  end;
  -- floor(x + 0.5) == JS Math.round
  v_delta := floor(log(2::numeric, greatest(1, p_score)::numeric / v_par) * 25 + case when p_extracted then 10 else -10 end + 0.5)::integer;
  v_delta := greatest(-40, least(60, v_delta));
  v_new := greatest(0, v_rp + v_delta);

  update public.profiles as pr
  set rp = v_new, peak_rp = greatest(pr.peak_rp, v_new), games = pr.games + 1, updated_at = now()
  where pr.id = v_uid;

  insert into public.ranked_runs (user_id, week, city, seed, score, objects, duration, extracted, rp_before, rp_delta)
  values (v_uid, p_week, p_city, p_seed, p_score, p_objects, p_duration, p_extracted, v_rp, v_delta);

  return query
  select v_new, v_delta, v_rp, s.score, s.pos, s.players
  from public.get_my_weekly_standing(p_week) s;
end;
$$;

-- ── RPC: LGPD — delete account and every row that belongs to it ───────────
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.saves where user_id = v_uid;
  delete from public.profiles where id = v_uid; -- cascades to ranked_runs
  delete from auth.users where id = v_uid;
end;
$$;

-- ── function privileges ───────────────────────────────────────────────────
revoke all on function public.set_nickname(text) from public, anon;
revoke all on function public.submit_ranked_run(text, text, bigint, integer, integer, real, boolean) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.get_my_weekly_standing(text) from public, anon;
revoke all on function public.get_weekly_leaderboard(text, integer) from public;
grant execute on function public.set_nickname(text) to authenticated;
grant execute on function public.submit_ranked_run(text, text, bigint, integer, integer, real, boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.get_my_weekly_standing(text) to authenticated;
grant execute on function public.get_weekly_leaderboard(text, integer) to anon, authenticated;
