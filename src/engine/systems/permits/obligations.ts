// §6 the obligation store (DESIGN §6.9; D-6.15, D-6.38, D-6.41, D-6.59; s05 #1, #2; P1 contract §4.6, §0.6 item 8).
// Wave 0 writes the real P1 bodies because §5, §1 and §11 build against them: creating an obligation mints an `obl` id
// and keeps `obligationIds` sorted; satisfying is idempotent and then calls the owner's `onObligationSatisfied` (§5
// pushes its AMR recoup credit, §11 closes the bill); cancelling lets §11 cancel any open bill. `settlementClass` is the
// one rule both §6 (step 13) and §11 (step 14) apply: §1, §5 and §11 money obligations and the late-fee, escalate and
// default consequences are billable, everything else is statutory.
import { compareIds, nextId, type ObligationId, type TxnId } from '../../core/ids';
import { insertSortedId, sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import { cloneJson } from '../../state/immutability';
import {
  onObligationCancelled as financeOnCancelled,
  onObligationSatisfied as financeOnSatisfied,
} from '../finance/obligations';
import { onObligationSatisfied as landOnSatisfied } from '../land/tenure';
import type { Obligation, ObligationFilter, ObligationSatisfiedVia, ObligationSpec } from './types';

export class ObligationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObligationError';
  }
}

function obligationOf(draft: GameState, id: ObligationId): Obligation {
  const obl = Object.prototype.hasOwnProperty.call(draft.permits.obligations, id)
    ? draft.permits.obligations[id]
    : undefined;
  if (obl === undefined) throw new ObligationError(`no obligation ${id}`);
  return obl;
}

/** Stores a new obligation: 'due' once its window is open, else 'upcoming'. */
export function createObligation(draft: GameState, spec: ObligationSpec): ObligationId {
  const id = nextId(draft.ids, 'obl');
  const status = draft.clock.turn >= spec.windowOpenTurn ? 'due' : 'upcoming';
  draft.permits.obligations[id] = { ...cloneJson(spec), id, status };
  insertSortedId(draft.permits.obligationIds, id);
  return id;
}

const SATISFIABLE: readonly Obligation['status'][] = ['upcoming', 'due', 'missed', 'inPlan'];

/** Marks an obligation satisfied (idempotent) and tells its owner. */
export function satisfyObligation(
  draft: GameState,
  id: ObligationId,
  via: ObligationSatisfiedVia,
  refs: readonly TxnId[] = [],
): void {
  const obl = obligationOf(draft, id);
  if (obl.status === 'satisfied') return;
  if (!SATISFIABLE.includes(obl.status)) throw new ObligationError(`obligation ${id} is ${obl.status}`);
  obl.status = 'satisfied';
  obl.satisfiedTurn = draft.clock.turn;
  obl.satisfiedVia = via;
  if (refs.length > 0) obl.ledgerTxnIds = [...(obl.ledgerTxnIds ?? []), ...refs];
  switch (obl.owner) {
    case '§5':
      landOnSatisfied(draft, obl);
      break;
    case '§11':
      financeOnSatisfied(draft, obl);
      break;
    case '§1':
    case '§6':
    case '§8':
      break;
  }
}

/** Cancels an open obligation (s05 #2); §11 then cancels any open bill for it. Cancelling twice is a no-op. */
export function cancelObligation(draft: GameState, id: ObligationId): void {
  const obl = obligationOf(draft, id);
  if (obl.status === 'cancelled') return;
  if (obl.status === 'satisfied') throw new ObligationError(`obligation ${id} is already satisfied`);
  obl.status = 'cancelled';
  financeOnCancelled(draft, obl);
}

function matches(obl: Obligation, filter: ObligationFilter): boolean {
  if (filter.owner !== undefined && obl.owner !== filter.owner) return false;
  if (filter.category !== undefined && obl.category !== filter.category) return false;
  if (filter.kinds !== undefined && !filter.kinds.includes(obl.kind)) return false;
  if (filter.statuses !== undefined && !filter.statuses.includes(obl.status)) return false;
  if (filter.claimId !== undefined && !(obl.subject.claimIds ?? []).includes(filter.claimId)) return false;
  return true;
}

/** Obligations due in fromTurn … toTurn inclusive, by due turn then id (the §13 calendar and §11's forecast). */
export function obligationsInRange(
  state: GameState,
  fromTurn: number,
  toTurn: number,
  filter: ObligationFilter = {},
): Obligation[] {
  return sortedValues(state.permits.obligations)
    .filter((o) => o.dueTurn >= fromTurn && o.dueTurn <= toTurn && matches(o, filter))
    .sort((a, b) => a.dueTurn - b.dueTurn || compareIds(a.id, b.id));
}

/** §6.9 settlement rule (D-6.41; §11 11.4 applies the same rule, D-11.44). */
export function settlementClass(obl: Pick<Obligation, 'owner' | 'consequence'>): 'statutory' | 'billable' {
  if (obl.owner === '§1' || obl.owner === '§5' || obl.owner === '§11') return 'billable';
  const k = obl.consequence.kind;
  return k === 'lateFee' || k === 'escalate' || k === 'default' ? 'billable' : 'statutory';
}
