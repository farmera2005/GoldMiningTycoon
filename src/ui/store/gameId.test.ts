// Game identity for per-game autosaves (DESIGN §13.16): minted ids and the id derived for saves that carry none.
import { describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../engine';
import { freshState } from '../testing/harness';
import { GAME_ID_PATTERN, legacyGameId, newGameId } from './gameId';

vi.setConfig({ testTimeout: 60_000 });

describe('game ids', () => {
  it('mints `g` + 16 base32 characters from the CSPRNG, different each time', () => {
    const a = newGameId();
    const b = newGameId();
    expect(a).toMatch(/^g[0-9a-hjkmnp-tv-z]{16}$/);
    expect(a).not.toBe(b);
    expect(GAME_ID_PATTERN.test(a)).toBe(true);
    // Each byte's low five bits pick the character.
    expect(newGameId((n) => new Uint8Array(n).map((_, i) => i * 33))).toBe('g0123456789abcdef');
  });

  it('derives a stable id from seed and company for a save without one', () => {
    const s = freshState();
    expect(legacyGameId(s)).toBe(legacyGameId(s));
    expect(legacyGameId(s)).toMatch(/^l[0-9a-f]{16}$/);
    const renamed = { ...s, company: { ...s.company, name: 'Other Co' } } as GameState;
    const reseeded = { ...s, meta: { ...s.meta, seed: 'other-seed' } } as GameState;
    expect(legacyGameId(renamed)).not.toBe(legacyGameId(s));
    expect(legacyGameId(reseeded)).not.toBe(legacyGameId(s));
    expect(GAME_ID_PATTERN.test(legacyGameId(s))).toBe(true);
  });
});
