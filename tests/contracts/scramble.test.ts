// Scramblers (P1 contract §0.5, §11 item 4): one per section that keeps hidden fields, each registered once; on a fresh
// P1 state the scrambled twin equals the state once every owner's hidden fields are stripped, and no field named
// `hidden` survives the strip (Wave-0 identities pass trivially; each owner's package fills its scrambler).
import { describe, expect, it } from 'vitest';
import { defaultNewGameSetup, newGame } from '../../src/engine';
import { SCRAMBLERS, scrambleHidden, withoutHidden } from '../../sim/bots/scramble';

const STATE = newGame(defaultNewGameSetup({ companyName: 'Scramble Test' }), 'scramble');

function hiddenPaths(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => hiddenPaths(v, `${path}[${i}]`));
  return Object.entries(value).flatMap(([k, v]) => [
    ...(k === 'hidden' ? [`${path}.${k}`] : []),
    ...hiddenPaths(v, `${path}.${k}`),
  ]);
}

describe('scramblers (P1 contract §11 item 4)', () => {
  it('registers one scrambler per hidden-field owner, in section order', () => {
    expect(SCRAMBLERS.map((d) => [d.id, d.section])).toEqual([
      ['s01', 1],
      ['s03', 3],
      ['s04', 4],
      ['s05', 5],
      ['s07', 7],
      ['s08', 8],
      ['s10', 10],
    ]);
  });

  it('changes only hidden fields on a fresh P1 state, and leaves no `hidden` block unstripped', () => {
    expect(withoutHidden(scrambleHidden(STATE, 'twin'))).toEqual(withoutHidden(STATE));
    expect(hiddenPaths(withoutHidden(STATE))).toEqual([]);
  });
});
