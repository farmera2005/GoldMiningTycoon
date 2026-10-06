// §12 rolling and the director (DESIGN §12 12.2, 12.6; P1 contract §4.12): the pure pieces `eventsStep` composes. The
// probability product, a relative window's weekly base, the severity tilt, magnitude and duration draws, the
// exponential-race victim pick, the director's filter and its budget. P1 rolls nothing, so these are Wave-0 stubs for
// the §12 package (P3); none is called under P1 rules.
import { ContractStubError } from '../../core/assert';
import type { Rng } from '../../core/rng';
import type { GameState } from '../../state/types';
import type { EventDef, EventSeverity, ScopeRef } from './types';

/** p(e, s, t) of 12.2, clamped to `events.maxWeeklyProb`. */
export function eventProbability(_state: GameState, _def: EventDef, _scope: ScopeRef, _turn: number): number {
  // CONTRACT-STUB(§12) events.eventProbability
  return 0;
}

/** A relative window's weekly base: 1 − (1 − min(0.9, annualProb · F))^(1/n). */
export function windowBase(_annualProb: number, _frequencyMult: number, _windowWeeks: number): number {
  // CONTRACT-STUB(§12) events.windowBase
  return 0;
}

/** w'_k = w_k · s^k / Σ_j w_j · s^j (12.2). */
export function tiltSeverity(weights: readonly [number, number, number, number], _s: number): [number, number, number, number] {
  // CONTRACT-STUB(§12) events.tiltSeverity
  return [weights[0], weights[1], weights[2], weights[3]];
}

/** lo + x·(hi − lo) on the event's stream (12.2). */
export function drawMagnitude(_rng: Rng, value: number | readonly [number, number]): number {
  // CONTRACT-STUB(§12) events.drawMagnitude
  return typeof value === 'number' ? value : value[0];
}

/** A uniform integer in [min, max] (12.2). */
export function drawDuration(_rng: Rng, range: readonly [number, number]): number {
  // CONTRACT-STUB(§12) events.drawDuration
  return range[0];
}

/** The exponential race of 12.2: lowest −ln(u_e)/w_e wins. */
export function pickVictim<T extends string>(_draws: readonly { id: T; u: number; weight: number }[]): T | null {
  // CONTRACT-STUB(§12) events.pickVictim
  return null;
}

/** The director's filter over the week's candidates (12.6); returns the accepted candidates' indexes. */
export function runDirector(
  _state: GameState,
  _candidates: readonly { defId: string; scope: ScopeRef; severity: EventSeverity; points: number }[],
): number[] {
  // CONTRACT-STUB(§12) events.runDirector
  throw new ContractStubError('events.runDirector');
}

/** The director's points for the current half-year (12.6). */
export function directorBudget(_state: GameState): number {
  // CONTRACT-STUB(§12) events.directorBudget
  return 0;
}
