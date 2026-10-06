// BALANCE §5.3's start NW, the NW ratio's denominator: the owner NW a start type begins with (DESIGN §1 1.8: $520k
// Bootstrapper, $250k Backed, ≈ $280k Inheritor), scaled by the difficulty cash multipliers. It is read from the
// game's resolved tuning, so a difficulty's { mul } and any --tuning override flow through; nothing is hard-coded.
import type { GameState } from '../../src/engine';
import type { SimStart } from '../setup';

type Tuning = GameState['meta']['tuning'];

/** One cash term of a start's NW: a tuning amount in USD times its difficulty multiplier key. */
interface StartTerm {
  readonly usdKey: string;
  readonly multKey: string;
}

/**
 * §1 1.8 start tables by start type. Bootstrapper NW is company cash plus personal cash. The Backed and Inheritor
 * rows need start-table keys (owner capital, personal cash, the inherited fleet and note) that arrive with those starts
 * in P1; until then their start NW is not derivable (null) and P0 cannot run those starts anyway.
 */
const START_TERMS: Readonly<Record<SimStart, readonly StartTerm[] | null>> = {
  bootstrapper: [
    { usdKey: 'game.start.bootstrapper.companyCashUsd', multKey: 'game.startCompanyCashMult' },
    { usdKey: 'game.start.bootstrapper.personalCashUsd', multKey: 'game.startPersonalCashMult' },
  ],
  backedEquity: null,
  backedRoyalty: null,
  inheritor: null,
};

function numberAt(tuning: Tuning, key: string): number | null {
  const v = (tuning as Readonly<Record<string, unknown>>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Start NW in cents for a start under a game's resolved tuning; null when the tuning lacks a needed key. */
export function startNetWorthCents(start: SimStart, tuning: Tuning): number | null {
  const terms = START_TERMS[start];
  if (terms === null) return null;
  let usd = 0;
  for (const t of terms) {
    const amount = numberAt(tuning, t.usdKey);
    const mult = numberAt(tuning, t.multKey);
    if (amount === null || mult === null) return null;
    usd += amount * mult;
  }
  return Math.round(usd * 100);
}
