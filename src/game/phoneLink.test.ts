import { setPhoneDef } from './phoneLink';
import { generateCardSet } from '../core/cards';
import { DEFAULT_STYLE } from '../core/style';
import { catPool, layout } from '../test/fixtures';

test("poster and players' screen build the same phone link (same title fallback)", () => {
  const { set } = generateCardSet(catPool(), layout(), { seed: 1, count: 2, startNumber: 1 });
  const s = { ...set, style: { ...DEFAULT_STYLE, title: '' } };
  expect(setPhoneDef(s).title).toBe('Music Bingo');
  expect(setPhoneDef({ ...s, style: { ...DEFAULT_STYLE, title: 'Gala' } }).title).toBe('Gala');
});
