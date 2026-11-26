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
-- Each card is held by one phone (stored as a fingerprint of the phone's private id).
alter table live_players add column if not exists device text;
delete from live_players a using live_players b
  where a.code = b.code and a.card_number = b.card_number and a.id > b.id;
create unique index if not exists live_players_one_phone_per_card on live_players (code, card_number);

-- New Supabase projects don't expose tables to apps automatically: grant exactly what the rules below allow.
-- Phones join, leave and claim only through the functions below.
grant usage on schema public to anon, authenticated;
grant select on public.live_games to anon, authenticated;
grant insert, update, delete on public.live_games to authenticated;
revoke insert, update, delete on public.live_players from anon, authenticated;
revoke insert, update, delete on public.live_claims from anon, authenticated;
grant select on public.live_players to anon, authenticated;
grant select on public.live_claims to anon, authenticated;

-- A phone takes a card: 'ok' (also when this phone already holds it), 'taken', 'closed' or 'not_printed'.
create or replace function join_card(p_code text, p_card int, p_name text, p_device text) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  d text := md5(p_device);
  holder text;
begin
  if not exists (select 1 from live_games where code = p_code and status = 'open') then return 'closed'; end if;
  if p_card < 1 or p_card > 9999 then return 'not_printed'; end if;
  if p_card < 5000 and not exists (
    select 1 from live_games g, jsonb_array_elements(coalesce(g.def->'printed', '[]'::jsonb)) e
    where g.code = p_code and (e->>0)::int = p_card
  ) then return 'not_printed'; end if;
  select device into holder from live_players where code = p_code and card_number = p_card;
  if found then
    if holder is distinct from d then return 'taken'; end if;
    update live_players set name = left(nullif(p_name, ''), 40) where code = p_code and card_number = p_card;
    return 'ok';
  end if;
  insert into live_players (code, card_number, name, device) values (p_code, p_card, left(nullif(p_name, ''), 40), d);
  return 'ok';
exception when unique_violation then return 'taken';
end $fn$;

-- A phone gives a card back.
create or replace function leave_card(p_code text, p_card int, p_device text) returns void
language sql security definer set search_path = public as $fn$
  delete from live_players where code = p_code and card_number = p_card and device = md5(p_device);
$fn$;

-- BINGO from the phone holding the card: 'ok', 'closed' or 'not_joined'. Repeats within 10 seconds are ignored.
create or replace function claim_card(p_code text, p_card int, p_name text, p_device text) returns text
language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (select 1 from live_games where code = p_code and status = 'open') then return 'closed'; end if;
  if not exists (select 1 from live_players where code = p_code and card_number = p_card and device = md5(p_device)) then return 'not_joined'; end if;
  if exists (select 1 from live_claims where code = p_code and card_number = p_card and created_at > now() - interval '10 seconds') then return 'ok'; end if;
  insert into live_claims (code, card_number, name) values (p_code, p_card, left(nullif(p_name, ''), 40));
  return 'ok';
end $fn$;

revoke all on function join_card(text, int, text, text) from public;
revoke all on function leave_card(text, int, text) from public;
revoke all on function claim_card(text, int, text, text) from public;
grant execute on function join_card(text, int, text, text) to anon, authenticated;
grant execute on function leave_card(text, int, text) to anon, authenticated;
grant execute on function claim_card(text, int, text, text) to anon, authenticated;

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
