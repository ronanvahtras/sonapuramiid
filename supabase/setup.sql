-- Sõnapüramiid: database setup. Run this once in the Supabase SQL editor.
-- It is safe to run again.

-- Daily leaderboard: one row per player per day. Players have no accounts; "player" is a
-- random id kept in the player's browser.
create table if not exists public.scores (
  day        date        not null,
  player     uuid        not null,
  nick       text        not null,
  seconds    integer     not null,
  moves      integer     not null,
  checks     integer     not null,
  created_at timestamptz not null default now(),
  primary key (day, player),
  constraint scores_nick_ok    check (nick ~ '^[A-Za-zÕÄÖÜŠŽõäöüšž0-9 _.-]{2,16}$'),
  constraint scores_seconds_ok check (seconds between 5 and 7200),
  constraint scores_moves_ok   check (moves between 1 and 500),
  constraint scores_checks_ok  check (checks between 1 and 4)
);

-- Word reports from players ("this compound looks wrong" / "this real word was rejected").
create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  puzzle     text not null check (char_length(puzzle) between 1 and 8),
  word       text not null check (char_length(word) between 2 and 40),
  note       text not null default '' check (char_length(note) <= 200)
);

alter table public.scores  enable row level security;
alter table public.reports enable row level security;

-- The website (role "anon") may read the leaderboard, but never the player ids.
revoke all on public.scores  from anon;
revoke all on public.reports from anon;
grant select (day, nick, seconds, moves)                on public.scores  to anon;
grant insert (day, player, nick, seconds, moves, checks) on public.scores  to anon;
grant insert (puzzle, word, note)                        on public.reports to anon;

drop policy if exists "read scores"  on public.scores;
drop policy if exists "add score"    on public.scores;
drop policy if exists "add report"   on public.reports;

create policy "read scores" on public.scores for select to anon using (true);
-- A score can only be added for today (Tallinn time). There is no update or delete from
-- the website, so a player's first result of the day stands.
create policy "add score" on public.scores for insert to anon
  with check (day = (now() at time zone 'Europe/Tallinn')::date);
create policy "add report" on public.reports for insert to anon with check (true);

-- Weekly leaderboard: the last 7 days, summed per player. Runs with the table owner's
-- rights so it can group by player id without the website ever seeing those ids.
create or replace function public.weekly_scores()
returns table (nick text, days integer, seconds integer, moves integer)
language sql stable security definer set search_path = public as $$
  select (array_agg(s.nick order by s.day desc))[1], count(*)::int, sum(s.seconds)::int, sum(s.moves)::int
  from public.scores s
  where s.day > (now() at time zone 'Europe/Tallinn')::date - 7
  group by s.player
  order by 2 desc, 3 asc, 4 asc
  limit 200
$$;
revoke all on function public.weekly_scores() from public;
grant execute on function public.weekly_scores() to anon;

-- Keep scores for 30 days only (matches the privacy page). Needs the pg_cron extension;
-- if this part fails, enable "pg_cron" under Database > Extensions and run it again.
create extension if not exists pg_cron;
select cron.schedule('sonapuramiid-clean-scores', '15 3 * * *',
  $$delete from public.scores where day < (now() at time zone 'Europe/Tallinn')::date - 30$$);
