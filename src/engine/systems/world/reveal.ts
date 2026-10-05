// The dev reveal (DESIGN §3.12 debug/revealTruth, §2.5): overlays truth on a claim's block grid. Pure; dev builds and
// the end-of-run reveal only. Never called by selectors, validators or bots.
import { formatId, type ClaimId } from '../../core/ids';
import { templateOf } from './params';
import { claimTruth } from './query';
import { refEconomics, type RefEconResult } from './refEconomics';
import type {
  BlockState,
  ClaimTruth,
  DepositType,
  OldTimerKind,
  PermitStubStatus,
  SellerHonesty,
  TrueSeason,
  WorldSlice,
} from './types';

export interface RevealedClaim {
  readonly claimId: ClaimId;
  readonly depositType: DepositType;
  readonly oldTimerKind: OldTimerKind;
  readonly oldTimerEra: readonly [number, number] | null;
  readonly econ: RefEconResult;
  readonly truth: ClaimTruth;
  /** Block states in blockIdx order (null = untouched). */
  readonly blockStates: readonly (BlockState | null)[];
  readonly trueHistory: readonly TrueSeason[];
  readonly permitStub: { readonly status: PermitStubStatus; readonly bondPostedCents: number | null };
  readonly water: { readonly wellYieldGpm: number; readonly depthToWaterFt: number };
  readonly holderHonesty: SellerHonesty | null;
}

export function revealTruth(world: WorldSlice, claimId: ClaimId): RevealedClaim {
  const claim = world.claims[claimId];
  if (claim === undefined) throw new RangeError(`revealTruth: unknown claim ${claimId}`);
  const d = world.districts[claim.districtId];
  if (d === undefined) throw new RangeError(`revealTruth: unknown district ${claim.districtId}`);
  const truth = claimTruth(world, claimId);
  const states = truth.blocks.map((_, idx) => world.blockStates[formatId('blk', claim.blockIdBase + idx)] ?? null);
  const band = templateOf(world.genParams, d.templateId).climateBand;
  const econ = refEconomics(truth, (idx) => states[idx] ?? undefined, band, world.genParams.refEcon);
  const holder =
    typeof claim.holderId === 'string' && claim.holderId.startsWith('hld_')
      ? world.holders[claim.holderId as keyof WorldSlice['holders']]
      : undefined;
  return {
    claimId,
    depositType: claim.hidden.depositType,
    oldTimerKind: claim.hidden.oldTimerKind,
    oldTimerEra: claim.hidden.oldTimerEra,
    econ,
    truth,
    blockStates: states,
    trueHistory: claim.hidden.trueHistory,
    permitStub: claim.hidden.permitStub,
    water: claim.water.hidden,
    holderHonesty: holder?.honesty ?? null,
  };
}
