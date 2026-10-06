// Step 12 · Cleanup (DESIGN §2.6, D-2.10). Two framework parts run the cross-owner chains (P1 contract §0.6 item 4):
//   12.1 for each due cleanup (claims ascending, then lines ascending): §7 weighCleanup → §5 settleProductionInterests
//        → §10 addLot('cleanup') → §11 drawdownDeferredRevenue → §7 finishCleanup (its report entry) → §4
//        recordProduction → §12 onCleanup; the chain records each weighing in `ctx.week.cleanup.results` (§2's own
//        scratch member: the cleanup, the fine oz recovered at the lot's estimated fineness and the in-kind take);
//   12.2 §4 weighSampleConcentrates → per weighing: §5 settle → §10 addLot('sample') → §4 afterSampleLot;
// then §10's standing sale orders (12.3) and forward deliveries (12.4, P5) as §10's parts. The §11 drawdowns and §4's
// recordProduction read nothing of each other, so the chain may run them in either order; the declared sub-order test
// swaps them through `ctx.seams.swapDrawdownAndRecordProduction` (D-2.10): §7's finishCleanup and §4's
// recordProduction then run before the drawdowns.
import type { ClaimId, LotId } from '../../core/ids';
import { cloneJson, produceState } from '../../state/immutability';
import type { GameState } from '../../state/types';
import { onCleanup } from '../../systems/events/triggers';
import { drawdownDeferredRevenue } from '../../systems/finance/loans';
import { addLot, claimFinenessKnowledge } from '../../systems/gold/lots';
import { afterSampleLot, recordProduction, weighSampleConcentrates } from '../../systems/knowledge/week';
import { settleProductionInterests } from '../../systems/land/settlement';
import type { Settlement } from '../../systems/land/types';
import { cleanupsDue, finishCleanup, weighCleanup } from '../../systems/ops/flow';
import type { CleanupResult } from '../../systems/ops/types';
import type { PipelinePart, StepContext, StepDef } from '../types';

/** Fine oz per raw oz the player books for a weighing: the new lot's stored estimate, else the claim's knowledge. */
function estFineness(draft: GameState, claimId: ClaimId, lotId: LotId | null): number {
  const lot = lotId === null ? undefined : draft.gold.lots[lotId];
  if (lot !== undefined) return lot.estFineness;
  const k = claimFinenessKnowledge(draft, claimId);
  return k.alloy * (1 - k.dirt);
}

function inKindTake(settlement: Settlement): { rawMilliOz: number; valueCents: number } {
  let rawMilliOz = 0;
  let valueCents = 0;
  for (const d of settlement.deliveries) {
    rawMilliOz += d.rawMilliOz;
    valueCents += d.valueCents;
  }
  return { rawMilliOz, valueCents };
}

function cleanupChain(state: GameState, ctx: StepContext): GameState {
  return produceState(state, (draft) => {
    for (const due of cleanupsDue(draft, ctx)) {
      const turn = draft.clock.turn;
      const weighed = weighCleanup(draft, ctx, due);
      const settlement = settleProductionInterests(draft, due.claimId, {
        rawMilliOz: weighed.weighedRawMilliOz,
        turn,
        source: 'cleanup',
      });
      const lotId =
        settlement.playerRawMilliOz > 0
          ? addLot(draft, {
              claimId: due.claimId,
              rawMilliOz: settlement.playerRawMilliOz,
              trueAlloyFineness: weighed.trueAlloyFineness,
              trueDirtFrac: weighed.trueDirtFrac,
              source: 'cleanup',
            })
          : null;
      let cleanup: CleanupResult;
      if (ctx.seams.swapDrawdownAndRecordProduction) {
        cleanup = finishCleanup(draft, ctx, weighed, settlement, lotId);
        recordProduction(draft, due.claimId, cleanup);
        drawdownDeferredRevenue(draft, due.claimId, settlement, turn);
      } else {
        drawdownDeferredRevenue(draft, due.claimId, settlement, turn);
        cleanup = finishCleanup(draft, ctx, weighed, settlement, lotId);
        recordProduction(draft, due.claimId, cleanup);
      }
      const fineness = estFineness(draft, due.claimId, lotId);
      const take = inKindTake(settlement);
      ctx.week.cleanup.results.push({
        claimId: due.claimId,
        // A copy, so no draft value outlives the produce that made it.
        result: cloneJson(cleanup),
        fineOzRecovered: (weighed.weighedRawMilliOz / 1000) * fineness,
        inKindFineOz: (take.rawMilliOz / 1000) * fineness,
        inKindValueCents: take.valueCents as Settlement['deliveries'][number]['valueCents'],
      });
      onCleanup(draft, ctx, { claimId: due.claimId, lineId: due.lineId, cleanup });
    }
  });
}

function sampleChain(state: GameState, ctx: StepContext): GameState {
  return produceState(state, (draft) => {
    for (const w of weighSampleConcentrates(draft, ctx)) {
      const settlement = settleProductionInterests(draft, w.claimId, {
        rawMilliOz: w.rawMilliOz,
        turn: draft.clock.turn,
        source: 'sample',
      });
      const lotId =
        settlement.playerRawMilliOz > 0
          ? addLot(draft, {
              claimId: w.claimId,
              rawMilliOz: settlement.playerRawMilliOz,
              trueAlloyFineness: w.trueAlloyFineness,
              trueDirtFrac: w.trueDirtFrac,
              source: 'sample',
            })
          : null;
      afterSampleLot(draft, ctx, w.claimId, lotId);
    }
  });
}

export const step12Cleanup: StepDef = { index: 12, name: 'Cleanup', sections: [7, 5, 10, 11, 4, 12] };

export const STEP12_PARTS: readonly PipelinePart[] = [
  { id: 'framework.cleanupChain', step: 12, order: 1, section: 2, fromPhase: 1, run: cleanupChain },
  { id: 'framework.sampleChain', step: 12, order: 2, section: 2, fromPhase: 1, run: sampleChain },
];
