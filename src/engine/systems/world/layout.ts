// Parcel layout (DESIGN §3.4): valley parcels along each creek, bench parcels beside larger valleys, the reserved
// Inheritor family run, then deposit types (dredged stretches, deep muck, fan and gulch). Stream:
// rng(seed,'world','layout',D.id). Draw order: family-run start (reserving district only); per creek in id order (until
// nTarget): first row, then per valley parcel size / gap u / gap rows, then per bench side side-u / span / start-u /
// offset and per bench parcel its size; fallback benches; then dredgedMaxStretches × (creek u, length, start u); then one
// deep-muck u per valley parcel in emission order.
import { cos, sin } from '../../core/dmath';
import type { Rng } from '../../core/rng';
import { BLOCK_FT, DEG, FT_PER_MI, benchDims, valleyDims } from './constants';
import type { GenCreek, GenDistrict, GenNetwork, ParcelSpec } from './genTypes';
import { ROW_MI, pointAlong, round } from './network';
import { pickKey, uniformIn } from './random';
import type { DepositType, GeoGenParams, PointMi, SizeSetting } from './types';

const SIZE_KEYS = ['20', '40', '80', '160'] as const;
const BENCH_SIZE_KEYS = ['20', '40'] as const;
const FAMILY_RUN_ACRES = 20;

interface BenchSide {
  readonly creek: GenCreek;
  readonly side: -1 | 1;
  readonly span: number;
  readonly startU: number;
  readonly offsetFt: number;
}

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 <= b1 && b0 <= a1;
}

