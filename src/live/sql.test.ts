import { SETUP_SQL } from './sql';

test('the setup script grants table access (new Supabase projects need explicit grants)', () => {
  expect(SETUP_SQL).toMatch(/grant select on public\.live_games to anon, authenticated/);
  expect(SETUP_SQL).toMatch(/grant insert, update, delete on public\.live_games to authenticated/);
  expect(SETUP_SQL).toMatch(/grant select, insert on public\.live_players to anon, authenticated/);
  expect(SETUP_SQL).toMatch(/grant select, insert on public\.live_claims to anon, authenticated/);
});
