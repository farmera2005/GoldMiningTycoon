// §2 history pipeline parts (DESIGN §2.6; P1 contract §3) and its init part N11 (contract §1.5). The weekly snapshot is
// a framework part in step 16 (step16WrapUp.ts); this folder adds no step part. N11 writes the pre-history and the
// turn-0 snapshot once every other init part has run.
import { initPart } from '../../state/partKit';
import type { GameState, InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { companySnapshot, marketSnapshot, preHistory } from './snapshot';

export const HISTORY_PARTS: readonly PipelinePart[] = [];

/** N11: §10's flat pre-history (P0–P4) and the turn-0 snapshot. */
function initHistory(draft: GameState): void {
  draft.history.weekly = preHistory(draft.meta.tuning);
  draft.history.weekly.push({ turn: 0, market: marketSnapshot(draft), company: companySnapshot(draft) });
}

export const HISTORY_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'history.init', order: 11, section: 2, fromPhase: 0 }, initHistory),
];
