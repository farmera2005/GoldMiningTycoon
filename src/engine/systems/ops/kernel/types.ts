// Types of the §7 operations kernel (DESIGN §7 7.3–7.11). The kernel is a library of pure formulas: it takes explicit
// numbers and small records and never reads GameState, so the flow (ops-flow), the visible projection (ops-visible), §4
// programs and §9 previews all run the same physics. The unions below mirror DESIGN's; where §7's slice types
// (ops/types.ts) name the same thing, the shapes are identical so a value of one is a value of the other.
import type { SizeClass, SizeRecord } from '../../world/enums';

export type { SizeClass, SizeRecord };

/** §1 1.5 weekly temperature band (WeatherWeek.tempBand). */
export type TempBand = 'deepCold' | 'cold' | 'cool' | 'mild' | 'hot';
export const TEMP_BANDS: readonly TempBand[] = ['deepCold', 'cold', 'cool', 'mild', 'hot'];

/** §1 1.5 weekly precipitation class (WeatherWeek.precip). */
export type PrecipBand = 'dry' | 'normal' | 'wet' | 'storm';
export const PRECIP_BANDS: readonly PrecipBand[] = ['dry', 'normal', 'wet', 'storm'];

/** §1 1.4.2 season phase. */
export type SeasonPhaseK = 'winter' | 'breakup' | 'operating' | 'freezeup';

/** §9 wash-plant feed preparation (catalog `spec.prep`; a derocker counts as grizzly). */
export type Prep = 'trommel' | 'shakerDeck' | 'grizzly' | 'dryWasher';
export const PREPS: readonly Prep[] = ['trommel', 'shakerDeck', 'grizzly', 'dryWasher'];

/** §9 camp tiers (9.2.4, `campSummary.tier`). */
export type CampTier = 'basic' | 'standard' | 'good' | 'premium';
export const CAMP_TIERS: readonly CampTier[] = ['basic', 'standard', 'good', 'premium'];

/** §3 claim access classes (3.3.3), best to worst. */
export type AccessClass = 'highway' | 'seasonalRoad' | 'winterTrail' | 'flyIn';
export const ACCESS_CLASSES_K: readonly AccessClass[] = ['highway', 'seasonalRoad', 'winterTrail', 'flyIn'];

/** §3 climate band (template), the key of `ops.makeupFrac`. */
export type ClimateBandK = 'subarctic' | 'arid' | 'temperateMontane';
export const CLIMATE_BANDS_K: readonly ClimateBandK[] = ['subarctic', 'arid', 'temperateMontane'];

/** §7 7.2 pay-contact policy. */
export type PayTopPolicy = 'tight' | 'standard' | 'generous';
export const PAY_TOP_POLICIES: readonly PayTopPolicy[] = ['tight', 'standard', 'generous'];

/** §7 7.2 machine role in a mine plan. */
export type OpsRoleK = 'strip' | 'dig' | 'haul' | 'feed' | 'plant' | 'water' | 'power' | 'support' | 'reclaim';

/** §7 7.3 `BlockOps.surface`. */
export type BlockSurface =
  'vegetated' | 'cleared' | 'stripping' | 'payExposed' | 'minedOut' | 'backfilled' | 'reclaimed';

/** Surface classes the thaw keys are tabled by (7.4): stripping and exposed pay share the `stripped` row. */
export type ThawSurface = 'vegetated' | 'cleared' | 'stripped';
export const THAW_SURFACES: readonly ThawSurface[] = ['vegetated', 'cleared', 'stripped'];

/** Recovery devices of 7.9's base-capture table. */
export type CaptureDevice = 'sluice' | 'jig' | 'centrifuge' | 'dryWasher';
export const CAPTURE_DEVICES: readonly CaptureDevice[] = ['sluice', 'jig', 'centrifuge', 'dryWasher'];

/** A §9 `recovery`-class concentrator on a plant line (7.9). */
export type ConcentratorDevice = 'jig' | 'centrifuge';

/** §7 7.16 recovery circuit key. */
export type CircuitKey = 'sluice' | 'sluice+jig' | 'sluice+centrifuge' | 'sluice+jig+centrifuge' | 'dryWasher';

/** §7 7.6.4 / 7.16 feed mode. 'none' = the line has no plant (strip or dig to stockpile only). */
export type FeedMode = 'padLoader' | 'truckDirect' | 'excavatorDirect' | 'none';

/** §7 strip-machine kinds, in the order the thawed pool is handed out (7.6.1: worst frozen performer first). */
export type StripMachineKind = 'dozerNoRipper' | 'excavator' | 'dozerRipper';
export const STRIP_THAWED_ORDER: readonly StripMachineKind[] = ['dozerNoRipper', 'excavator', 'dozerRipper'];

/** §8 8.12 supervisor kinds (`foremanFor().kind`). */
export type SupervisorKind = 'hired' | 'owner' | 'leadHand' | 'smallCrew' | 'none';

/** §7 7.1 site status. */
export type SiteStatusK = 'none' | 'mobilizing' | 'ready' | 'running' | 'winterizing' | 'winterized' | 'demobilizing';

/**
 * §7 7.16 `GroundCtx`: the ground a machine works, handed to §9 (wear, `machineEffectiveRate`) and read by
 * `groundTaskMult`. Same shape as ops/types.ts's GroundCtx.
 */
export interface GroundCtx {
  task: string;
  frozenShare: number;
  bedrockShare: number;
  boulders: number;
  clay: number;
  ripping: boolean;
  pushFt?: number;
  haulFt?: number;
  tempBand: TempBand;
}

/** §7 7.1 `GoldParcel`: metal (alloy) oz by size and the fine oz they carry. */
export interface GoldParcelK {
  rawOz: SizeRecord;
  fineOz: number;
}

export function zeroSizes(): SizeRecord {
  return { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
}

export function sumSizes(s: Readonly<SizeRecord>): number {
  return s.coarse + s.medium + s.fine + s.ultrafine;
}
