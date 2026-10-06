// Parcel status by selection (DESIGN §3.4) and visible environmental attributes (§3.4.1).
import type { ClaimId } from '../../core/ids';
import type { Rng } from '../../core/rng';
import { BLOCK_FT, HALF_BLOCK_FT } from './constants';
import type { GenClaim, GenCreek, GenDistrict } from './genTypes';
import { round } from './network';
import { clamp, logistic, logit, uniformIn } from './random';
import type {
  BlockTruth,
  ClaimEnv,
  ClaimStatus,
  GeoGenParams,
  LandOverlay,
  LandRegime,
  OldTimerKind,
  SurfaceCode,
  TitleKind,
  WaterSourceKind,
} from './types';
import { log } from '../../core/dmath';

/** True when the parcel's rows on its creek intersect the overlay's stretch. */
export function overlapsOverlay(
  K: { creekIdx: number; rowStart: number; nAlong: number },
  creekId: string,
  o: LandOverlay,
): boolean {
  return o.creekId === creekId && K.rowStart <= o.rowTo && o.rowFrom <= K.rowStart + K.nAlong - 1;
}

/**
 * Ground "reputation" vs the region (§3.4): zq = ln(mean virgin gStreak over the paystreak blocks / gMed) / 0.5,
 * or zqNoPaystreak when the claim has none. Virgin grade already encodes the old-timers' footprint.
 */
export function selectionZ(paystreakGStreaks: readonly number[], gMed: number, gp: GeoGenParams): number {
  if (paystreakGStreaks.length === 0) return gp.world.zqNoPaystreak;
  const mean = paystreakGStreaks.reduce((a, x) => a + x, 0) / paystreakGStreaks.length;
  return log(mean / gMed) / gp.world.zqLnScale;
}

/** P(held) = logistic(logit(stakedFraction) + b × zq), weak slope b on ground whose quality is hard to see. */
export function heldProbability(
  zq: number,
  K: Pick<GenClaim, 'depositType'>,
  stakedFraction: number,
  gp: GeoGenParams,
): number {
  const overlooked = K.depositType === 'bench' || K.depositType === 'deepMuck';
  const b = overlooked ? gp.world.selSlopeOverlooked : gp.world.selSlope;
  return logistic(logit(stakedFraction) + b * zq);
}

/** assignStatus (§3.4). Stream rng(seed,'world','status',K.id); draws: held u, patent u. */
export function assignStatus(
  r: Rng,
  K: GenClaim,
  d: GenDistrict,
  creekId: string,
  overlays: readonly LandOverlay[],
  oldTimerKind: OldTimerKind,
  paystreakGStreaks: readonly number[],
  gp: GeoGenParams,
): { status: ClaimStatus; titleKind: TitleKind; regime: LandRegime } {
  const tpl = d.tpl;
  const pHeld = heldProbability(selectionZ(paystreakGStreaks, tpl.gMed, gp), K, tpl.stakedFraction, gp);
  const heldU = r.next();
  const patentU = r.next();
  let status: ClaimStatus = heldU < pHeld ? 'heldNpc' : 'open';
  // Withdrawals close open ground; held claims keep valid existing rights (D-3.28).
  if (status === 'open' && overlays.some((o) => o.kind === 'withdrawn' && overlapsOverlay(K, creekId, o)))
    status = 'withdrawn';
  const patented = status === 'heldNpc' && oldTimerKind !== 'none' && patentU < tpl.patentedShare;
  return { status, titleKind: patented ? 'patented' : 'unpatented', regime: patented ? 'private' : tpl.regime };
}

/**
 * sensitivity = clamp(base + fish·fishBearing + anadromous + wetland·wetlandShare + special·specialStatus + noise,
 * 0, 1) (§3.4.1; §6 consumes it).
 */
export function sensitivityOf(
  a: { fishBearing: boolean; anadromous: boolean; wetlandShare: number; specialStatus: boolean; noise: number },
  gp: GeoGenParams,
): number {
  const s = gp.env.sensitivity;
  return clamp(
    s.base +
      s.fish * (a.fishBearing ? 1 : 0) +
      s.anadromous * (a.anadromous ? 1 : 0) +
      s.wetlandShare * a.wetlandShare +
      s.specialStatus * (a.specialStatus ? 1 : 0) +
      a.noise,
    0,
    1,
  );
}

/** The column whose 209-ft span contains the channel offset (ft from the valley axis). */
export function channelColumn(offsetFt: number, nAcross: number): number {
  const j = Math.floor((offsetFt + nAcross * HALF_BLOCK_FT) / BLOCK_FT);
  return clamp(j, 0, nAcross - 1);
}

