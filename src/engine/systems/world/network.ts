// Districts, creek networks and land overlays (DESIGN §3.3.1, §3.3.2). Every draw count is fixed (stream rule e): the
// polyline jitters are drawn for the longest possible creek, and every tributary and branch slot takes its geometry,
// attribute and name draws even when unused, so a retuned probability, count or length never shifts a later draw.
import { cos, sin } from '../../core/dmath';
import type { CreekId, DistrictId } from '../../core/ids';
import type { Rng } from '../../core/rng';
import { BLOCK_FT, DEG, FT_PER_MI } from './constants';
import { ACCESS_CLASSES, TOWN_TIERS } from './enums';
import type { GenCreek, GenDistrict, GenNetwork } from './genTypes';
import { clamp, intIn, lnMedian, pickKey, uniform, uniformIn } from './random';
import type { GeoGenParams, LandOverlay, PointMi, RegionTemplate } from './types';

/** Compass bearing pointing into the map from each edge: south, east, north, west. */
const INWARD_BY_EDGE = [0, 270, 180, 90] as const;

export const ROW_MI = BLOCK_FT / FT_PER_MI;

export function round(x: number, places: number): number {
  const f = places === 0 ? 1 : places === 1 ? 10 : places === 2 ? 100 : places === 3 ? 1000 : 10000;
  return Math.round(x * f) / f;
}

function normDeg(d: number): number {
  const m = d % 360;
  return m < 0 ? m + 360 : m;
}

