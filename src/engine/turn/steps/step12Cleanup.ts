// Step 12 · Cleanup (DESIGN §2.6, D-2.10). Two framework parts run the cross-owner chains (P1 contract §0.6 item 4):
//   12.1 for each due cleanup (claims ascending, then lines ascending): §7 weighCleanup → §5 settleProductionInterests
//        → §10 addLot('cleanup') → §11 drawdownDeferredRevenue → §7 finishCleanup (→ ctx.week.cleanup.results, report)
//        → §4 recordProduction → §12 onCleanup;
//   12.2 §4 weighSampleConcentrates → per weighing: §5 settle → §10 addLot('sample') → §4 afterSampleLot;
// then §10's standing sale orders (12.3) and forward deliveries (12.4, P5) as §10's parts. The §11 drawdowns and §4's
// recordProduction read nothing of each other, so the chain may run them in either order; the declared sub-order test
// swaps them through `ctx.seams.swapDrawdownAndRecordProduction` (D-2.10). The owner functions arrive with their
// contracts; until then the parts change nothing.
import type { GameState } from '../../state/types';
import type { PipelinePart, StepContext, StepDef } from '../types';

function cleanupChain(state: GameState, _ctx: StepContext): GameState {
  return state;
}

function sampleChain(state: GameState, _ctx: StepContext): GameState {
  return state;
}

export const step12Cleanup: StepDef = { index: 12, name: 'Cleanup', sections: [7, 5, 10, 11, 4, 12] };

export const STEP12_PARTS: readonly PipelinePart[] = [
  { id: 'framework.cleanupChain', step: 12, order: 1, section: 2, fromPhase: 1, run: cleanupChain },
  { id: 'framework.sampleChain', step: 12, order: 2, section: 2, fromPhase: 1, run: sampleChain },
];
