-- Sõnapüramiid: adds the weekly leaderboard. Run once in the Supabase SQL editor.
-- (Already included in setup.sql for new installs.)

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