export function layParcels(r: Rng, d: GenDistrict, net: GenNetwork, gp: GeoGenParams): ParcelSpec[] {
  const W = gp.world;
  const tpl = d.tpl;
  const creeks = net.creeks;
  const main = creeks[0] as GenCreek;
  const out: Omit<ParcelSpec, 'depositType'>[] = [];
  const nTarget = d.nTarget;

  // ---- the reserved family run: consecutive 20-ac valley parcels on the main stem, outside every overlay (§3.4, §3.6.1)
  let reserved: [number, number] | null = null;
  if (d.reserveFamilyRun) {
    const dims = valleyDims(FAMILY_RUN_ACRES, main.halfWidthFt);
    const runRows = W.familyRunParcels * dims.nAlong;
    const mainOverlays = net.overlays.filter((o) => o.creekId === main.id);
    const candidates: number[] = [];
    for (let s = 0; s + runRows <= main.rows; s++) {
      if (!mainOverlays.some((o) => overlaps(s, s + runRows - 1, o.rowFrom, o.rowTo))) candidates.push(s);
    }
    if (candidates.length > 0) {
      const s = candidates[r.int(0, candidates.length - 1)] as number;
      reserved = [s, s + runRows];
      for (let k = 0; k < W.familyRunParcels; k++) {
        out.push({
          creekIdx: 0,
          rowStart: s + k * dims.nAlong,
          nAlong: dims.nAlong,
          nAcross: dims.nAcross,
          acres: FAMILY_RUN_ACRES,
          side: 0,
          axisOffsetFt: 0,
          familyRun: true,
        });
      }
    }
  }

  const layBench = (b: BenchSide, limit: number): void => {
    const c = b.creek;
    const spanRows = Math.max(1, Math.floor(b.span * c.rows));
    const start = Math.min(c.rows - spanRows, Math.floor(b.startU * (c.rows - spanRows + 1)));
    let row = start;
    while (row < start + spanRows && out.length < limit) {
      const acres = Number(pickKey(r, BENCH_SIZE_KEYS, tpl.claimSizeMix));
      const dims = benchDims(acres);
      if (row + dims.nAlong > start + spanRows) break;
      out.push({
        creekIdx: c.idx,
        rowStart: row,
        nAlong: dims.nAlong,
        nAcross: dims.nAcross,
        acres,
        side: b.side,
        axisOffsetFt: round(b.side * (c.halfWidthFt + b.offsetFt), 1),
        familyRun: false,
      });
      row += dims.nAlong;
    }
  };

  // ---- creeks in id order (main stem, tributaries by junction, branches) until nTarget parcels exist
  const fallback: BenchSide[] = [];
  let exhausted = true;
  for (const c of creeks) {
    if (out.length >= nTarget) {
      exhausted = false;
      break;
    }
    let row = r.int(0, W.valleyFirstRowMax);
    while (row < c.rows - 4 && out.length < nTarget) {
      const acres = Number(pickKey(r, SIZE_KEYS, tpl.claimSizeMix));
      const gapU = r.next();
      const gapRows = r.int(W.valleyGapRows[0], W.valleyGapRows[1]);
      const dims = valleyDims(acres, c.halfWidthFt);
      if (c.idx === 0 && reserved !== null && row < reserved[1] && row + dims.nAlong > reserved[0]) row = reserved[1];
      if (row + dims.nAlong > c.rows) break;
      out.push({
        creekIdx: c.idx,
        rowStart: row,
        nAlong: dims.nAlong,
        nAcross: dims.nAcross,
        acres,
        side: 0,
        axisOffsetFt: 0,
        familyRun: false,
      });
      row += dims.nAlong + (gapU < W.valleyGapP ? gapRows : 0);
    }
    if (c.order === 1 || c.halfWidthFt >= W.benchMinHalfWidthFt) {
      for (const side of [-1, 1] as const) {
        const sideU = r.next();
        const span = uniformIn(r, W.benchStretchFrac);
        const startU = r.next();
        const offsetFt = uniformIn(r, W.benchOffsetFt);
        const b: BenchSide = { creek: c, side, span, startU, offsetFt };
        if (sideU < (tpl.benchSideP ?? W.benchSideP)) layBench(b, nTarget);
        else fallback.push(b);
      }
    }
  }
  if (out.length >= nTarget) exhausted = false;
  // Floor: when every creek is laid and the district is still short of the template's minimum, benches are added on
  // sides that rolled none (main stem first) until the floor is met or the sides run out.
  if (exhausted && out.length < tpl.parcelsPerDistrict[0]) {
    for (const b of fallback) {
      if (out.length >= tpl.parcelsPerDistrict[0]) break;
      layBench(b, tpl.parcelsPerDistrict[0]);
    }
  }

  return assignDepositTypes(r, out, d, net, gp);
}

