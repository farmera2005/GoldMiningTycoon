// Claim access classes and the access factors (DESIGN §3.3.3, D-3.16, D-3.47). Windows (which modes are open in a
// week) are §1's accessOpen; §3 owns the classes, the cost anchors and their distance scaling.
import { calcResult, node, tuningLeaf, entityLeaf, EXPLAIN_OFF, type Calc, type ExplainCtx } from '../../core/calc';
import { pow } from '../../core/dmath';
import type { ClaimId } from '../../core/ids';
import { ACCESS_CLASSES } from './enums';
import { clamp } from './random';
import type { Access, GeoGenParams, WorldSlice } from './types';

/** One step down the access ladder: highway → seasonalRoad → winterTrail → flyIn. */
export function degradeAccess(a: Access): Access {
  const i = ACCESS_CLASSES.indexOf(a);
  return ACCESS_CLASSES[Math.min(ACCESS_CLASSES.length - 1, i + 1)] as Access;
}

/**
 * A claim's access class (§3.3.3): the district road class, degraded once past trailDegrade1Mi and again past
 * trailDegrade2Mi of trail; no-trail creeks are fly-in; arid districts are capped at seasonalRoad (no winter trails).
 */
export function claimAccessClass(
  roadClass: Access,
  trailMi: number,
  noTrail: boolean,
  arid: boolean,
  gp: GeoGenParams,
  degradeMi: readonly [number, number] = [gp.access.trailDegrade1Mi, gp.access.trailDegrade2Mi],
): Access {
  let a = roadClass;
  if (trailMi > degradeMi[0]) a = degradeAccess(a);
  if (trailMi > degradeMi[1]) a = degradeAccess(a);
  if (noTrail) a = 'flyIn';
  if (arid && ACCESS_CLASSES.indexOf(a) > ACCESS_CLASSES.indexOf('seasonalRoad')) a = 'seasonalRoad';
  return a;
}

export interface AccessFactors {
  readonly access: Access;
  readonly distanceToTownMi: number;
  readonly distScale: number;
  readonly fuelAdderUsdPerGal: number;
  readonly partsLeadWeeks: number;
  /** Already includes distance (§7 mobilization, §4 contractors, §6 RCE use this). */
  readonly mobMult: number;
  /** The class anchor without distance (§9 per-load handling; D-3.47). */
  readonly mobMultClass: number;
}

/** Pure form: s = clamp((distance / refMi)^distExponent, lo, hi) scales every anchor of the class. */
export function accessFactorsFor(access: Access, distanceToTownMi: number, cpiIndex: number, gp: GeoGenParams): AccessFactors {
  const A = gp.access.classes[access];
  const [lo, hi] = gp.access.distScaleClamp;
  const s = clamp(pow(distanceToTownMi / A.refMi, gp.access.distExponent), lo, hi);
  return {
    access,
    distanceToTownMi,
    distScale: s,
    fuelAdderUsdPerGal: A.fuelAdder * s * cpiIndex,
    partsLeadWeeks: A.partsLead * s,
    mobMult: A.mobMult * s,
    mobMultClass: A.mobMult,
  };
}

/** accessFactors(state, claimId) with its explanation (§3.3.3). cpiIndex is §10's (1 until P5). */
export function accessFactors(
  world: WorldSlice,
  claimId: ClaimId,
  cpiIndex = 1,
  ctx: ExplainCtx = EXPLAIN_OFF,
): Calc<AccessFactors> {
  const claim = world.claims[claimId];
  if (claim === undefined) throw new RangeError(`accessFactors: unknown claim ${claimId}`);
  const gp = world.genParams;
  const v = accessFactorsFor(claim.access, claim.distanceToTownMi, cpiIndex, gp);
  const a = claim.access;
  const calc = node(ctx, 'Mobilization multiplier', 'product', 'mult', v.mobMult, [
    tuningLeaf(ctx, `geology.access.${a}.mobMult`, v.mobMultClass, 'mult', `Access class anchor (${a})`),
    node(ctx, 'Distance scale', 'clamp', 'mult', v.distScale, [
      entityLeaf(ctx, { kind: 'claim', id: claimId }, 'Distance to town', claim.distanceToTownMi, 'none'),
      tuningLeaf(ctx, `geology.access.${a}.refMi`, gp.access.classes[a].refMi, 'none', 'Reference distance (mi)'),
      tuningLeaf(ctx, 'geology.access.distExponent', gp.access.distExponent, 'ratio', 'Distance exponent'),
    ]),
  ]);
  return calcResult(v, calc);
}
