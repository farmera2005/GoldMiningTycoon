// §6 permits selectors (DESIGN §2.11, §6.17; P1 contract §4.6): pure readers over state, spread into `select` by
// select/index.ts. §6 holds no hidden field. A name already used by another folder fails the composition test.
import type { ObligationId } from '../../core/ids';
import type { GameState } from '../../state/types';
import { obligationsInRange } from './obligations';
import { sortedValues } from '../../core/iter';
import type { Obligation, ObligationFilter } from './types';

/** Every obligation matching the filter, by due turn then id. */
function obligations(state: GameState, filter: ObligationFilter = {}): Obligation[] {
  return obligationsInRange(state, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, filter);
}

function obligation(state: GameState, obligationId: ObligationId): Obligation | null {
  return state.permits.obligations[obligationId] ?? null;
}

/** Open obligations due within the next `weeks` weeks (the calendar's look-ahead). */
function upcomingObligations(state: GameState, weeks: number): Obligation[] {
  const t = state.clock.turn;
  return obligationsInRange(state, t, t + weeks, { statuses: ['upcoming', 'due'] });
}

/** Open obligations of every age (missed ones included), for the compliance calendar's overdue list. */
function openObligations(state: GameState): Obligation[] {
  return sortedValues(state.permits.obligations).filter(
    (o) => o.status === 'upcoming' || o.status === 'due' || o.status === 'missed',
  );
}

export const permitsSelectors = {
  obligations,
  obligation,
  upcomingObligations,
  openObligations,
} as const;