/** A name from `pool` not yet in `used` (draw one index, then probe forward deterministically). One u32. */
export function pickUniqueName(r: Rng, pool: readonly string[], used: readonly string[]): string {
  const n = pool.length;
  const k = r.int(0, Math.max(0, n - 1));
  for (let d = 0; d < n; d++) {
    const s = pool[(k + d) % n] as string;
    if (!used.includes(s)) return s;
  }
  return `${pool[k] ?? 'Unnamed'} ${used.length + 1}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// genDistrict (§3.3.1): factors, road, town, hub, outlet, nTarget. Stream: rng(seed,'world','district',d).
// Draw order: gradeFactor, obFactor, finenessMean, roadClass, winter-maintained u, town tier, town road mi, hub road mi,
// nTarget, outlet edge, outlet position, district name, town name, hub name.
// ---------------------------------------------------------------------------------------------------------------------

export interface DistrictGenArgs {
  readonly id: DistrictId;
  readonly index: number;
  readonly districtCount: number;
  readonly parcelsCap: number | undefined;
  readonly usedDistrictNames: readonly string[];
  readonly reserveFamilyRun: boolean;
}

export function genDistrict(r: Rng, tpl: RegionTemplate, gp: GeoGenParams, a: DistrictGenArgs): GenDistrict {
  const gradeFactor = lnMedian(r, 1, tpl.sigma.district);
  const obFactor = lnMedian(r, 1, tpl.overburden.sig[0]);
  const finenessMean = clamp(r.normal(tpl.fineness.mean, tpl.fineness.districtSd), tpl.fineness.lo, tpl.fineness.hi);
  const roadClass = pickKey(r, ACCESS_CLASSES, tpl.districtRoadMix);
  const winterU = r.next();
  const roadWinterMaintained = roadClass === 'highway' || winterU < tpl.roadWinterMaintainedP;
  const townTier = pickKey(r, TOWN_TIERS, tpl.townTierMix);
  const townRoadMi = uniformIn(r, tpl.townRoadMi);
  const hubRoadMi = uniformIn(r, tpl.hubRoadMi);
  const nDraw = intIn(r, tpl.parcelsPerDistrict);
  // §3.1: D.nTarget = min(U{parcelsPerDistrict}, floor(maxClaims / districtCount)), plus the optional caller cap.
  let nTarget = Math.min(nDraw, Math.floor(gp.world.maxClaims / a.districtCount));
  if (a.parcelsCap !== undefined) nTarget = Math.min(nTarget, a.parcelsCap);
  const edge = r.int(0, 3);
  const along = uniformIn(r, gp.world.outletEdgeFrac);
  const name = pickUniqueName(r, tpl.names.districts, a.usedDistrictNames);
  const townName = pickUniqueName(r, tpl.names.towns, []);
  const hubName = pickUniqueName(r, tpl.names.hubs, []);
  const [w, h] = gp.world.mapMi;
  const outlet: PointMi =
    edge === 0
      ? { x: along * w, y: 0 }
      : edge === 1
        ? { x: w, y: along * h }
        : edge === 2
          ? { x: along * w, y: h }
          : { x: 0, y: along * h };
  const inwardDeg = INWARD_BY_EDGE[edge] as number;
  // The town lies outside the map, down the access road (roads wind like trails, so straight-line < road miles).
  const straight = townRoadMi / gp.world.trailTortuosity;
  const townPos = {
    x: round(outlet.x - sin(inwardDeg * DEG) * straight, 3),
    y: round(outlet.y - cos(inwardDeg * DEG) * straight, 3),
  };
  return {
    index: a.index,
    id: a.id,
    tpl,
    name,
    gradeFactor,
    obFactor,
    finenessMean,
    roadClass,
    roadWinterMaintained,
    townTier,
    townName,
    townRoadMi: round(townRoadMi, 2),
    hubName,
    hubRoadMi: round(hubRoadMi, 1),
    outlet: { x: round(outlet.x, 4), y: round(outlet.y, 4) },
    inwardDeg,
    townPos,
    nTarget,
    reserveFamilyRun: a.reserveFamilyRun,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Polylines
// ---------------------------------------------------------------------------------------------------------------------

function drawJitters(r: Rng, n: number, sdDeg: number): number[] {
  const out: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = r.normal(0, sdDeg);
  return out;
}

interface Polyline {
  readonly points: PointMi[];
  readonly segHeadings: number[];
}

/** 0.25-mi steps, heading += jitter per step, reflected 1 mi inside the map edge (§3.3.1). Pure. */
export function buildPolyline(
  start: PointMi,
  headingDeg: number,
  lengthMi: number,
  jitters: readonly number[],
  gp: GeoGenParams,
): Polyline {
  const step = gp.world.stepMi;
  const [w, h] = gp.world.mapMi;
  const m = gp.world.edgeMarginMi;
  const nSeg = Math.max(1, Math.ceil(lengthMi / step - 1e-9));
  const points: PointMi[] = [{ x: round(start.x, 4), y: round(start.y, 4) }];
  const segHeadings: number[] = [];
  let p = start;
  let hd = headingDeg;
  for (let s = 0; s < nSeg; s++) {
    hd = normDeg(hd + (jitters[s] ?? 0));
    const len = Math.min(step, lengthMi - s * step);
    let dx = sin(hd * DEG) * len;
    let dy = cos(hd * DEG) * len;
    if ((p.x + dx < m && dx < 0) || (p.x + dx > w - m && dx > 0)) hd = normDeg(-hd);
    if ((p.y + dy < m && dy < 0) || (p.y + dy > h - m && dy > 0)) hd = normDeg(180 - hd);
    dx = sin(hd * DEG) * len;
    dy = cos(hd * DEG) * len;
    p = { x: clamp(p.x + dx, 0, w), y: clamp(p.y + dy, 0, h) };
    points.push({ x: round(p.x, 4), y: round(p.y, 4) });
    segHeadings.push(round(hd, 2));
  }
  return { points, segHeadings };
}

/** Point and heading at arc length s (mi) along a polyline of nominal `step` segments. */
export function pointAlong(
  points: readonly PointMi[],
  segHeadings: readonly number[],
  lengthMi: number,
  step: number,
  s: number,
): { point: PointMi; headingDeg: number } {
  const nSeg = segHeadings.length;
  const sc = clamp(s, 0, lengthMi);
  const k = Math.min(nSeg - 1, Math.floor(sc / step));
  const segLen = k === nSeg - 1 ? Math.max(1e-9, lengthMi - k * step) : step;
  const t = clamp((sc - k * step) / segLen, 0, 1);
  const a = points[k] as PointMi;
  const b = points[k + 1] as PointMi;
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, headingDeg: segHeadings[k] as number };
}

// ---------------------------------------------------------------------------------------------------------------------
// genCreekNetwork (§3.3.1). Stream: rng(seed,'world','creeks',D.id). Draw order (fixed; nothing below depends on the
// realized tributary count, lengths or branch rolls):
//   main: heading offset, length, maxMainSteps jitters;
//   tributaries: count, nTribMax position fractions, first side u, then per slot (nTribMax slots): angle, length,
//     maxTribSteps jitters, branch u, branch position, branch angle, branch side u, branch length, maxBranchSteps jitters;
//   attributes, per fixed slot (1 + 2·nTribMax slots: the main stem, tributary slots 0…nTribMax−1, then branch slots
//     0…nTribMax−1, used or not): half-width (the slot order's range), gold u, grade factor LN, no-trail u, fish u,
//     anadromous u;
//   overlays: withdrawn u, fraction, start u; special u, tributary index, fraction, start u;
//   names: one per fixed slot in the same slot order, unique across all slots (a pick probes forward with no further
//     draw).
// A realized creek takes its slot's attributes and name: the main stem slot 0, the tributary drawn in slot i the
// tributary slot i (tributaries are renumbered by junction position afterwards), its branch the branch slot i.
// ---------------------------------------------------------------------------------------------------------------------

interface CreekGeom {
  readonly order: 1 | 2 | 3;
  readonly parentGeom: number | null;
  readonly posOnParentMi: number;
  readonly lengthMi: number;
  readonly poly: Polyline;
  /** The fixed draw slot whose attributes and name the creek takes (see the draw order above). */
  readonly slot: number;
}

/** The stream order of each fixed slot: the main stem, nSlots tributary slots, then nSlots branch slots. */
function slotOrderList(nSlots: number): (1 | 2 | 3)[] {
  const out: (1 | 2 | 3)[] = [1];
  for (let i = 0; i < nSlots; i++) out.push(2);
  for (let i = 0; i < nSlots; i++) out.push(3);
  return out;
}

interface CreekAttr {
  readonly halfWidthFt: number;
  readonly goldBearing: boolean;
  readonly gradeFactor: number;
  readonly noTrail: boolean;
  readonly fishBearing: boolean;
  readonly anadromous: boolean;
}

/** One slot's attribute draws (§3.3.1), all six taken whatever they decide: 12 u32. */
function drawCreekAttr(r: Rng, order: 1 | 2 | 3, tpl: RegionTemplate, gp: GeoGenParams): CreekAttr {
  const W = gp.world;
  const halfWidthFt = uniformIn(r, W.valleyHalfWidthFt[order - 1] as readonly [number, number]);
  const goldU = r.next();
  const gf = lnMedian(r, 1, tpl.sigma.creek);
  const noTrailU = r.next();
  const fishU = r.next();
  const anadU = r.next();
  const goldBearing = goldU >= W.barrenCreekP;
  const fishBearing = fishU < (tpl.env.fishByOrder[order - 1] as number);
  return {
    halfWidthFt: round(halfWidthFt, 1),
    goldBearing,
    gradeFactor: goldBearing ? gf : W.barrenCreekFactor,
    noTrail: order >= 2 && noTrailU < W.noTrailCreekP,
    fishBearing,
    anadromous: order === 1 && fishBearing && anadU < tpl.env.anadromousP,
  };
}

export function genCreekNetwork(r: Rng, d: GenDistrict, gp: GeoGenParams, nextCreekId: () => CreekId): GenNetwork {
  const W = gp.world;
  const tpl = d.tpl;
  const step = W.stepMi;
  const maxSteps = (hiMi: number): number => Math.ceil(hiMi / step - 1e-9);

  // ---- main stem
  const mainHeading = d.inwardDeg + uniform(r, -W.mainHeadingJitterDeg, W.mainHeadingJitterDeg);
  const mainLen = uniformIn(r, W.mainLengthMi);
  const mainJit = drawJitters(r, maxSteps(W.mainLengthMi[1]), W.headingStepSdDeg);
  const mainPoly = buildPolyline(d.outlet, mainHeading, mainLen, mainJit, gp);

  // ---- tributary slots (all drawn)
  const nTrib = intIn(r, W.nTrib);
  const nSlots = W.nTrib[1];
  const posFrac: number[] = [];
  for (let i = 0; i < nSlots; i++) posFrac.push(uniformIn(r, W.tribPosFrac));
  const firstSide = r.next() < 0.5 ? -1 : 1;
  interface Slot {
    angle: number;
    len: number;
    jit: number[];
    branchU: number;
    branchPos: number;
    branchAngle: number;
    branchSide: -1 | 1;
    branchLen: number;
    branchJit: number[];
  }
  const slots: Slot[] = [];
  for (let i = 0; i < nSlots; i++) {
    const angle = uniformIn(r, W.tribAngleDeg);
    const len = uniformIn(r, W.tribLengthMi);
    const jit = drawJitters(r, maxSteps(W.tribLengthMi[1]), W.headingStepSdDeg);
    const branchU = r.next();
    const branchPos = uniformIn(r, W.branchPosFrac);
    const branchAngle = uniformIn(r, W.tribAngleDeg);
    const branchSide = r.next() < 0.5 ? -1 : 1;
    const branchLen = uniformIn(r, W.branchLengthMi);
    const branchJit = drawJitters(r, maxSteps(W.branchLengthMi[1]), W.headingStepSdDeg);
    slots.push({ angle, len, jit, branchU, branchPos, branchAngle, branchSide, branchLen, branchJit });
  }

  // Junction positions: the first nTrib slots, sorted along the main stem, then spaced ≥ tribMinSpacingMi apart inside
  // [lo, hi] of the main length (a forward then a backward pass; always feasible at the template lengths).
  const used = slots.slice(0, nTrib).map((s, i) => ({ s, slot: i, pos: (posFrac[i] as number) * mainLen }));
  used.sort((a, b) => a.pos - b.pos);
  const lo = W.tribPosFrac[0] * mainLen;
  const hi = W.tribPosFrac[1] * mainLen;
  for (let i = 1; i < used.length; i++) {
    const prev = (used[i - 1] as { pos: number }).pos;
    const cur = used[i] as { pos: number };
    if (cur.pos < prev + W.tribMinSpacingMi) cur.pos = prev + W.tribMinSpacingMi;
  }
  for (let i = used.length - 1; i >= 0; i--) {
    const cur = used[i] as { pos: number };
    const cap = i === used.length - 1 ? hi : (used[i + 1] as { pos: number }).pos - W.tribMinSpacingMi;
    if (cur.pos > cap) cur.pos = cap;
    if (cur.pos < lo) cur.pos = lo;
  }

  // Fixed slot numbering for the attribute and name draws: 0 the main stem, 1 + i tributary slot i, 1 + nSlots + i the
  // branch of tributary slot i.
  const geoms: CreekGeom[] = [
    { order: 1, parentGeom: null, posOnParentMi: 0, lengthMi: mainLen, poly: mainPoly, slot: 0 },
  ];
  const tribGeomIdx: number[] = [];
  used.forEach((u, k) => {
    const side = k % 2 === 0 ? firstSide : -firstSide;
    const at = pointAlong(mainPoly.points, mainPoly.segHeadings, mainLen, step, u.pos);
    const poly = buildPolyline(at.point, at.headingDeg + side * u.s.angle, u.s.len, u.s.jit, gp);
    tribGeomIdx.push(geoms.length);
    geoms.push({ order: 2, parentGeom: 0, posOnParentMi: u.pos, lengthMi: u.s.len, poly, slot: 1 + u.slot });
  });
  used.forEach((u, k) => {
    if (!(u.s.branchU < W.branchP)) return;
    const parent = tribGeomIdx[k] as number;
    const pg = geoms[parent] as CreekGeom;
    const pos = u.s.branchPos * pg.lengthMi;
    const at = pointAlong(pg.poly.points, pg.poly.segHeadings, pg.lengthMi, step, pos);
    const poly = buildPolyline(
      at.point,
      at.headingDeg + u.s.branchSide * u.s.branchAngle,
      u.s.branchLen,
      u.s.branchJit,
      gp,
    );
    geoms.push({
      order: 3,
      parentGeom: parent,
      posOnParentMi: pos,
      lengthMi: u.s.branchLen,
      poly,
      slot: 1 + nSlots + u.slot,
    });
  });

  // ---- attributes, drawn for every fixed slot (used or not) and read by slot
  const rowsOf = (lenMi: number): number => Math.ceil((lenMi * FT_PER_MI) / BLOCK_FT - 1e-9);
  const slotOrders = slotOrderList(nSlots);
  const slotAttrs: CreekAttr[] = slotOrders.map((order) => drawCreekAttr(r, order, tpl, gp));
  const attrs: CreekAttr[] = geoms.map((g) => slotAttrs[g.slot] as CreekAttr);

  const ids = geoms.map(() => nextCreekId());
  const rows = geoms.map((g) => rowsOf(g.lengthMi));
  const junctionRow = geoms.map((g) =>
    g.parentGeom === null
      ? null
      : Math.min((rows[g.parentGeom] as number) - 1, Math.floor((g.posOnParentMi * FT_PER_MI) / BLOCK_FT)),
  );
  const mouthMi: number[] = [];
  geoms.forEach((g, i) => {
    mouthMi[i] = g.parentGeom === null ? 0 : (mouthMi[g.parentGeom] as number) + g.posOnParentMi;
  });

  // ---- overlays (draws always taken)
  const overlays: LandOverlay[] = [];
  const wU = r.next();
  const wFrac = uniformIn(r, W.withdrawnStretchFrac);
  const wStartU = r.next();
  const sU = r.next();
  const tribPick = r.int(0, Math.max(0, tribGeomIdx.length - 1));
  const sFrac = uniformIn(r, tpl.valley.kind === 'wash' ? tpl.valley.specialFanFrac : W.specialStretchFrac);
  const sStartU = r.next();
  const stretch = (nRows: number, frac: number, startU: number): [number, number] => {
    const n = Math.max(1, Math.min(nRows, Math.round(frac * nRows)));
    const start = Math.min(nRows - n, Math.floor(startU * (nRows - n + 1)));
    return [start, start + n - 1];
  };
  if (wU < tpl.overlayP.withdrawn) {
    const [from, to] = stretch(rows[0] as number, wFrac, wStartU);
    overlays.push({
      kind: 'withdrawn',
      label: tpl.overlayLabels.withdrawn,
      creekId: ids[0] as CreekId,
      rowFrom: from,
      rowTo: to,
    });
  }
  if (sU < tpl.overlayP.specialStatus) {
    if (tpl.valley.kind === 'wash') {
      // Arid: the tortoise-habitat stretch lies on the fan rows of the main stem (§3.3.1).
      const fanRows = Math.max(1, Math.floor(tpl.valley.overlayFanMainFrac * (rows[0] as number)));
      const [from, to] = stretch(fanRows, sFrac, sStartU);
      overlays.push({
        kind: 'specialStatus',
        label: tpl.overlayLabels.specialStatus,
        creekId: ids[0] as CreekId,
        rowFrom: from,
        rowTo: to,
      });
    } else if (tribGeomIdx.length > 0) {
      const gi = tribGeomIdx[tribPick] as number;
      const [from, to] = stretch(rows[gi] as number, sFrac, sStartU);
      overlays.push({
        kind: 'specialStatus',
        label: tpl.overlayLabels.specialStatus,
        creekId: ids[gi] as CreekId,
        rowFrom: from,
        rowTo: to,
      });
      // "a random tributary and its branch": the branch joins the overlay when it heads inside the stretch.
      geoms.forEach((g, bi) => {
        const jr = junctionRow[bi];
        if (g.parentGeom === gi && jr !== null && jr !== undefined && jr >= from && jr <= to) {
          overlays.push({
            kind: 'specialStatus',
            label: tpl.overlayLabels.specialStatus,
            creekId: ids[bi] as CreekId,
            rowFrom: 0,
            rowTo: (rows[bi] as number) - 1,
          });
        }
      });
    }
  }

  // ---- names: one per fixed slot, unique across all slots, so a realized creek's name never depends on which other
  // slots were realized
  const slotNames: string[] = [];
  for (let k = 0; k < slotOrders.length; k++) slotNames.push(pickUniqueName(r, tpl.names.creeks, slotNames));
  const names = geoms.map((g) => creekDisplayName(slotNames[g.slot] as string, g.order, tpl));

  // ---- upstream channel miles per row (water, map)
  const subtreeMi: number[] = geoms.map((g) => g.lengthMi);
  for (let i = geoms.length - 1; i >= 0; i--) {
    const pgi = (geoms[i] as CreekGeom).parentGeom;
    if (pgi !== null) subtreeMi[pgi] = (subtreeMi[pgi] as number) + (subtreeMi[i] as number);
  }
  const creeks: GenCreek[] = geoms.map((g, i) => {
    const n = rows[i] as number;
    const up: number[] = new Array<number>(n);
    for (let row = 0; row < n; row++) {
      let mi = Math.max(0, g.lengthMi - (row + 0.5) * ROW_MI);
      geoms.forEach((c, ci) => {
        const jr = junctionRow[ci];
        if (c.parentGeom === i && jr !== null && jr !== undefined && jr >= row) mi += subtreeMi[ci] as number;
      });
      up[row] = round(mi, 3);
    }
    const a = attrs[i] as CreekAttr;
    return {
      idx: i,
      id: ids[i] as CreekId,
      order: g.order,
      parentIdx: g.parentGeom,
      junctionRow: junctionRow[i] ?? null,
      lengthMi: round(g.lengthMi, 4),
      rows: n,
      halfWidthFt: a.halfWidthFt,
      points: g.poly.points,
      segHeadings: g.poly.segHeadings,
      mouthMiFromOutlet: round(mouthMi[i] as number, 4),
      upstreamMiAtRow: up,
      goldBearing: a.goldBearing,
      gradeFactor: a.gradeFactor,
      noTrail: a.noTrail,
      fishBearing: a.fishBearing,
      anadromous: a.anadromous,
      name: names[i] as string,
    };
  });
  return { creeks, overlays };
}

function creekDisplayName(base: string, order: 1 | 2 | 3, tpl: RegionTemplate): string {
  if (tpl.valley.kind === 'wash') return base.endsWith('Wash') ? base : `${base} ${order === 3 ? 'Canyon' : 'Wash'}`;
  return `${base} ${order === 3 ? 'Gulch' : 'Creek'}`;
}
