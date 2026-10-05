// The public record (DESIGN §3.6): old churn-drill logs and creek histories, plus the records-quality lookup §4's
// records review multiplies its find probability by. All of it is pre-game and changes no Block.state.
import { formatId, type ClaimId } from '../../core/ids';
import type { Rng } from '../../core/rng';
import { BCY_PER_ACRE_FT } from './constants';
import type { GenClaim, GenCreek, GenDistrict } from './genTypes';
import { round } from './network';
import { lnMedian } from './random';
import { UNTOUCHED_BLOCK, drawSample } from './sample';
import type {
  ClaimTruth,
  ClimateBand,
  CreekHistory,
  GeoGenParams,
  OldDrillHole,
  OldTimerKind,
  PublicRecord,
  SurfaceCode,
  WorldSlice,
} from './types';

/**
 * Old drill logs (§3.6): on priorDrillP of claims, one churn-drill line across the valley at row i0, U{3..8} holes,
 * one per block across, wrapping to the next row, drawn with drawSample in fullColumn mode using §4's churnHistoric
 * parameters. Stream rng(seed,'world','drill',K.id); draws: u, i0, hole count, year, then each hole's sample draws.
 */
export function genPriorDrill(
  r: Rng,
  K: GenClaim,
  truth: ClaimTruth,
  surfaceCodes: string,
  climateBand: ClimateBand,
  gp: GeoGenParams,
): OldDrillHole[] | null {
  const R = gp.records;
  const u = r.next();
  const i0 = r.int(0, K.nAlong - 1);
  const nHoles = r.int(R.priorDrillHoles[0], R.priorDrillHoles[1]);
  const year = r.int(R.priorDrillYears[0], R.priorDrillYears[1]);
  if (!(u < R.priorDrillP)) return null;
  const m = R.priorDrillMethod;
  const holes: OldDrillHole[] = [];
  for (let h = 0; h < nHoles; h++) {
    const j = h % K.nAcross;
    const i = (i0 + Math.floor(h / K.nAcross)) % K.nAlong;
    const idx = i * K.nAcross + j;
    const bt = truth.blocks[idx];
    if (bt === undefined) continue;
    const column = bt.payThicknessFt + Math.min(bt.bedrockCleanupFt, m.bedrockPenFt);
    const res = drawSample(
      bt,
      UNTOUCHED_BLOCK,
      { blockId: formatId('blk', K.blockIdBase + idx), volumeBcy: (m.bcyPerFt ?? 0.01) * column },
      m,
      r,
      { surface: (surfaceCodes[idx] ?? 'u') as SurfaceCode, climateBand, physics: gp.sample },
    );
    holes.push({
      blockIdx: idx,
      year,
      reportedGradeOzPerBcy: round(res.reportedGradeOzPerBcy * 1e6, 0) / 1e6,
      depthToBedrockFt: res.observed.depthToBedrockFt === undefined ? null : round(res.observed.depthToBedrockFt, 1),
      payThicknessFt: res.observed.payThicknessFt === undefined ? null : round(res.observed.payThicknessFt, 1),
      colorsBySize: res.colorsBySize,
      volumeMeasuredBcy: round(res.volumeMeasuredBcy, 4),
    });
  }
  return holes;
}

const HISTORIC_KINDS: readonly OldTimerKind[] = ['handCut', 'drift', 'dredge', 'dryWash', 'hydraulic'];

export interface CreekHistoryInput {
  readonly kind: OldTimerKind;
  readonly era: readonly [number, number] | null;
  readonly truth: ClaimTruth;
}

/**
 * Creek history (§3.6, D-3.39), drawn after every claim of the district on rng(seed,'world','creekHist',C.id): yards
 * from the creek's real historic workings (drifters hoisted only the bottom 5 ft of gravel + 1 ft of bedrock) and
 * ounces = yards × historicGradeRatio × the creek's median virgin grade × LN(1, creekProdLogSd). One draw, always taken.
 */
export function genCreekHistory(
  r: Rng,
  c: GenCreek,
  d: GenDistrict,
  parcels: readonly CreekHistoryInput[],
  gp: GeoGenParams,
): CreekHistory | null {
  const ln = lnMedian(r, 1, gp.records.creekProdLogSd);
  if (!c.goldBearing) return null;
  const driftBcy = (gp.oldTimer.driftBottom.topFt + gp.oldTimer.driftBottom.bedrockFt) * BCY_PER_ACRE_FT;
  let histBcy = 0;
  let eraLo = Infinity;
  let eraHi = -Infinity;
  for (const p of parcels) {
    if (!HISTORIC_KINDS.includes(p.kind)) continue;
    let worked = 0;
    for (const b of p.truth.blocks) {
      if (!(b.minedOutFraction > 0)) continue;
      worked++;
      histBcy += p.kind === 'drift' ? driftBcy : (b.payThicknessFt + b.bedrockCleanupFt) * BCY_PER_ACRE_FT;
    }
    if (worked > 0 && p.era !== null) {
      eraLo = Math.min(eraLo, p.era[0]);
      eraHi = Math.max(eraHi, p.era[1]);
    }
  }
  if (!(histBcy > 0)) return null;
  const creekMedianGrade = d.tpl.gMed * d.gradeFactor * c.gradeFactor;
  return {
    histOz: round(histBcy * gp.records.historicGradeRatio * creekMedianGrade * ln, 1),
    histBcy: Math.round(histBcy),
    era: [eraLo, eraHi],
  };
}

/** publicRecord(state, claimId) (§3.6): the claim's stored record plus its creek's history. Engine-side (§4 finds it). */
export function publicRecord(
  world: WorldSlice,
  claimId: ClaimId,
): PublicRecord & { readonly creekHistory: CreekHistory | null } {
  const claim = world.claims[claimId];
  if (claim === undefined) throw new RangeError(`publicRecord: unknown claim ${claimId}`);
  const creek = world.creeks[claim.creekId];
  return { ...claim.hidden.publicRecord, creekHistory: creek?.hidden.history ?? null };
}

/** recordsQuality(state, claimId) = District.recordsQuality × (fly-in ? flyInQualityMult : 1) (§3.6). Visible. */
export function recordsQuality(world: WorldSlice, claimId: ClaimId): number {
  const claim = world.claims[claimId];
  if (claim === undefined) throw new RangeError(`recordsQuality: unknown claim ${claimId}`);
  const d = world.districts[claim.districtId];
  if (d === undefined) throw new RangeError(`recordsQuality: unknown district ${claim.districtId}`);
  return d.recordsQuality * (claim.access === 'flyIn' ? world.genParams.records.flyInQualityMult : 1);
}
