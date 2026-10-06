// §1 reputation (DESIGN §1 1.12; P1 contract §4.2, §0.6 item 8). Other sections report an input with
// `recordReputation(draft, kind, ref)`: it is appended to `company.reputation.pending` with the delta of the
// `game.reputation.delta` table and takes effect in step 16a (part 16.1), which applies decay, the per-kind caps
// (truncating) and the week-1 cap reset. The one-week lag keeps steps 3–14 free of circular dependencies.
import type { TuningResolved } from '../../../data/tuning';
import type { Id } from '../../core/ids';
import { contractTuningValue } from '../../state/partKit';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { ReputationKind } from './types';

export class ReputationKindError extends Error {
  constructor(kind: string) {
    super(`game.reputation.delta has no row for '${kind}'`);
    this.name = 'ReputationKindError';
  }
}

/** The table's delta for a kind (1.12 as data). Throws for a kind the table does not list. */
export function reputationDelta(tuning: TuningResolved, kind: ReputationKind): number {
  const table = contractTuningValue(tuning, 'game.reputation.delta');
  if (typeof table !== 'object' || Array.isArray(table) || !Object.prototype.hasOwnProperty.call(table, kind)) {
    throw new ReputationKindError(kind);
  }
  const row = (table as Readonly<Record<string, unknown>>)[kind];
  const delta =
    typeof row === 'object' && row !== null && !Array.isArray(row)
      ? (row as Readonly<Record<string, unknown>>)['delta']
      : undefined;
  if (typeof delta !== 'number' || !Number.isFinite(delta)) throw new ReputationKindError(kind);
  return delta;
}

/** Appends a reputation input to this week's pending entries (W0 real, contract §0.6 item 8). */
export function recordReputation(draft: GameState, kind: ReputationKind, ref: Id | null): void {
  draft.company.reputation.pending.push({
    turn: draft.clock.turn,
    kind,
    delta: reputationDelta(draft.meta.tuning, kind),
    ref,
  });
}

/** Part 16.1 (16a): decay, pending deltas with per-kind caps, week-1 cap reset, 52-week log trim, week-52 inputs. */
export function reputationWeek(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§1) company.reputationWeek
}
