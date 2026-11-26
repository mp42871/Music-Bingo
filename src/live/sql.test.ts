import { SETUP_SQL } from './sql';

test('the setup script grants table access (new Supabase projects need explicit grants)', () => {
  expect(SETUP_SQL).toMatch(/grant select on public\.live_games to anon, authenticated/);
  expect(SETUP_SQL).toMatch(/grant insert, update, delete on public\.live_games to authenticated/);
  expect(SETUP_SQL).toMatch(/grant select on public\.live_players to anon, authenticated/);
});

test('phones join, leave and claim only through the checking functions (one phone per card)', () => {
  expect(SETUP_SQL).toMatch(/revoke insert, update, delete on public\.live_players from anon, authenticated/);
  expect(SETUP_SQL).toMatch(/revoke insert, update, delete on public\.live_claims from anon, authenticated/);
  expect(SETUP_SQL).toMatch(/create unique index if not exists live_players_one_phone_per_card on live_players \(code, card_number\)/);
  for (const fn of ['join_card(text, int, text, text)', 'leave_card(text, int, text)', 'claim_card(text, int, text, text)']) {
    expect(SETUP_SQL).toContain(`grant execute on function ${fn} to anon, authenticated`);
  }
});
