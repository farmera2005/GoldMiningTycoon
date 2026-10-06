// Registry of effect hooks: every value an event may change is read through effective() (DESIGN §2.10, §12 12.3).
// Rows are owned by the reading section; the registry is the union of every owner's published hook list (S12-5), each
// row with the phase its consumer ships in, its base and the ops and scope dimensions modifiers may use (S12-14,
// P1 contract §1.9). P0 shipped the empty registry; P1 Wave 0 (contracts-data) wrote every row of 12.3, whatever its
// consumer phase (D-12.54), so a writer never targets an unregistered key. tests/data/hooks.test.ts checks the rows.
import type { RulesPhase } from '../../engine/state/types';
import type { TuningKey } from '../tuning';

export type HookOp = 'mul' | 'add' | 'set';

/**
 * The dimensions a modifier on this hook may be scoped by (the reading formula's query carries all of them).
 * 'company' marks a hook DESIGN scopes to the world or company (an unscoped modifier); 'block' is a blockIds scope.
 */
export type HookScopeDim =
  'company' | 'district' | 'claim' | 'block' | 'machine' | 'model' | 'brand' | 'employee' | 'lender' | 'regime';

export interface HookDef {
  readonly key: string;
  readonly ownerSection: number;
  readonly unit: string;
  /** The value with no modifier when `base` is 'neutral' (1 for `*Mult`, 0 for `*Add`). */
  readonly neutral: number;
  readonly ops: readonly HookOp[];
  readonly scopeDims: readonly HookScopeDim[];
  /** 'tuning': the base is the resolved tuning value of `baseKey` (or of `key` itself); 'neutral': `neutral`. */
  readonly base: 'neutral' | 'tuning';
  /** For a set-only hook whose base lives under another key (e.g. `permits.noticeMaxAcresSet` → `…noticeMaxAcres`). */
  readonly baseKey?: TuningKey;
  /** The rules phase whose consumer first reads the hook through effective() (S12-6); writers may come later. */
  readonly consumerPhase: RulesPhase;
  readonly mulBounds?: readonly [number, number];
  readonly addBounds?: readonly [number, number];
  readonly setBounds?: readonly [number, number];
}

type Scope = readonly HookScopeDim[];
type Extra = Partial<Pick<HookDef, 'base' | 'baseKey' | 'mulBounds' | 'addBounds' | 'setBounds'>>;

/** A multiplier hook: neutral 1, op mul (12.3: `*Mult` → mul). */
function mul(
  key: string,
  ownerSection: number,
  scopeDims: Scope,
  consumerPhase: RulesPhase,
  extra: Extra = {},
): HookDef {
  return {
    key,
    ownerSection,
    unit: '×',
    neutral: 1,
    ops: ['mul'],
    scopeDims,
    base: 'neutral',
    consumerPhase,
    ...extra,
  };
}

/** An additive hook: neutral 0, op add (12.3: `*Add` → add), in the hook's own unit. */
function add(
  key: string,
  ownerSection: number,
  unit: string,
  scopeDims: Scope,
  consumerPhase: RulesPhase,
  extra: Extra = {},
): HookDef {
  return { key, ownerSection, unit, neutral: 0, ops: ['add'], scopeDims, base: 'neutral', consumerPhase, ...extra };
}

/** A set-only hook (a flag or a share): 12.3 says which value is neutral. */
function set(
  key: string,
  ownerSection: number,
  unit: string,
  neutral: number,
  scopeDims: Scope,
  consumerPhase: RulesPhase,
  extra: Extra = {},
): HookDef {
  return { key, ownerSection, unit, neutral, ops: ['set'], scopeDims, base: 'neutral', consumerPhase, ...extra };
}

/** Difficulty-scaled tuning keys that are also hooks: events multiply the resolved value, never replace it (12.3). */
const TUNING_BASE: Extra = { base: 'tuning' };

