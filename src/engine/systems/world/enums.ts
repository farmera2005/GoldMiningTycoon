// Runtime enumerations of the §3 world (DESIGN §3.2). Arrays fix the canonical order used for weighted picks,
// packing and stored arrays, so nothing depends on object key order. Kept apart from types.ts so modules that need the
// arrays at runtime never form an import cycle through the slice types.

export type RegionTemplateId = 'northernFederal' | 'aridFederal' | 'temperateFederal' | 'alaskaState' | 'yukon';
export type ClimateBand = 'subarctic' | 'arid' | 'temperateMontane';
/** §1 owns the climate data; §3 templates name the one each district uses (§1 1.4.1). */
export type ClimateTemplateId = 'northernInterior' | 'aridDesert' | 'northernYukon' | 'temperateMountain';
export type FireRestrictionRegime = 'none' | 'stage' | 'ifpl';

export const DEPOSIT_TYPES = ['creek', 'bench', 'deepMuck', 'dredgedGround', 'desertFan', 'gulch'] as const;
export type DepositType = (typeof DEPOSIT_TYPES)[number];

export const BEDROCK_TYPES = [
  'schist',
  'slatePhyllite',
  'granite',
  'basaltVolcanic',
  'clayFalse',
  'karstLimestone',
] as const;
export type BedrockType = (typeof BEDROCK_TYPES)[number];

export const OLD_TIMER_KINDS = ['none', 'handCut', 'drift', 'dredge', 'dryWash', 'hydraulic', 'recentCat'] as const;
export type OldTimerKind = (typeof OLD_TIMER_KINDS)[number];

export const TOWN_TIERS = ['outpost', 'serviceTown', 'hubCity'] as const;
export type TownTier = (typeof TOWN_TIERS)[number];

/** Claim access classes, best to worst (§3.3.3 degrade order). */
export const ACCESS_CLASSES = ['highway', 'seasonalRoad', 'winterTrail', 'flyIn'] as const;
export type Access = (typeof ACCESS_CLASSES)[number];

export type WaterSourceKind = 'creek' | 'spring' | 'well' | 'ephemeralWash' | 'none';
/** = §11 TaxJurisdictionId; §8 and §9 key on it too (D-3.46). */
export type JurisdictionId = 'akStyle' | 'nvStyle' | 'temperateStyle' | 'yukon';
export type WageRegion = 'northern' | 'arid' | 'temperate' | 'alaskaState' | 'yukon';
/**
 * The legal regime of ground (§6 owns the type as `Regime`; named LandRegime here so it never collides with §10's
 * price-regime `Regime`). Patented parcels are 'private'.
 */
export type LandRegime = 'usFederal' | 'alaskaState' | 'yukon' | 'private';
export type StateOverlayId = 'northernOverlay' | 'aridOverlay';

export const SIZE_CLASSES = ['coarse', 'medium', 'fine', 'ultrafine'] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];
export type SizeRecord = Record<SizeClass, number>;

/** Size-mix prior and coarse-mass keys of a template (§3.2: proximal / mid-reach / bench north; fan / gulch / bench arid). */
export const SIZE_SETTINGS = ['proximal', 'midReach', 'bench', 'fan', 'gulch'] as const;
export type SizeSetting = (typeof SIZE_SETTINGS)[number];

/** What a listing shows as the setting (§3.9): deep muck shows as valley bottom. */
export const LISTING_SETTINGS = ['valleyBottom', 'bench', 'dredgedGround', 'fan', 'gulch'] as const;
export type ListingSetting = (typeof LISTING_SETTINGS)[number];

export type EconClass = 'uneconomic' | 'marginal' | 'good' | 'excellent';
export const ECON_CLASSES: readonly EconClass[] = ['uneconomic', 'marginal', 'good', 'excellent'];

export type ClaimStatus = 'open' | 'heldNpc' | 'listed' | 'player' | 'competitor' | 'withdrawn';
export type PriorStatus = 'held' | 'listed' | 'open';
export type TitleKind = 'unpatented' | 'patented' | 'state';

export type SellerHonesty = 'accurate' | 'optimistic' | 'cherryPicked' | 'fraudulent';
export const SELLER_HONESTIES: readonly SellerHonesty[] = ['accurate', 'optimistic', 'cherryPicked', 'fraudulent'];
export type SellerSituation =
  'retiringOperator' | 'estate' | 'prospector' | 'distressedOperator' | 'absentee' | 'competitorBust';
/** Situations a new NPC holder can be drawn with (competitorBust exists only on relisted candidates, §3.10.1). */
export const HOLDER_SITUATIONS = [
  'prospector',
  'absentee',
  'retiringOperator',
  'estate',
  'distressedOperator',
] as const;
export type HolderSituation = (typeof HOLDER_SITUATIONS)[number];
export type SellerKnowledge = 'operator' | 'prospector' | 'heirs' | 'absentee';

export type VisibleFeature =
  'dredgeTailings' | 'tailingsPiles' | 'recentDisturbance' | 'ponds' | 'preStripped' | 'improvements';
/** Canonical order of visible features (stored arrays follow it). */
export const VISIBLE_FEATURES: readonly VisibleFeature[] = [
  'dredgeTailings',
  'tailingsPiles',
  'recentDisturbance',
  'ponds',
  'preStripped',
  'improvements',
];

/** Surface code per block (§3.4.1): 'u' upland, 'w' wetland, 'c' channel (active creek or wash bed). */
export type SurfaceCode = 'u' | 'w' | 'c';