const DISTURBING_KINDS: readonly OldTimerKind[] = ['dredge', 'handCut', 'hydraulic', 'dryWash'];

/**
 * genEnv (§3.4.1) without adjacency (added once the district's parcels exist). Stream rng(seed,'world','env',K.id);
 * draws: channel offset, one wetland u per block (blockIdx order), spring block, sensitivity noise.
 */
export function genEnv(
  r: Rng,
  K: GenClaim,
  c: GenCreek,
  d: GenDistrict,
  overlays: readonly LandOverlay[],
  oldTimerKind: OldTimerKind,
  sourceKind: WaterSourceKind,
  preGameDisturbed: boolean,
  gp: GeoGenParams,
): Omit<ClaimEnv, 'adjacentClaimIds'> {
  const tpl = d.tpl;
  const n = K.nAlong * K.nAcross;
  const offset = uniformIn(r, gp.env.channelOffsetFt);
  const wetU: number[] = [];
  for (let k = 0; k < n; k++) wetU.push(r.next());
  const springPick = r.int(0, n - 1);
  const noise = r.normal(0, gp.env.sensitivity.noiseSd);
  const valley = K.side === 0;
  const chan = valley ? channelColumn(offset, K.nAcross) : -1;
  const pWet = valley ? (tpl.env.wetlandP[K.depositType] ?? 0) : 0;
  const codes: SurfaceCode[] = [];
  for (let k = 0; k < n; k++) {
    const j = k % K.nAcross;
    codes.push(j === chan ? 'c' : (wetU[k] as number) < pWet ? 'w' : 'u');
  }
  if (tpl.env.springWetland && sourceKind === 'spring') {
    // The spring's block is the arid claim's one wetland block; it never displaces the channel column.
    for (let s = 0; s < n; s++) {
      const k = (springPick + s) % n;
      if (codes[k] !== 'c') {
        codes[k] = 'w';
        break;
      }
    }
  }
  const wetlandShare = codes.filter((x) => x === 'w').length / n;
  const fishBearing = valley && c.fishBearing;
  const specialStatus = overlays.some((o) => overlapsOverlay(K, c.id, o));
  return {
    surfaceCodes: codes.join(''),
    fishBearing,
    specialStatus,
    sensitivity: round(
      sensitivityOf({ fishBearing, anadromous: valley && c.anadromous, wetlandShare, specialStatus, noise }, gp),
      4,
    ),
    previouslyDisturbed: preGameDisturbed || DISTURBING_KINDS.includes(oldTimerKind),
    // §3.4.1: bench slope facing north 0.65 … south 1.35; valley bottom 1.0.
    thawAspectMult: valley ? 1 : round(1 - gp.env.aspectThawSlope * K.northness, 4),
  };
}

/** Parcels sharing a block edge (§3.4.1): same creek and touching rows, or a bench beside a valley parcel on shared rows. */
export function adjacentClaims(
  claims: readonly Pick<GenClaim, 'id' | 'creekIdx' | 'side' | 'rowStart' | 'nAlong'>[],
): Record<ClaimId, ClaimId[]> {
  const out = {} as Record<ClaimId, ClaimId[]>;
  for (const a of claims) out[a.id] = [];
  for (let x = 0; x < claims.length; x++) {
    const a = claims[x] as (typeof claims)[number];
    for (let y = x + 1; y < claims.length; y++) {
      const b = claims[y] as (typeof claims)[number];
      if (a.creekIdx !== b.creekIdx) continue;
      const aEnd = a.rowStart + a.nAlong;
      const bEnd = b.rowStart + b.nAlong;
      const touching = aEnd === b.rowStart || bEnd === a.rowStart;
      const shared = a.rowStart < bEnd && b.rowStart < aEnd;
      const adjacent = a.side === b.side ? touching : (a.side === 0 || b.side === 0) && shared;
      if (adjacent) {
        (out[a.id] as ClaimId[]).push(b.id);
        (out[b.id] as ClaimId[]).push(a.id);
      }
    }
  }
  return out;
}

/** Truth-side helper: the decoded paystreak blocks (f ≥ minF). */
export function paystreakIdxs(blocks: readonly BlockTruth[], minF: number): number[] {
  const out: number[] = [];
  blocks.forEach((b, i) => {
    if (b.paystreakFraction >= minF) out.push(i);
  });
  return out;
}
