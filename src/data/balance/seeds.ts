// Seed bases per rules phase (BALANCE §6.2): game i of a cell uses seed `seedBase + i`. The bases are fixed per
// phase in seeds.json and never chosen after seeing results; the simulator's `--seed-base` defaults to the base of
// the rules phase it runs.
import type { RulesPhase } from '../../engine/state/types';
import seedsJson from './seeds.json';

export type SeedPhaseKey = 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';

export const SEED_PHASE_KEYS: readonly SeedPhaseKey[] = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

function checkedSeedBases(raw: unknown): Readonly<Record<SeedPhaseKey, number>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('data/balance/seeds.json must be an object keyed p0…p6');
  }
  const rec = raw as Record<string, unknown>;
  const out = {} as Record<SeedPhaseKey, number>;
  for (const key of SEED_PHASE_KEYS) {
    const v = rec[key];
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) {
      throw new TypeError(`data/balance/seeds.json: ${key} must be a non-negative safe integer`);
    }
    out[key] = v;
  }
  return out;
}

export const seedBases: Readonly<Record<SeedPhaseKey, number>> = checkedSeedBases(seedsJson);

/** The seed base of a rules phase (BALANCE §6.2). */
export function seedBaseForPhase(phase: RulesPhase): number {
  const key = `p${phase}` as SeedPhaseKey;
  return seedBases[key];
}
