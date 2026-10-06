// DESIGN §7 7.11 operating costs and the 7.12 site-task prices. §7 computes each week's cost lines in USD (floats); §11
// rounds once when it posts them (CLAUDE.md money rule) and pays them by its priority rules. Waiting machines burn fuel and
// meter hours at ops.idleEngineRunShare, so bottlenecks cost money, not just output (D-7.16).
import { calcResult, type Calc } from '../../../core/calc';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { LoadTask, OpsKernelParams } from './params';
import type { AccessClass, CampTier, SiteStatusK } from './types';

/** §9 fuelBurnGalHr load factor of a task (7.11: strip/dig/haul/plant 1.0, ripping 1.15, feed 0.85). */
export function taskLoadFactor(task: LoadTask, p: OpsKernelParams): number {
  return p.taskLoadFactor[task];
}

/** SMR (meter) hours: work + wait × ops.idleEngineRunShare; program hours are excluded (§9 adds them, D-7.44). */
export function smrHours(workHours: number, waitHours: number, p: OpsKernelParams): number {
  return Math.max(0, workHours) + Math.max(0, waitHours) * p.idleEngineRunShare;
}

export interface MachineFuelInput {
  workHours: number;
  waitHours: number;
  /** §9 fuelBurnGalHr(m, task load factor). */
  burnAtTaskGalHr: number;
  /** §9 fuelBurnGalHr(m, ops.idleLoadFactor). */
  burnAtIdleGalHr: number;
}

/** A machine's week of fuel: work × burn(task lf) + wait × ops.idleEngineRunShare × burn(idle lf) (7.11). */
export function machineFuelGal(input: MachineFuelInput, p: OpsKernelParams): number {
  return (
    Math.max(0, input.workHours) * input.burnAtTaskGalHr +
    Math.max(0, input.waitHours) * p.idleEngineRunShare * input.burnAtIdleGalHr
  );
}

/**
 * Person-days on site (s07 #23): (§8 field crew housed at the claim, standby included, + the owner when assigned there)
 * × 7 while the site is neither none nor winterized.
 */
export function personDaysOnSite(fieldCrewHoused: number, ownerOnSite: boolean, site: SiteStatusK): number {
  if (site === 'none' || site === 'winterized') return 0;
  return (Math.max(0, fieldCrewHoused) + (ownerOnSite ? 1 : 0)) * 7;
}

/** Camp genset, heat and pickups: person-days × ops.campFuelGalPerPersonDay. */
export function campFuelGal(personDays: number, p: OpsKernelParams): number {
  return Math.max(0, personDays) * p.campFuelGalPerPersonDay;
}

/**
 * Night lighting: night-shift hours × ops.nightLightGalPerHr, except in a northern claim's midnight-sun weeks
 * (ops.nightLightFreeWeeksNorth, week of year, inclusive).
 */
export function nightLightingGal(
  nightHours: number,
  weekOfYear: number,
  northern: boolean,
  p: OpsKernelParams,
): number {
  const [from, to] = p.nightLightFreeWeeksNorth;
  if (northern && weekOfYear >= from && weekOfYear <= to) return 0;
  return Math.max(0, nightHours) * p.nightLightGalPerHr;
}

/**
 * Delivered diesel (7.11.2): rack + the freight adder × the fuel-adder hook (the hook multiplies the adder, never the
 * rack price). P1–P2 buy just in time at the claim's normal freight mode.
 */
export function deliveredFuelUsdPerGal(rackUsdPerGal: number, adderUsdPerGal: number, adderMult: number): number {
  return rackUsdPerGal + adderUsdPerGal * adderMult;
}

export interface ConsumablesInput {
  washedBcy: number;
  dugBcy: number;
  /** Frozen or bedrock bcy among the dug (each costs × ops.getFrozenMult). */
  dugHardBcy: number;
  strippedBcy: number;
  /** Frozen bcy among the stripped. */
  strippedFrozenBcy: number;
  cpiIndex: number;
}

/**
 * Consumables (7.11): washed × ops.consumablesUsdPerBcyWashed + dug × ops.getUsdPerBcyDug + stripped ×
 * ops.getUsdPerBcyStripped, with frozen or bedrock bcy at × ops.getFrozenMult on their ground-engaging tools; × cpi.
 */
