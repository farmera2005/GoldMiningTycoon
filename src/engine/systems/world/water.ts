// Water truth per claim (DESIGN §3.3.4, D-3.20). One source kind and one baseline gpm for an average operating week;
// the seasonal shape and weather come only from §1's streamFlowFactor (D-1.8). Stream: rng(seed,'world','water',K.id).
// Draw order — creek templates: base LN, bench lift, fill fraction, right u, right gpm; arid templates: spring u,
// spring LN, well LN, depth LN, fill fraction, bench lift, right u, right gpm. The recorded right is always last.
import type { Rng } from '../../core/rng';
import type { GenClaim, GenCreek, GenDistrict } from './genTypes';
import { round } from './network';
import { byBand } from './params';
import { clamp, lnMedian, uniformIn } from './random';
import type { ClaimWater, GeoGenParams, OldTimerKind, WaterRightStub, WaterSourceKind } from './types';

export function genWater(
  r: Rng,
  K: GenClaim,
  d: GenDistrict,
  c: GenCreek,
  oldTimerKind: OldTimerKind,
  distanceToTownMi: number,
  gp: GeoGenParams,
): ClaimWater {
  const tw = d.tpl.water;
  const Wp = gp.water;
  let sourceKind: WaterSourceKind;
  let baseGpm: number;
  let benchLiftFt = 0;
  let nearestFillMi = 0;
  let wellYieldGpm = 0;
  let depthToWaterFt = 0;
  if (tw.kind === 'creek') {
    const baseLn = lnMedian(r, 1, tw.sig);
    const lift = uniformIn(r, Wp.benchLiftFt);
    uniformIn(r, Wp.nearestFillFrac); // drawn for a fixed order; the creek itself is the fill point
    // Flow ∝ channel miles above the claim (D-3.20); benches pump from the creek.
    const upMi = c.upstreamMiAtRow[K.midRow] ?? 0;
    sourceKind = 'creek';
    baseGpm = Wp.usableFrac * tw.gpmPerUpstreamMi * upMi * baseLn;
    benchLiftFt = K.depositType === 'bench' ? lift : 0;
  } else {
    const springU = r.next();
    const springLn = lnMedian(r, tw.springMedGpm, tw.springSig);
    const wellLn = lnMedian(r, tw.wellMedGpm, tw.wellSig);
    const depthLn = lnMedian(r, tw.depthMedFt, tw.depthSig);
    const fillF = uniformIn(r, Wp.nearestFillFrac);
    uniformIn(r, Wp.benchLiftFt); // arid benches draw from wells and trucks, not a creek lift
    const spring = springU < tw.springP;
    sourceKind = spring ? 'spring' : 'none';
    baseGpm = spring ? Wp.usableFrac * springLn : 0;
    wellYieldGpm = clamp(wellLn, tw.wellClampGpm[0], tw.wellClampGpm[1]);
    depthToWaterFt = clamp(depthLn, tw.depthClampFt[0], tw.depthClampFt[1]);
    nearestFillMi = distanceToTownMi * fillF;
  }
  const rightU = r.next();
  const rightGpm = uniformIn(r, Wp.rightStubGpm);
  const base = {
    sourceKind,
    baseGpm: round(baseGpm, 1),
    benchLiftFt: round(benchLiftFt, 1),
    nearestFillMi: round(nearestFillMi, 2),
    hidden: { wellYieldGpm: round(wellYieldGpm, 1), depthToWaterFt: round(depthToWaterFt, 1) },
  };
  // A recorded senior right on recent-operator claims (§3.3.4, D-3.40); assignStatus clears it on unheld ground. The
  // drawn right is recorded to 0.1 gpm before the low-flow cap is applied, so a surface right never exceeds the stored
  // claim's lowFlowGpm (§3.18), which §6 uses as the grant cap.
  const pRight = byBand(Wp.rightStubP, d.tpl.climateBand, 'geology.water.rightStubP');
  if (oldTimerKind === 'recentCat' && rightU < pRight) {
    const recordedGpm = round(rightGpm, 1);
    const rightStub: WaterRightStub =
      sourceKind === 'creek' || sourceKind === 'spring'
        ? { priority: 'senior', gpm: Math.min(lowFlowGpm(base, gp), recordedGpm), source: 'surface' }
        : { priority: 'senior', gpm: recordedGpm, source: 'groundwater' };
    return { ...base, rightStub };
  }
  return base;
}

/** The climatological low flow (§6's water-grant cap): baseGpm × lowFlowShape[sourceKind]. */
export function lowFlowGpm(water: Pick<ClaimWater, 'sourceKind' | 'baseGpm'>, gp: GeoGenParams): number {
  return water.baseGpm * (gp.water.lowFlowShape[water.sourceKind] ?? 0);
}

// §1 1.5.4 source scaling (owned by §1; constants move to §1's tuning when the climate system lands in P1).
const SPRING_FLOOR = 0.9;
const SPRING_SLOPE = 0.1;
const SPRING_SFF_CAP = 1.5;

/** sourceScale(sourceKind, sff) (§1 1.5.4): creeks and washes follow the hydrograph; springs and wells barely do. */
export function sourceScale(kind: WaterSourceKind, sff: number): number {
  switch (kind) {
    case 'creek':
    case 'ephemeralWash':
      return sff;
    case 'spring':
    case 'well':
      return SPRING_FLOOR + SPRING_SLOPE * Math.min(sff, SPRING_SFF_CAP);
    case 'none':
      return 0;
  }
}

/**
 * The final physical water figure (§3.3.4 waterAvailableGpm) for a given streamFlowFactor and drought multiplier:
 * baseGpm × sourceScale × droughtMult, the drought hook applying to springs and wells only (creek drought already
 * arrives through sff; D-3.47). The state-level wrapper reads sff from §1's weather and the hook from §12 (P1).
 */
export function waterAvailableFromFlow(
  water: Pick<ClaimWater, 'sourceKind' | 'baseGpm'>,
  streamFlowFactor: number,
  droughtMult: number,
): number {
  const drought = water.sourceKind === 'spring' || water.sourceKind === 'well' ? droughtMult : 1;
  return water.baseGpm * sourceScale(water.sourceKind, streamFlowFactor) * drought;
}
