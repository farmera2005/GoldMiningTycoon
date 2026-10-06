// §4 programs in the pipeline (DESIGN §4.12, §4.15, §4.17, §4.18; P1 contract §4.4, §3 parts 3.2, 6.5, 9.1). Step 9
// runs each claim's programs between §7's flow and its close (`runClaimPrograms`, 9 j), with program-first
// reservations of own machines and crew (`programResourceRequests`, read by §7 in 9 f); claims §7 does not operate get
// `runOrphanPrograms` after the last claim. Results go to `ctx.week.knowledge` (machine and crew use, costs,
// disturbance). Contractor delivery is `excavatorPit` only in P1 (s04 #9). Wave-0 stubs run nothing.
import type { ClaimId, MachineId } from '../../core/ids';
import { ZERO_CENTS } from '../../core/money';
import type { GameState, InitCtx } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { ProgramDraft } from './actions';
import type { ProgramPreview, ProgramResourceRequest } from './types';

/** This week's own-delivery requests on a claim, for §7's step 9(f). */
export function programResourceRequests(_state: GameState, _claimId: ClaimId): ProgramResourceRequest[] {
  // CONTRACT-STUB(§4) knowledge.programResourceRequests
  return [];
}

/** Step 9 (j) for one claim; writes `ctx.week.knowledge`. */
export function runClaimPrograms(_draft: GameState, _ctx: StepContext, _claimId: ClaimId): void {
  // CONTRACT-STUB(§4) knowledge.runClaimPrograms
}

/** Step 9, after the last operated claim: programs on claims not in `ops.claimIds`, ascending. */
export function runOrphanPrograms(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§4) knowledge.runOrphanPrograms
}

/** The program planner's preview (S13-9). */
export function previewProgram(_state: GameState, _draft: ProgramDraft): ProgramPreview {
  // CONTRACT-STUB(§4) knowledge.previewProgram
  return { costCents: ZERO_CENTS, weeks: 0, units: 0, disturbedAcres: 0, warnings: [] };
}

/** §9 sold or moved a machine: drop it from program machine lists (S09-15). */
export function onMachineRemoved(_draft: GameState, _machineId: MachineId): void {
  // CONTRACT-STUB(§4) knowledge.onMachineRemoved
}

/** §5 ended a tenure: cancel the claim's programs. */
export function onTenureEnded(_draft: GameState, _claimId: ClaimId): void {
  // CONTRACT-STUB(§4) knowledge.onTenureEnded
}

/** Part 6.5: contractor bookings start, mobilizations, consultant and records-review engagements. */
export function pendingDeals(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§4) knowledge.pendingDeals
}

/** Part 3.2: registered for P3/P5 (contractor and lab markets); nothing in P1. */
export function marketsRefresh(_draft: GameState, _ctx: StepContext): void {
  // Nothing under P1 rules.
}

/** N8b: one pitting contractor per region from data/prospecting/contractors.ts (no draws). */
export function initContractors(_draft: GameState, _init: InitCtx): void {
  // CONTRACT-STUB(§4) knowledge.initContractors
}
