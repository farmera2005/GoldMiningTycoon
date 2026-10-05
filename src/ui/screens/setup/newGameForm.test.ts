// New-game stub validation (DESIGN §13.24 P0 wizard stub: name + seed).
import { describe, expect, it } from 'vitest';
import { COMPANY_NAME_MAX, parseSeed, randomSeed, validateNewGame } from './newGameForm';

describe('parseSeed', () => {
  it.each([
    ['0', 0],
    ['  42 ', 42],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
    ['9007199254740992', null],
    ['-1', null],
    ['1.5', null],
    ['1e3', null],
    ['', null],
    ['12x', null],
  ])('%j → %s', (text, seed) => {
    expect(parseSeed(text)).toBe(seed);
  });
});

describe('validateNewGame', () => {
  it('trims the name and parses the seed', () => {
    expect(validateNewGame({ companyName: '  Ruby Creek  ', seed: '7' })).toEqual({
      ok: true,
      input: { companyName: 'Ruby Creek', seed: 7 },
    });
  });

  it('reports every field error at once', () => {
    expect(validateNewGame({ companyName: '   ', seed: 'abc' })).toEqual({
      ok: false,
      errors: { companyName: 'NAME_REQUIRED', seed: 'SEED_INVALID' },
    });
    expect(validateNewGame({ companyName: 'x'.repeat(COMPANY_NAME_MAX + 1), seed: '1' })).toEqual({
      ok: false,
      errors: { companyName: 'NAME_TOO_LONG' },
    });
  });

  it('draws default seeds that the form accepts', () => {
    for (let i = 0; i < 20; i++) expect(parseSeed(String(randomSeed()))).not.toBeNull();
  });
});
