// Wizard stub validation (DESIGN §13.24 P0: name + seed; §1 1.6 codes through the engine's validateSetup; D-13.28).
import { describe, expect, it } from 'vitest';
import { NAME_MAX_LENGTH } from '../../../engine';
import {
  SEED_ALPHABET,
  SEED_LENGTH,
  SEED_MAX_LENGTH,
  fieldErrorText,
  randomSeed,
  seedIssue,
  validateNewGame,
} from './newGameForm';

describe('validateNewGame', () => {
  it('trims the name and the seed and passes the seed through as text', () => {
    expect(validateNewGame({ companyName: '  Ruby Creek  ', seed: ' 0ABC ' })).toEqual({
      ok: true,
      input: { companyName: 'Ruby Creek', seed: '0ABC' },
    });
  });

  it("reports the engine's NAME_EMPTY and NAME_TOO_LONG, and the seed codes, all at once", () => {
    expect(validateNewGame({ companyName: '   ', seed: '' })).toEqual({
      ok: false,
      errors: { companyName: 'NAME_EMPTY', seed: 'SEED_EMPTY' },
    });
    expect(validateNewGame({ companyName: 'x'.repeat(NAME_MAX_LENGTH + 1), seed: 'a' })).toEqual({
      ok: false,
      errors: { companyName: 'NAME_TOO_LONG' },
    });
    expect(validateNewGame({ companyName: 'x'.repeat(NAME_MAX_LENGTH), seed: 'a' }).ok).toBe(true);
    expect(seedIssue('s'.repeat(SEED_MAX_LENGTH + 1))).toBe('SEED_TOO_LONG');
  });

  it('words every code from the text catalog', () => {
    expect(fieldErrorText('NAME_EMPTY')).toBe('Enter a company name.');
    expect(fieldErrorText('NAME_TOO_LONG')).toBe(`Keep the name to ${NAME_MAX_LENGTH} characters or fewer.`);
    expect(fieldErrorText('SEED_TOO_LONG')).toBe(`Keep the seed to ${SEED_MAX_LENGTH} characters or fewer.`);
    expect(fieldErrorText('SEED_EMPTY')).toMatch(/seed/);
  });
});

describe('randomSeed (D-13.28)', () => {
  it('is 26 Crockford base32 characters from the given bytes', () => {
    const bytes = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => i * 37);
    const seed = randomSeed(bytes);
    expect(seed).toHaveLength(SEED_LENGTH);
    expect([...seed].every((c) => SEED_ALPHABET.includes(c))).toBe(true);
    expect(seed.slice(0, 4)).toBe(`0${SEED_ALPHABET[37 & 31]}${SEED_ALPHABET[74 & 31]}${SEED_ALPHABET[111 & 31]}`);
  });

  it('draws from crypto.getRandomValues by default, and the form accepts every seed it makes', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => randomSeed()));
    expect(seeds.size).toBe(20);
    for (const s of seeds) expect(validateNewGame({ companyName: 'A', seed: s }).ok).toBe(true);
    expect(SEED_ALPHABET).toHaveLength(32);
    expect(SEED_ALPHABET).not.toMatch(/[ILOU]/);
  });
});
