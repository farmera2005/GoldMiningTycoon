// Step 9 · Operations (DESIGN §2.6): §7 per active claim, ascending id, (a)–(l) with §4 at (j) and §12 in-step
// triggers, plant lines ascending within each hour (D-2.31); then the orphan-program pass. One framework part (9.1)
// runs the cross-owner chain, because owners never call each other's parts (P1 contract §0.6 item 4):
//   for each claim in ops.claimIds ascending: §7 operateClaimFlow (a–i) → §4 runClaimPrograms (j) → §7 closeClaimWeek
//   (k–l, which writes ctx.week.ops.results and WeekReport.ops); then §4 runOrphanPrograms for claims not in
//   ops.claimIds, ascending.
// §12's in-step triggers (`onBlockStripped`, `onBlockMined`) are called by §7 inside its flow.
import { produceState } from '../../state/immutability';
import type { GameState } from '../../state/types';
import { runClaimPrograms, runOrphanPrograms } from '../../systems/knowledge/programs';
import { closeClaimWeek, operateClaimFlow } from '../../systems/ops/flow';
import type { PipelinePart, StepContext, StepDef } from '../types';

function operations(state: GameState, ctx: StepContext): GameState {
  return produceState(state, (draft) => {
    const claimIds = [...draft.ops.claimIds];
    for (const claimId of claimIds) {
      operateClaimFlow(draft, ctx, claimId);
      runClaimPrograms(draft, ctx, claimId);
      closeClaimWeek(draft, ctx, claimId);
    }
    runOrphanPrograms(draft, ctx);
  });
}

export const step09Operations: StepDef = { index: 9, name: 'Operations', sections: [7, 4, 12] };

export const STEP09_PARTS: readonly PipelinePart[] = [
  { id: 'framework.operations', step: 9, order: 1, section: 2, fromPhase: 1, run: operations },
];