/** valleyType (§3.4): dredged stretches until the dredged share of valley parcels reaches its target, then deep muck. */
function assignDepositTypes(
  r: Rng,
  parcels: readonly Omit<ParcelSpec, 'depositType'>[],
  d: GenDistrict,
  net: GenNetwork,
  gp: GeoGenParams,
): ParcelSpec[] {
  const W = gp.world;
  const tpl = d.tpl;
  const creeks = net.creeks;
  const valley = parcels.map((p, i) => ({ p, i })).filter((x) => x.p.side === 0 && !x.p.familyRun);
  const dredged = new Array<boolean>(parcels.length).fill(false);

  // Largest tributary by rows (ties: lowest id); the main stem and it host the dredged stretches.
  let largestTrib = -1;
  for (const c of creeks) {
    if (c.order === 2 && (largestTrib < 0 || c.rows > (creeks[largestTrib] as GenCreek).rows)) largestTrib = c.idx;
  }
  const target = tpl.depositMix.dredgedGround ?? 0;
  const share = (): number =>
    valley.length === 0 ? 1 : valley.filter((x) => dredged[x.i] === true).length / valley.length;
  for (let s = 0; s < W.dredgedMaxStretches; s++) {
    const cu = r.next();
    const lenMi = uniformIn(r, W.dredgedStretchMi);
    const su = r.next();
    if (!(target > 0) || share() >= target - W.dredgedShareTol) continue;
    const ci = cu < 0.5 || largestTrib < 0 ? 0 : largestTrib;
    const c = creeks[ci] as GenCreek;
    const zoneRows = Math.max(1, Math.floor(W.dredgedZoneFrac * c.rows));
    const lenRows = Math.max(1, Math.min(zoneRows, Math.round((lenMi * FT_PER_MI) / BLOCK_FT)));
    const start = Math.min(zoneRows - lenRows, Math.floor(su * (zoneRows - lenRows + 1)));
    for (const x of valley) {
      if (x.p.creekIdx !== ci) continue;
      const mid = x.p.rowStart + x.p.nAlong / 2;
      if (mid >= start && mid < start + lenRows) dredged[x.i] = true;
    }
  }
  // Deep muck w.p. depositMix.deepMuck renormalized over the valley types (§3.4).
  const valleyMix = (tpl.depositMix.creek ?? 0) + (tpl.depositMix.deepMuck ?? 0) + (tpl.depositMix.dredgedGround ?? 0);
  const pDeepMuck = valleyMix > 0 ? (tpl.depositMix.deepMuck ?? 0) / valleyMix : 0;
  const mainRows = (creeks[0] as GenCreek).rows;
  return parcels.map((p, i) => {
    let depositType: DepositType;
    if (p.side !== 0) {
      depositType = 'bench';
    } else {
      const u = r.next();
      if (p.familyRun) depositType = 'creek';
      else if (dredged[i] === true) depositType = 'dredgedGround';
      else if (tpl.valley.kind === 'wash')
        depositType = p.creekIdx === 0 && p.rowStart < tpl.valley.fanLowerFrac * mainRows ? 'desertFan' : 'gulch';
      else depositType = u < pDeepMuck ? 'deepMuck' : 'creek';
    }
    return { ...p, depositType };
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Claim-level visible facts derived from the layout (no draws)
// ---------------------------------------------------------------------------------------------------------------------

/** Proximal reach: the top proximalTopFrac of a creek's rows, or any order-3 creek (§3.5.2). Visible. */
export function isProximal(p: ParcelSpec, c: GenCreek, gp: GeoGenParams): boolean {
  if (c.order === 3) return true;
  const mid = p.rowStart + p.nAlong / 2;
  return mid >= (1 - gp.world.proximalTopFrac) * c.rows;
}

/** The size-mix prior key of a parcel (§3.2, §3.9): bench; fan / gulch on washes; proximal / mid-reach on creeks. */
export function sizeSettingOf(p: ParcelSpec, c: GenCreek, d: GenDistrict, gp: GeoGenParams, mainRows: number): SizeSetting {
  if (p.depositType === 'bench') return 'bench';
  const v = d.tpl.valley;
  if (v.kind === 'wash') return c.idx === 0 && p.rowStart < v.fanLowerFrac * mainRows ? 'fan' : 'gulch';
  return isProximal(p, c, gp) ? 'proximal' : 'midReach';
}

/** Claim centre on the map and its creek heading; a bench sits axisOffsetFt to the right (+) or left (−). */
export function claimPlacement(
  p: ParcelSpec,
  c: GenCreek,
  gp: GeoGenParams,
): { centerMi: PointMi; headingDeg: number; northness: number } {
  const s = (p.rowStart + p.nAlong / 2) * ROW_MI;
  const at = pointAlong(c.points, c.segHeadings, c.lengthMi, gp.world.stepMi, s);
  const offMi = p.axisOffsetFt / FT_PER_MI;
  const right = (at.headingDeg + 90) * DEG;
  const centerMi = { x: round(at.point.x + sin(right) * offMi, 4), y: round(at.point.y + cos(right) * offMi, 4) };
  // §3.4.1: northness = cos(direction the bench slope faces, toward the creek: heading + side·90° + 180°).
  const northness = p.side === 0 ? 0 : cos((at.headingDeg + p.side * 90 + 180) * DEG);
  return { centerMi, headingDeg: at.headingDeg, northness };
}
