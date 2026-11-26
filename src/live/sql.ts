/** One-time setup script the host pastes into Supabase → SQL Editor. Safe to run again. */
export const SETUP_SQL = `-- Music Bingo live play
create table if not exists live_games (
  code text primary key,
  host uuid not null default auth.uid(),
  title text not null,
  def jsonb not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create table if not exists live_players (
  id bigint generated always as identity primary key,
  code text not null references live_games(code) on delete cascade,
  card_number int not null check (card_number between 1 and 9999),
  name text check (char_length(name) <= 40),
  joined_at timestamptz not null default now()
);
create table if not exists live_claims (
  id bigint generated always as identity primary key,
  code text not null references live_games(code) on delete cascade,
  card_number int not null check (card_number between 1 and 9999),
  name text check (char_length(name) <= 40),
  created_at timestamptz not null default now()
);
-- New Supabase projects don't expose tables to apps automatically: grant exactly what the rules below allow.
grant usage on schema public to anon, authenticated;
grant select on public.live_games to anon, authenticated;
grant insert, update, delete on public.live_games to authenticated;
grant select, insert on public.live_players to anon, authenticated;
grant select, insert on public.live_claims to anon, authenticated;

alter table live_games enable row level security;
alter table live_players enable row level security;
alter table live_claims enable row level security;

drop policy if exists "anyone reads games" on live_games;
drop policy if exists "host creates game" on live_games;
drop policy if exists "host updates game" on live_games;
drop policy if exists "host deletes game" on live_games;
drop policy if exists "join open game" on live_players;
drop policy if exists "read players" on live_players;
drop policy if exists "claim in open game" on live_claims;
drop policy if exists "host reads claims" on live_claims;

create policy "anyone reads games" on live_games for select using (true);
create policy "host creates game" on live_games for insert to authenticated with check (host = auth.uid());
create policy "host updates game" on live_games for update to authenticated using (host = auth.uid());
create policy "host deletes game" on live_games for delete to authenticated using (host = auth.uid());
create policy "join open game" on live_players for insert
  with check (exists (select 1 from live_games g where g.code = live_players.code and g.status = 'open'));
create policy "read players" on live_players for select using (true);
create policy "claim in open game" on live_claims for insert
  with check (exists (select 1 from live_games g where g.code = live_claims.code and g.status = 'open'));
create policy "host reads claims" on live_claims for select to authenticated
  using (exists (select 1 from live_games g where g.code = live_claims.code and g.host = auth.uid()));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_players') then
    alter publication supabase_realtime add table live_players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_claims') then
    alter publication supabase_realtime add table live_claims;
  end if;
end $$;
`;
