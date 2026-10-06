// §7 the site and its readers for other sections (DESIGN §7.1, §7.6.8, §7.11.2, §7.13, §7.19; s05 #13, s07 #7, #10;
// P1 contract §4.7, §3 parts 6.6, 16.8). `siteStatus`, `maxPlantLines`, `planLineOf`, `fuelOnHandGal` and
// `pondFreeboardFrac` are real P1 forms (P1 has no fuel stock and no ponds); `ground` re-exports the kernel's
// `groundTaskMult` (OpsKernelParams form) and `groundTaskMultForTuning`, and `REFERENCE_GROUND` (ops-kernel delta).
import { ContractStubError } from '../../core/assert';
import { LINE_IDS, type ClaimId, type LineId, type MachineId } from '../../core/ids';
import type { FixtureSpec } from '../../state/fixture';
import { rulesAtLeast } from '../../state/rules';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { TenureEndReason } from '../land/types';
import type { DisturbanceLedger, MinePlan, SiteStatus } from './types';

export { REFERENCE_GROUND, groundTaskMult, groundTaskMultForTuning } from './kernel';

/** The claim's site; 'none' without a ClaimOps. */
export function siteStatus(state: GameState, claimId: ClaimId): SiteStatus {
  return state.ops.claims[claimId]?.site ?? 'none';
}

/** Plant lines a claim may run: 1 under rules < 3 (several lines are P3). */
export function maxPlantLines(state: GameState, _claimId: ClaimId): number {
  return rulesAtLeast(state, 3) ? LINE_IDS.length : 1;
}

/** The plan line a machine serves, or null (shared roles and unassigned machines). */
export function planLineOf(plan: Pick<MinePlan, 'lines'>, machineId: MachineId): LineId | null {
  for (const line of plan.lines) {
    if (line.plantMachineId === machineId || line.machineIds.includes(machineId)) return line.lineId;
  }
  return null;
}

/** P1: no on-site fuel stock. */
export function fuelOnHandGal(_state: GameState, _claimId: ClaimId): number {
  return 0;
}

/** P1: no ponds, so never short of freeboard. */
export function pondFreeboardFrac(_state: GameState, _claimId: ClaimId): number {
  return 1;
}

export function disturbance(_state: GameState, _claimId: ClaimId): DisturbanceLedger {
  // CONTRACT-STUB(§7) ops.disturbance
  return {
    disturbedAcres: 0,
    reclaimedAcres: 0,
    openAcres: 0,
    byFeature: { block: 0, dump: 0, tailings: 0, pond: 0, site: 0, road: 0 },
  };
}

/** §6's water-use reading (P2 consumer). */
export function opsWaterUse(_state: GameState, _claimId: ClaimId): { avgGpm: number; peakGpm: number } {
  // CONTRACT-STUB(§7) ops.opsWaterUse
  return { avgGpm: 0, peakGpm: 0 };
}

export function thawingStrippedAcres(_state: GameState, _claimId: ClaimId): number {
  // CONTRACT-STUB(§7) ops.thawingStrippedAcres
  return 0;
}

export function campStaffed(_state: GameState, _claimId: ClaimId): boolean {
  // CONTRACT-STUB(§7) ops.campStaffed
  return false;
}

/** Engine-only (hidden box gold; §12 theft, P5). */
export function boxGoldRawOz(_state: GameState, _claimId: ClaimId): number {
  // CONTRACT-STUB(§7) ops.boxGoldRawOz
  return 0;
}

/** Engine-only (§12 theft exposure, P5). */
export function theftExposure(_state: GameState, _claimId: ClaimId): number {
  // CONTRACT-STUB(§7) ops.theftExposure
  return 0;
}

/** Part 6.6: site tasks counted in weeks (mobilizing → ready, demobilizing → none); well drilling completes. */
export function siteTasks(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§7) ops.siteTasks
}

/** Part 16.8: the `ops.*` alerts and the season-end summary. */
export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§7) ops.wrapUp
}

/** §5 ended the tenure: stand down; pad and box gold → `lostOnTenureEndRawOz`; status 'left' (s05 #13). */
export function onTenureEnded(_draft: GameState, _claimId: ClaimId, _reason: TenureEndReason): void {
  // CONTRACT-STUB(§7) ops.onTenureEnded
}

/** §9 sold or moved a machine: drop it from assignments and lines (S09-15). */
export function onMachineRemoved(_draft: GameState, _machineId: MachineId): void {
  // CONTRACT-STUB(§7) ops.onMachineRemoved
}

/** §1 N9 (Inheritor): the family claim's site winterized with its camp and pre-stripped blocks (s01 #18, s07 #7). */
export function initInheritedSite(_draft: GameState, _claimId: ClaimId): void {
  // CONTRACT-STUB(§7) ops.initInheritedSite
}

/** A fixture game's site, strip-ahead and plan (BALANCE §2.1). Creation stub. */
export function fixtureSite(
  _draft: GameState,
  _claimId: ClaimId,
  _site: FixtureSpec['site'],
  _stripAheadBlocks: number,
  _plan: FixtureSpec['plan'],
): void {
  // CONTRACT-STUB(§7) ops.fixtureSite
  throw new ContractStubError('ops.fixtureSite');
}