export function consumablesUsd(
  input: ConsumablesInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  const hardExtra = p.getFrozenMult - 1;
  const washed = Math.max(0, input.washedBcy) * p.consumablesUsdPerBcyWashed;
  const dug = (Math.max(0, input.dugBcy) + Math.max(0, input.dugHardBcy) * hardExtra) * p.getUsdPerBcyDug;
  const stripped =
    (Math.max(0, input.strippedBcy) + Math.max(0, input.strippedFrozenBcy) * hardExtra) * p.getUsdPerBcyStripped;
  const v = (washed + dug + stripped) * input.cpiIndex;
  const calc = ex.on
    ? kNode(ex, 'Consumables', 'sum', 'usd', v, [
        kNode(ex, 'Screens, mats, nozzles', 'product', 'usd', washed * input.cpiIndex, [
          kLeaf(ex, 'Washed', input.washedBcy, 'bcy'),
          kTune(ex, 'ops.consumablesUsdPerBcyWashed', p.consumablesUsdPerBcyWashed, 'usdPerBcy', 'Per bcy washed'),
        ]),
        kNode(ex, 'Digging tools', 'product', 'usd', dug * input.cpiIndex, [
          kLeaf(ex, 'Dug', input.dugBcy, 'bcy'),
          kLeaf(ex, 'Of which frozen or bedrock', input.dugHardBcy, 'bcy'),
          kTune(ex, 'ops.getUsdPerBcyDug', p.getUsdPerBcyDug, 'usdPerBcy', 'Per bcy dug'),
        ]),
        kNode(ex, 'Stripping tools', 'product', 'usd', stripped * input.cpiIndex, [
          kLeaf(ex, 'Stripped', input.strippedBcy, 'bcy'),
          kLeaf(ex, 'Of which frozen', input.strippedFrozenBcy, 'bcy'),
          kTune(ex, 'ops.getUsdPerBcyStripped', p.getUsdPerBcyStripped, 'usdPerBcy', 'Per bcy stripped'),
        ]),
        kTune(ex, 'ops.getFrozenMult', p.getFrozenMult, 'mult', 'Frozen or bedrock wear'),
        kLeaf(ex, 'Cost index', input.cpiIndex, 'index'),
      ])
    : undefined;
  return calcResult(v, calc);
}

export interface CampCostInput {
  personDays: number;
  tier: CampTier;
  cpiIndex: number;
  /** The camp-cost hook value for the claim. */
  costMult: number;
  winter: boolean;
}

/**
 * Camp (7.11, D-7.21): person-days × ops.campUsdPerPersonDay × ops.campTierMult[tier] × cpi × the hook, × the winter
 * multiplier in the winter phase.
 */
export function campUsd(input: CampCostInput, p: OpsKernelParams, ex: KernelExplainCtx = KEX_OFF): Calc<number> {
  const tierMult = p.campTierMult[input.tier];
  const winter = input.winter ? p.winterCampMult : 1;
  const v = Math.max(0, input.personDays) * p.campUsdPerPersonDay * tierMult * input.cpiIndex * input.costMult * winter;
  const calc = ex.on
    ? kNode(ex, 'Camp', 'product', 'usd', v, [
        kLeaf(ex, 'Person-days on site', input.personDays, 'days'),
        kTune(ex, 'ops.campUsdPerPersonDay', p.campUsdPerPersonDay, 'usdPerDay', 'Per person-day'),
        kTune(ex, `ops.campTierMult.${input.tier}`, tierMult, 'mult', `Camp tier (${input.tier})`),
        kLeaf(ex, 'Cost index', input.cpiIndex, 'index'),
        kLeaf(ex, 'Events', input.costMult, 'mult'),
        input.winter ? kTune(ex, 'ops.winterCampMult', winter, 'mult', 'Winter') : undefined,
      ])
    : undefined;
  return calcResult(v, calc);
}

/** Site fixed costs (comms, propane, sanitation, small tools): ops.siteFixedUsdPerWeek × cpi while site ∉ {none, winterized}. */
export function siteFixedUsd(site: SiteStatusK, cpiIndex: number, p: OpsKernelParams): number {
  return site === 'none' || site === 'winterized' ? 0 : p.siteFixedUsdPerWeek * cpiIndex;
}

/** Water trucking: trucks per day × scheduled days × ops.waterTruckDayRateUsd × cpi × the trucking-cost hook. */
export function waterTruckingUsd(
  trucksPerDay: number,
  daysScheduled: number,
  cpiIndex: number,
  costMult: number,
  p: OpsKernelParams,
): number {
  return Math.max(0, trucksPerDay) * Math.max(0, daysScheduled) * p.waterTruckDayRateUsd * cpiIndex * costMult;
}

/** Mobilization (7.12): ops.siteMobBaseUsd × §3 accessFactors.mobMult (distance included) × cpi. */
export function mobilizationUsd(mobMult: number, cpiIndex: number, p: OpsKernelParams): number {
  return p.siteMobBaseUsd * mobMult * cpiIndex;
}

/** Demobilization: ops.siteDemobShare × mobilization. */
export function demobilizationUsd(mobMult: number, cpiIndex: number, p: OpsKernelParams): number {
  return p.siteDemobShare * mobilizationUsd(mobMult, cpiIndex, p);
}

/** Mobilization weeks by access class (ops.siteMobWeeks). */
export function mobilizationWeeks(access: AccessClass, p: OpsKernelParams): number {
  return p.siteMobWeeks[access];
}

export interface SiteMobilization {
  usd: number;
  weeks: number;
  demobUsd: number;
}

