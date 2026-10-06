import { describe, expect, it } from 'vitest';
import seedsJson from './seeds.json';
import { SEED_PHASE_KEYS, seedBaseForPhase, seedBases } from './seeds';

describe('balance seed bases (BALANCE §6.2)', () => {
  it('holds one non-negative safe-integer base per rules phase p0…p6 and nothing else', () => {
    expect(Object.keys(seedsJson).sort()).toEqual([...SEED_PHASE_KEYS].sort());
    for (const key of SEED_PHASE_KEYS) {
      expect(Number.isSafeInteger(seedBases[key])).toBe(true);
      expect(seedBases[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it('maps a rules phase to its base', () => {
    expect(seedBaseForPhase(0)).toBe(seedsJson.p0);
    expect(seedBaseForPhase(6)).toBe(seedsJson.p6);
  });

  it('keeps every phase on its own seeds for a full 2,000-game market cell (no overlap between phases)', () => {
    const bases = SEED_PHASE_KEYS.map((k) => seedBases[k]).sort((a, b) => a - b);
    for (let i = 1; i < bases.length; i++)
      expect((bases[i] as number) - (bases[i - 1] as number)).toBeGreaterThanOrEqual(2000);
  });
});