const SITE: Scope = ['district', 'claim'];
const MACHINE: Scope = ['district', 'claim', 'machine', 'model', 'brand'];

export const hookRegistry: readonly HookDef[] = [
  // ---- §1 climate and access (1.4.4, 1.4.5)
  add('season.breakupShiftWeeks', 1, 'weeks', ['district'], 1),
  add('season.freezeUpShiftWeeks', 1, 'weeks', ['district'], 1),
  set('access.roadOpen', 1, 'flag', 1, ['district'], 1),
  set('access.airOpen', 1, 'flag', 1, ['district'], 1),

  // ---- §3 world (3.14), applied by §1 accessOpen and the step-3 supply hazard
  set('geology.access.closed', 3, 'flag', 0, SITE, 1),
  mul('geology.supply.listingHazardMult', 3, ['district'], 1),

  // ---- §4 prospecting (4.18)
  mul('prospect.rateMult', 4, ['claim'], 1),
  mul('prospect.pitStopProbMult', 4, SITE, 1),
  mul('prospect.recordsFindMult', 4, SITE, 1),
  mul('prospect.consultantLeadMult', 4, SITE, 1),
  mul('prospect.contractorCostMult', 4, SITE, 1),
  mul('prospect.contractorLeadTimeMult', 4, ['district'], 1),
  add('prospect.labTurnaroundWeeksAdd', 4, 'weeks', ['company'], 3),

  // ---- §5 land (5.17); m_t takes land.sellerMotivationAdd (5.3, s05 #22)
  mul('land.askPriceMult', 5, ['district'], 1),
  mul('land.rivalSaleMult', 5, ['district'], 1),
  add('land.sellerMotivationAdd', 5, 'motivation', ['district'], 1),
  mul('land.distressedShareMult', 5, ['district'], 5),
  mul('land.titleDefectRateMult', 5, ['district'], 5, TUNING_BASE),
  mul('land.stakeConflictMult', 5, ['district'], 2),

  // ---- §6 permits (6.17)
  mul('permits.reviewTimeMult', 6, ['district', 'regime', 'claim'], 2, TUNING_BASE),
  mul('permits.inspectionRateMult', 6, SITE, 2),
  mul('permits.complaintRateMult', 6, SITE, 2),
  mul('permits.detectionMult', 6, SITE, 2),
  mul('permits.exceedanceMult', 6, ['claim'], 2),
  mul('permits.maxWaterGpmMult', 6, SITE, 2),
  mul('permits.agencyWorkloadMult', 6, ['district'], 2),
  mul('permits.bondRateMult', 6, ['regime'], 2),
  // (200 + add) × feeUnits per maintenance unit; the ruleChange fee variant is permanent.
  add('permits.feeAdd.maintenance', 6, 'USD/unit', ['regime'], 2, { addBounds: [0, 300] }),
  // Replaces the notice-tier acreage cap (base §6 permits.noticeMaxAcres 5).
  set('permits.noticeMaxAcresSet', 6, 'acres', 5, ['regime'], 2, {
    base: 'tuning',
    baseKey: 'permits.noticeMaxAcres',
    setBounds: [0, 160],
  }),
  mul('permits.yukon.securityFracMult', 6, ['regime'], 6),

  // ---- §7 operations (7.19; all 15 registered in P1, s07 #14)
  { ...mul('ops.hoursMult', 7, SITE, 1), ops: ['mul', 'set'] },
  mul('ops.productivityMult', 7, SITE, 1),
  mul('ops.plantCapacityMult', 7, SITE, 1),
  mul('ops.thawMult', 7, SITE, 1),
  mul('ops.recoveryLossExpMult', 7, SITE, 1),
  // Multiplies the haul cycle time.
  mul('ops.haulCycleMult', 7, ['claim'], 1),
  mul('ops.campCostMult', 7, ['claim'], 1),
  mul('ops.campCapacityMult', 7, ['claim'], 1),
  // §3's spring and well sources and §7's drilled-well yield (creek claims feel drought through §1's sff instead).
  mul('ops.waterAvailableMult', 7, SITE, 1),
  // Multiplies ops.waterTruckDayRateUsd.
  mul('ops.waterTruckCostMult', 7, ['district'], 1),
  // Multiplies the fuel freight adder, not the rack price.
  mul('ops.fuelAdderMult', 7, SITE, 1, { mulBounds: [1, 4] }),
  set('ops.blockLocked', 7, 'flag', 0, ['claim', 'block'], 1),
  set('ops.fuelSupplyFrac', 7, 'share', 1, SITE, 3),
  mul('ops.freezeDamageProbMult', 7, ['district'], 3),
  mul('ops.highGradeProbMult', 7, ['company', 'claim'], 5),

  // ---- §8 staff (8.16; all six, S08-1)
  mul('staff.wageAskMult', 8, ['district'], 1, TUNING_BASE),
  mul('staff.poolSizeMult', 8, ['district'], 1, TUNING_BASE),
  set('staff.crewAvailableFrac', 8, 'share', 1, ['company', 'claim'], 1),
  mul('staff.quitHazardMult', 8, ['district', 'claim', 'employee'], 1, TUNING_BASE),
  add('staff.moraleTargetAdd', 8, 'points', ['district', 'claim', 'employee'], 1, { addBounds: [-10, 10] }),
  mul('staff.injuryHazardMult', 8, ['claim'], 2),

  // ---- §9 fleet (9.13)
  mul('fleet.rateMult', 9, MACHINE, 1),
  mul('fleet.fuelBurnMult', 9, MACHINE, 1),
  mul('fleet.transportCostMult', 9, ['district'], 1),
  mul('fleet.usedPriceMult', 9, ['district'], 1),
  add('fleet.newLeadAddWeeks', 9, 'weeks', ['company', 'brand'], 1),
  set('fleet.machineGrounded', 9, 'flag', 0, ['model', 'machine'], 3),
  mul('fleet.failureHazardMult', 9, ['model', 'machine'], 3, TUNING_BASE),
  mul('fleet.partsLeadTimeMult', 9, ['company', 'brand', 'claim'], 3),
  mul('fleet.partsPriceMult', 9, ['company', 'brand'], 3),
  mul('fleet.wearMult', 9, ['district', 'machine'], 3),
  mul('fleet.fieldServiceDelayMult', 9, ['district', 'machine'], 3),
  mul('fleet.auctionSupplyMult', 9, ['district'], 3),
  mul('fleet.rentalAvailMult', 9, ['district'], 3),

  // ---- §10 gold (10.17; S10-10)
  add('market.localBuyerDiscountAdd', 10, 'share of spot', ['company', 'district', 'claim'], 1, {
    addBounds: [-0.05, 0.15],
  }),
  mul('market.theftHazardMult', 10, ['district'], 5),
  mul('market.shippingCostMult', 10, ['district'], 5),
  mul('market.localBuyerCapMult', 10, ['district'], 5),
  add('market.refineryTransitWeeksAdd', 10, 'weeks', ['company'], 5),

  // ---- §11 finance (11.23)
  add('finance.lenderSpreadAdd', 11, 'rate /yr', ['lender', 'company'], 4),
  add('finance.lenderMaxLtvAdd', 11, 'LTV', ['lender', 'company'], 4),
  add('finance.lenderAppetiteShift', 11, 'U points', ['lender', 'company'], 4),
  mul('finance.lineLimitMult', 11, ['lender'], 4),
  mul('finance.insurancePremiumMult', 11, ['company'], 4),
  mul('finance.vendor.limitMult', 11, ['company'], 4),
  // Open-ended: §11 ends it when wage arrears and damages reach zero.
  set('finance.wageLienSweep', 11, 'flag', 0, ['company'], 4),
];