/** Mobilizing a site (7.12): price, duration and the later demobilization price, with the price's explanation. */
export function siteMobilization(
  input: { mobMult: number; cpiIndex: number; access: AccessClass },
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<SiteMobilization> {
  const usd = mobilizationUsd(input.mobMult, input.cpiIndex, p);
  const v: SiteMobilization = {
    usd,
    weeks: mobilizationWeeks(input.access, p),
    demobUsd: p.siteDemobShare * usd,
  };
  const calc = ex.on
    ? kNode(ex, 'Site mobilization', 'product', 'usd', usd, [
        kTune(ex, 'ops.siteMobBaseUsd', p.siteMobBaseUsd, 'usd', 'Camp, day tank, pad and water lines'),
        kLeaf(ex, `Access and distance (${input.access})`, input.mobMult, 'mult'),
        kLeaf(ex, 'Cost index', input.cpiIndex, 'index'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** Winterizing: ops.winterizeUsd × cpi (drain lines, pumps and plant; park machines; close camp). */
export function winterizeUsd(cpiIndex: number, p: OpsKernelParams): number {
  return p.winterizeUsd * cpiIndex;
}

/** Revegetation: ops.revegUsdPerAcre × acres seeded × cpi (tagged reclamation). */
export function revegetationUsd(acres: number, cpiIndex: number, p: OpsKernelParams): number {
  return Math.max(0, acres) * p.revegUsdPerAcre * cpiIndex;
}

export interface WeekCostInput {
  /** Σ machine fuel (machineFuelGal) + well pumps + night lighting, gallons. */
  machineFuelGal: number;
  personDays: number;
  deliveredUsdPerGal: number;
  consumables: ConsumablesInput;
  campTier: CampTier;
  campCostMult: number;
  winter: boolean;
  site: SiteStatusK;
  waterTrucksPerDay: number;
  daysScheduled: number;
  waterTruckCostMult: number;
  cpiIndex: number;
}

export interface WeekCosts {
  fuelGal: number;
  fuelUsd: number;
  consumablesUsd: number;
  campUsd: number;
  siteFixedUsd: number;
  waterTruckingUsd: number;
  /** Σ of the lines above (maintenance and wages are §9's and §8's). */
  totalUsd: number;
}

/** The §7 cost lines of a claim-week (7.11, the 7.11.1 worked example), before §11 rounds and posts them. */
export function weekOpsCosts(
  input: WeekCostInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<WeekCosts> {
  const fuelGal = Math.max(0, input.machineFuelGal) + campFuelGal(input.personDays, p);
  const fuelUsd = fuelGal * input.deliveredUsdPerGal;
  const cons = consumablesUsd(input.consumables, p, ex);
  const camp = campUsd(
    {
      personDays: input.personDays,
      tier: input.campTier,
      cpiIndex: input.cpiIndex,
      costMult: input.campCostMult,
      winter: input.winter,
    },
    p,
    ex,
  );
  const fixed = siteFixedUsd(input.site, input.cpiIndex, p);
  const trucking = waterTruckingUsd(
    input.waterTrucksPerDay,
    input.daysScheduled,
    input.cpiIndex,
    input.waterTruckCostMult,
    p,
  );
  const v: WeekCosts = {
    fuelGal,
    fuelUsd,
    consumablesUsd: cons.value,
    campUsd: camp.value,
    siteFixedUsd: fixed,
    waterTruckingUsd: trucking,
    totalUsd: fuelUsd + cons.value + camp.value + fixed + trucking,
  };
  const calc = ex.on
    ? kNode(ex, 'Site operating costs', 'sum', 'usd', v.totalUsd, [
        kNode(ex, 'Fuel', 'product', 'usd', fuelUsd, [
          kLeaf(ex, 'Machines, well pumps and lights', input.machineFuelGal, 'gal'),
          kNode(ex, 'Camp fuel', 'product', 'gal', campFuelGal(input.personDays, p), [
            kTune(ex, 'ops.campFuelGalPerPersonDay', p.campFuelGalPerPersonDay, 'gal', 'Per person-day'),
          ]),
          kLeaf(ex, 'Delivered price', input.deliveredUsdPerGal, 'usdPerGal'),
        ]),
        cons.calc,
        camp.calc,
        kNode(ex, 'Site fixed', 'product', 'usd', fixed, [
          kTune(ex, 'ops.siteFixedUsdPerWeek', p.siteFixedUsdPerWeek, 'usdPerWeek', 'Per week on site'),
          kLeaf(ex, 'Cost index', input.cpiIndex, 'index'),
        ]),
        input.waterTrucksPerDay > 0
          ? kNode(ex, 'Water trucking', 'product', 'usd', trucking, [
              kLeaf(ex, 'Trucks per day', input.waterTrucksPerDay, 'count'),
              kLeaf(ex, 'Days scheduled', input.daysScheduled, 'days'),
              kTune(ex, 'ops.waterTruckDayRateUsd', p.waterTruckDayRateUsd, 'usdPerDay', 'Truck day rate'),
            ])
          : undefined,
      ])
    : undefined;
  return calcResult(v, calc);
}
