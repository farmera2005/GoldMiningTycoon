// §3 world and geology slice of GameState (DESIGN §2.5, §3.1). Hidden fields (`hidden`, the packed truth, holder
// honesty) are read only by engine physics, the simulator, tests and the dev reveal; selectors, validators, bots and the
// UI never read them (CLAUDE.md "Hidden information").
import type { Cents } from '../../core/money';
import type {
  BlockId,
  ClaimId,
  CompetitorId,
  CreekId,
  DistrictId,
  HolderId,
} from '../../core/ids';

export * from './enums';
export { emptyWorldSlice } from './empty';
import type {
  Access,
  BedrockType,
  ClimateBand,
  ClimateTemplateId,
  DepositType,
  EconClass,
  FireRestrictionRegime,
  HolderSituation,
  JurisdictionId,
  LandRegime,
  ListingSetting,
  OldTimerKind,
  PriorStatus,
  RegionTemplateId,
  SellerHonesty,
  SellerKnowledge,
  SellerSituation,
  SizeRecord,
  SizeSetting,
  StateOverlayId,
  SurfaceCode,
  TitleKind,
  TownTier,
  VisibleFeature,
  WageRegion,
  WaterSourceKind,
  ClaimStatus,
} from './enums';

export interface PointMi {
  readonly x: number;
  readonly y: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// Region templates (DESIGN §3.2; data lives in src/data/regions)
// ---------------------------------------------------------------------------------------------------------------------

export interface DepositMult {
  readonly grade: number;
  readonly ob: number;
  readonly pay: number;
  readonly halfWidth: number;
}

export type TemplateWater =
  | { readonly kind: 'creek'; readonly gpmPerUpstreamMi: number; readonly sig: number }
  | {
      readonly kind: 'arid';
      readonly springP: number;
      readonly springMedGpm: number;
      readonly springSig: number;
      readonly wellMedGpm: number;
      readonly wellSig: number;
      readonly depthMedFt: number;
      /** §3.3.4 LN(180 ft, 0.5): the 0.5 is not a field in the DESIGN interface; added here. */
      readonly depthSig: number;
      readonly wellClampGpm: readonly [number, number];
      readonly depthClampFt: readonly [number, number];
    };

/** Valley deposit rule (§3.4 valleyType): northern creeks vs desert washes draining to a fan. */
export type ValleyRule =
  | { readonly kind: 'creek' }
  | {
      readonly kind: 'wash';
      /**
       * The lower share of main-stem rows on which the special-status (tortoise ACEC) stretch is drawn: the main
       * stem's part of the fan at the outlet (§3.3.1, 0.30). Fan deposit types follow the fan zone (§3.4, layout.ts).
       */
      readonly overlayFanMainFrac: number;
      /** The special-status stretch covers this share of those rows (§3.3.1: 20–40%). */
      readonly specialFanFrac: readonly [number, number];
    };

export interface RegionTemplate {
  readonly id: RegionTemplateId;
  readonly phase: number;
  readonly displayName: string;
  readonly climateBand: ClimateBand;
  readonly climateTemplateId: ClimateTemplateId;
  readonly fireRestrictionRegime: FireRestrictionRegime;
  readonly regime: LandRegime;
  readonly stateOverlayId: StateOverlayId;
  readonly jurisdictionId: JurisdictionId;
  readonly wageRegion: WageRegion;
  readonly recordsQuality: number;
  readonly districtRoadMix: Readonly<Partial<Record<Access, number>>>;
  readonly roadWinterMaintainedP: number;
  readonly townTierMix: Readonly<Partial<Record<TownTier, number>>>;
  readonly townRoadMi: readonly [number, number];
  readonly hubRoadMi: readonly [number, number];
  /** Arid districts show a visible regional aquifer range (§3.1 District.aquifer, §3.9). */
  readonly aquifer?: { readonly wellGpm: readonly [number, number]; readonly depthFt: readonly [number, number] };
  readonly parcelsPerDistrict: readonly [number, number];
  readonly stakedFraction: number;
  readonly patentedShare: number;
  readonly overlayP: { readonly withdrawn: number; readonly specialStatus: number };
  readonly overlayLabels: { readonly withdrawn: string; readonly specialStatus: string };
  readonly env: {
    readonly fishByOrder: readonly [number, number, number];
    readonly anadromousP: number;
    readonly wetlandP: Readonly<Partial<Record<DepositType, number>>>;
    /** Arid: one wetland block at a spring (§3.4.1). */
    readonly springWetland: boolean;
  };
  readonly valley: ValleyRule;
  /** Overrides geology.world.benchSideP: benches are tuned per template to reach depositMix.bench ± 0.05 (§3.4). */
  readonly benchSideP?: number;
  /** Overrides geology.access.trailDegrade1Mi / trailDegrade2Mi (§3.3.3) where roads are better or worse. */
  readonly trailDegradeMi?: readonly [number, number];
  /** Claim size mix by acres (§3.1). */
  readonly claimSizeMix: Readonly<Partial<Record<'20' | '40' | '80' | '160', number>>>;
  readonly depositMix: Readonly<Partial<Record<DepositType, number>>>;
  readonly gMed: number;
  readonly sigma: {
    readonly district: number;
    readonly creek: number;
    readonly rich: number;
    readonly claim: number;
    readonly block: number;
  };
  readonly richRangeFt: number;
  /** Overrides geology.grade.blockRangeAlongFt for this template (§3.2). */
  readonly blockRangeAlongFt: number;
  readonly halfWidthMedFt: number;
  readonly sigHalfWidth: number;
  readonly wanderSdFt: number;
  readonly bgRatio: number;
  /** σ order: district, creek, AR, claim, block. */
  readonly overburden: { readonly medFt: number; readonly sig: readonly [number, number, number, number, number] };
  /** σ order: creek, AR, block. */
  readonly pay: { readonly medFt: number; readonly sig: readonly [number, number, number] };
  readonly depositMult: Readonly<Record<DepositType, DepositMult>>;
  readonly bedrockMix: Readonly<Partial<Record<BedrockType, number>>>;
  readonly permafrostP: Readonly<Partial<Record<DepositType, number>>>;
  readonly clayMed: number;
  readonly boulderMed: number;
  /** Claim cementation median by deposit type (§3.2: north benches 0.15, else 0; arid 0.30, bench ×1.5). */
  readonly cementMed: Readonly<Partial<Record<DepositType, number>>>;
  readonly fineness: {
    readonly mean: number;
    readonly districtSd: number;
    readonly claimSd: number;
    readonly lo: number;
    readonly hi: number;
  };
  /** Size-mix priors (coarse / medium / fine / ultrafine shares). */
  readonly sizeMixPriors: Readonly<Partial<Record<SizeSetting, readonly [number, number, number, number]>>>;
  readonly coarseMg: Readonly<Partial<Record<SizeSetting, number>>>;
  readonly verticalDecayFt: Readonly<Partial<Record<DepositType, number>>>;
  readonly pocketP: number;
  readonly oldTimerMix: Readonly<Partial<Record<DepositType, Readonly<Partial<Record<OldTimerKind, number>>>>>>;
  readonly water: TemplateWater;
  readonly names: {
    readonly districts: readonly string[];
    readonly towns: readonly string[];
    readonly hubs: readonly string[];
    readonly creeks: readonly string[];
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Generation parameters snapshot (D-3.2)
// ---------------------------------------------------------------------------------------------------------------------

export interface MethodParamsData {
  readonly id: string;
  readonly positionMode: 'exposure' | 'pit' | 'fullColumn' | 'interval';
  readonly exposureDepthFrac?: number;
  readonly maxDepthFt: number | null;
  readonly frozenOk: boolean;
  readonly bedrockPenFt: number;
  readonly captureBySize: SizeRecord;
  readonly volumeCv: number;
  readonly weighCv: number;
  readonly geomCv: number;
  readonly thickCv?: number;
  readonly biasMult: number;
  readonly reportsClassMasses?: boolean;
  /** Sample volume per ft of sampled column (drill methods; §4 4.2.B). */
  readonly bcyPerFt?: number;
}

/** Physics constants drawSample and the closed forms use (§3.8), snapshotted with the world. */
export interface SamplePhysics {
  /** Mean particle mass of medium, fine, ultrafine (coarse is per claim), mg. */
  readonly particleMeanMg: readonly [number, number, number];
  readonly massCv: readonly [number, number, number, number];
  readonly deWijsAlpha: number;
  readonly poissonNormalLambda: number;
  readonly cltParticleThreshold: number;
  readonly frozenThreshold: number;
  readonly activeLayerFt: number;
  readonly pocketMix: readonly [number, number, number, number];
  readonly exposureMaxObFt: number;
  readonly exposureDepthFrac: number;
  readonly defaultThickCv: number;
  readonly obGradeRatio: number;
  readonly bedrockDecayFt: number;
  readonly waterTableFt: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly waterInflowP: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly waterStopFt: readonly [number, number];
  readonly bedrockIdP: number;
  readonly groundObsSd: number;
  readonly tercileCuts: readonly [number, number];
}

/** Per-claim and per-block draw constants of §3.5.3. */
export interface ClaimGenConstants {
  readonly decayJitter: readonly [number, number];
  readonly frozenDegree: readonly [number, number];
  readonly frozenMaxP: number;
  readonly clayLogSd: number;
  readonly boulderLogSd: number;
  readonly cementLogSd: number;
  readonly blockMixJitterLogSd: number;
  readonly coarseStreakThin: number;
  readonly blockFinenessSd: number;
  readonly permafrostBlockSd: number;
  readonly unfrozenSubarcticMax: number;
  readonly groundBlockSd: number;
  readonly clayFalseMinClay: number;
  readonly bedrockJitter: readonly [number, number];
  readonly payStreakWeight: number;
  readonly maxOverburdenFt: number;
  readonly minPayFt: number;
  readonly maxPayFt: number;
}

/** §3.6 old-timer table, one row per historic kind plus the recent-operator rule. */
export interface OldTimerKindParams {
  readonly drift: {
    readonly era: readonly [number, number];
    readonly top: readonly [number, number];
    readonly workP: number;
    readonly extract: readonly [number, number];
  };
  readonly handCut: {
    readonly era: readonly [number, number];
    readonly top: number;
    readonly maxObFt: number;
    readonly extract: readonly [number, number];
  };
  readonly dredge: { readonly era: readonly [number, number]; readonly minF: number; readonly extract: readonly [number, number] };
  readonly dryWash: { readonly era: readonly [number, number]; readonly top: number; readonly extract: readonly [number, number] };
  readonly hydraulic: {
    readonly era: readonly [number, number];
    readonly extract: readonly [number, number];
    readonly obMult: number;
  };
  readonly recentCat: {
    readonly top: readonly [number, number];
    readonly seasonBlocks: readonly [number, number];
    readonly pile: readonly [number, number];
  };
}

export interface RefEconParams {
  readonly spotUsdPerFineOz: number;
  readonly payable: number;
  readonly capture: readonly [number, number, number, number];
  readonly clayRecoveryPenalty: number;
  readonly stripUsd: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly washUsd: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly devBaseUsd: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly devPerAcreUsd: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly frozenStripAdd: number;
  readonly cementStripAdd: number;
  readonly boulderWashAdd: number;
  readonly clayWashAdd: number;
  readonly frozenWashAdd: number;
  readonly goodCdvUsd: number;
  readonly goodMargin: number;
  readonly excellentCdvUsd: number;
  readonly excellentMargin: number;
}

export interface GeoGenParams {
  readonly version: 1;
  /** game.startCalendarYear (display year of turn 0): recent-operator history and pre-strip ages. */
  readonly startYear: number;
  /** The templates this world was generated from, keyed by id. */
  readonly templates: Readonly<Partial<Record<RegionTemplateId, RegionTemplate>>>;
  readonly bedrock: Readonly<Record<BedrockType, { readonly cleanupFt: number; readonly goldShare: number }>>;
  readonly world: {
    readonly maxClaims: number;
    readonly mapMi: readonly [number, number];
    readonly stepMi: number;
    readonly mainLengthMi: readonly [number, number];
    readonly mainHeadingJitterDeg: number;
    readonly headingStepSdDeg: number;
    readonly edgeMarginMi: number;
    readonly outletEdgeFrac: readonly [number, number];
    readonly nTrib: readonly [number, number];
    readonly tribPosFrac: readonly [number, number];
    readonly tribMinSpacingMi: number;
    readonly tribAngleDeg: readonly [number, number];
    readonly tribLengthMi: readonly [number, number];
    readonly branchP: number;
    readonly branchPosFrac: readonly [number, number];
    readonly branchLengthMi: readonly [number, number];
    readonly valleyHalfWidthFt: readonly [
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ];
    readonly barrenCreekP: number;
    readonly barrenCreekFactor: number;
    readonly noTrailCreekP: number;
    readonly withdrawnStretchFrac: readonly [number, number];
    readonly specialStretchFrac: readonly [number, number];
    readonly benchSideP: number;
    readonly benchMinHalfWidthFt: number;
    readonly benchStretchFrac: readonly [number, number];
    readonly benchOffsetFt: readonly [number, number];
    readonly valleyFirstRowMax: number;
    readonly valleyGapP: number;
    readonly valleyGapRows: readonly [number, number];
    readonly dredgedStretchMi: readonly [number, number];
    readonly dredgedZoneFrac: number;
    readonly dredgedShareTol: number;
    readonly dredgedMaxStretches: number;
    readonly familyRunParcels: number;
    readonly junctionBoostLog: number;
    readonly junctionBoostRows: number;
    readonly proximalTopFrac: number;
    readonly selSlope: number;
    readonly selSlopeOverlooked: number;
    readonly zqNoPaystreak: number;
    readonly zqLnScale: number;
    readonly trailTortuosity: number;
  };
  readonly grade: {
    readonly blockRangeAcrossFt: number;
    readonly wanderRangeFt: number;
    readonly halfWidthRangeFt: number;
    readonly obRangeFt: number;
    readonly payRangeFt: number;
    readonly obAxisBoost: number;
    readonly obAxisScaleFt: number;
    readonly pocketBcy: readonly [number, number];
    readonly pocketMaxPayFrac: number;
    readonly pocketMultMedian: number;
    readonly pocketMultSigma: number;
    readonly pocketGradeClamp: readonly [number, number];
    readonly pocketStreakMinF: number;
    readonly pocketProximalMult: number;
    readonly claim: ClaimGenConstants;
    readonly boulderSettingMult: Readonly<Record<SizeSetting, number>>;
  };
  readonly env: {
    readonly channelOffsetFt: readonly [number, number];
    readonly aspectThawSlope: number;
    readonly aspectFrozenSlope: number;
    readonly sensitivity: {
      readonly base: number;
      readonly fish: number;
      readonly anadromous: number;
      readonly wetlandShare: number;
      readonly specialStatus: number;
      readonly noiseSd: number;
    };
  };
  readonly oldTimer: {
    readonly liabilityEraYear: number;
    readonly recentReclaimedP: number;
    readonly preStripP: number;
    readonly preStripMaxAgeYr: number;
    readonly histRecoveryHand: readonly [number, number];
    readonly recentCapture: readonly [number, number, number, number];
    readonly recentOpSkill: readonly [number, number];
    readonly improvementsMedianUsd: number;
    readonly improvementsSigma: number;
    readonly improvementsOldMult: number;
    readonly improvementsOldYears: number;
    readonly recentStartYear: readonly [number, number];
    readonly recentGapP: number;
    readonly filedSeasonP: number;
    readonly filedSeasonMinYear: number;
    readonly footprintOnRecordP: number;
    readonly kinds: OldTimerKindParams;
    readonly driftBottom: {
      readonly topFt: number;
      readonly bedrockFt: number;
      readonly decayMult: number;
      readonly bedrockShareMult: number;
    };
    readonly dredgeEffects: { readonly boulderMult: number; readonly decayFt: number; readonly minBedrockShare: number };
    readonly maxExtraction: number;
    readonly depleteCap: number;
    readonly depleteWeights: {
      readonly hand: readonly [number, number, number, number];
      readonly dredge: readonly [number, number, number, number];
    };
    readonly pileBcy: {
      readonly driftFt: number;
      readonly drift: readonly [number, number];
      readonly handCut: readonly [number, number];
      readonly dryWashFt: number;
      readonly dryWash: readonly [number, number];
    };
    readonly pileMix: readonly [number, number, number, number];
    readonly preStripBlocks: readonly [number, number];
    readonly preStripThawFt: readonly [number, number];
  };
  readonly permitStub: {
    readonly minLastSeasonYear: number;
    readonly planP: number;
    readonly noticeP: number;
    readonly bondFrac: readonly [number, number];
    readonly rceStubUsdPerAcre: number;
  };
  readonly records: {
    readonly historicGradeRatio: number;
    readonly creekProdLogSd: number;
    readonly priorDrillP: number;
    readonly priorDrillHoles: readonly [number, number];
    readonly priorDrillYears: readonly [number, number];
    readonly flyInQualityMult: number;
    readonly priorDrillMethod: MethodParamsData;
  };
  readonly sample: SamplePhysics;
  readonly prior: {
    readonly statusMult: Readonly<Record<PriorStatus, number>>;
    readonly paystreakShare: Readonly<Record<ListingSetting, number>>;
    readonly listedSigmaAdj: number;
    readonly oldWorkingsMult: { readonly dredgeTailings: number; readonly tailingsPiles: number };
    readonly sizeMixJitterLogSd: number;
    readonly coarseMassLogSd: number;
  };
  readonly refEcon: RefEconParams;
  readonly water: {
    readonly usableFrac: number;
    readonly lowFlowShape: Readonly<Partial<Record<WaterSourceKind, number>>>;
    readonly rightStubP: Readonly<Partial<Record<ClimateBand, number>>>;
    readonly rightStubGpm: readonly [number, number];
    readonly benchLiftFt: readonly [number, number];
    readonly nearestFillFrac: readonly [number, number];
  };
  readonly access: {
    readonly classes: Readonly<
      Record<Access, { readonly fuelAdder: number; readonly partsLead: number; readonly mobMult: number; readonly refMi: number }>
    >;
    readonly distExponent: number;
    readonly distScaleClamp: readonly [number, number];
    readonly trailDegrade1Mi: number;
    readonly trailDegrade2Mi: number;
  };
  readonly seller: {
    readonly honestyMix: Readonly<Record<SellerHonesty, number>>;
    readonly honestyTilts: Readonly<Record<SellerHonesty, Readonly<Partial<Record<HolderSituation, number>>>>>;
    readonly situationMix: Readonly<Record<HolderSituation, number>>;
    readonly groupRunP: number;
    readonly maxParcelsPerHolder: number;
  };
  readonly supply: {
    readonly baseListHazard: number;
    readonly seasonMultMean: number;
    readonly inflowMult: Readonly<Record<EconClass, number>>;
    readonly saleQualityMult: Readonly<Record<EconClass, number>>;
    readonly relistCooldownWk: number;
    readonly postSaleCooldownWk: number;
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The world slice (DESIGN §3.1)
// ---------------------------------------------------------------------------------------------------------------------

export interface TownServices {
  readonly fuel: boolean;
  readonly partsCounter: boolean;
  readonly weldingShop: boolean;
  readonly goldBuyer: boolean;
  readonly airstrip: boolean;
  readonly clinic: boolean;
  readonly motel: boolean;
  readonly equipmentDealers: boolean;
  readonly laborPoolMult: number;
}

export interface LandOverlay {
  readonly kind: 'withdrawn' | 'specialStatus';
  readonly label: string;
  readonly creekId: CreekId;
  readonly rowFrom: number;
  /** Inclusive. */
  readonly rowTo: number;
}

export interface District {
  readonly id: DistrictId;
  readonly name: string;
  readonly templateId: RegionTemplateId;
  readonly regime: LandRegime;
  readonly climateTemplateId: ClimateTemplateId;
  readonly fireRestrictionRegime: FireRestrictionRegime;
  readonly stateOverlayId: StateOverlayId;
  readonly jurisdictionId: JurisdictionId;
  readonly wageRegion: WageRegion;
  readonly recordsQuality: number;
  readonly mapMi: { readonly w: number; readonly h: number };
  readonly outletMi: PointMi;
  readonly roadClass: Access;
  readonly roadWinterMaintained: boolean;
  readonly town: {
    readonly name: string;
    readonly tier: TownTier;
    readonly positionMi: PointMi;
    readonly roadMiFromOutlet: number;
    readonly services: TownServices;
  };
  readonly hub: { readonly name: string; readonly roadMiFromTown: number };
  readonly aquifer?: { readonly wellGpm: readonly [number, number]; readonly depthFt: readonly [number, number] };
  readonly overlays: readonly LandOverlay[];
  readonly npcHeldBaseline: number;
  readonly hidden: { readonly gradeFactor: number; readonly obFactor: number; readonly finenessMean: number };
  readonly creekIds: readonly CreekId[];
  readonly claimIds: readonly ClaimId[];
}

export interface CreekHistory {
  readonly histOz: number;
  readonly histBcy: number;
  readonly era: readonly [number, number];
}

export interface Creek {
  readonly id: CreekId;
  readonly districtId: DistrictId;
  readonly name: string;
  readonly order: 1 | 2 | 3;
  readonly parentId: CreekId | null;
  /** Row of the parent creek where this creek joins it. */
  readonly junctionRow: number | null;
  readonly polylineMi: readonly PointMi[];
  readonly lengthMi: number;
  readonly rows: number;
  readonly valleyHalfWidthFt: number;
  /** Channel miles above each row, tributaries included (§3.3.1; water and map). */
  readonly upstreamMiAtRow: readonly number[];
  /** Channel miles from the district outlet to this creek's mouth (trail distance before tortuosity). */
  readonly mouthMiFromOutlet: number;
  readonly noTrail: boolean;
  readonly fishBearing: boolean;
  readonly anadromous: boolean;
  readonly hidden: {
    readonly goldBearing: boolean;
    readonly gradeFactor: number;
    readonly obFactor: number;
    readonly payFactor: number;
    readonly history: CreekHistory | null;
  };
}

export interface ClaimEnv {
  /** One char per block in blockIdx order (i·nAcross + j): 'u' | 'w' | 'c'. */
  readonly surfaceCodes: string;
  readonly fishBearing: boolean;
  readonly specialStatus: boolean;
  readonly sensitivity: number;
  readonly previouslyDisturbed: boolean;
  readonly adjacentClaimIds: readonly ClaimId[];
  readonly thawAspectMult: number;
}

export interface WaterRightStub {
  readonly priority: 'senior';
  readonly gpm: number;
  readonly source: 'surface' | 'groundwater';
}

export interface ClaimWater {
  readonly sourceKind: WaterSourceKind;
  readonly baseGpm: number;
  readonly benchLiftFt: number;
  readonly nearestFillMi: number;
  readonly rightStub?: WaterRightStub;
  readonly hidden: { readonly wellYieldGpm: number; readonly depthToWaterFt: number };
}

export interface TrueSeason {
  readonly year: number;
  readonly bcy: number;
  readonly rawOz: number;
  readonly blockIdxs: readonly number[];
}

export interface OldDrillHole {
  readonly blockIdx: number;
  readonly year: number;
  readonly reportedGradeOzPerBcy: number;
  readonly depthToBedrockFt: number | null;
  readonly payThicknessFt: number | null;
  readonly colorsBySize: SizeRecord;
  readonly volumeMeasuredBcy: number;
}

export interface PublicRecord {
  readonly oldTimer: {
    readonly kind: OldTimerKind;
    readonly era: readonly [number, number];
    readonly workedBlockIdxs: readonly number[];
  } | null;
  readonly filedSeasons: readonly TrueSeason[];
  readonly priorPermits: readonly string[];
  readonly inheritedAcres: number;
  readonly lapses: readonly number[];
  readonly priorDrill: readonly OldDrillHole[] | null;
}

export type PermitStubStatus = 'none' | 'noticeOnFile' | 'planApproved';

export interface ClaimGeometry {
  readonly rowStart: number;
  readonly axisOffsetFt: number;
  readonly centerMi: PointMi;
  /** Compass bearing (degrees clockwise from north) of the upstream direction at the claim. */
  readonly headingDeg: number;
  readonly lengthFt: number;
  readonly widthFt: number;
}

export interface Claim {
  readonly id: ClaimId;
  readonly districtId: DistrictId;
  readonly creekId: CreekId;
  readonly name: string;
  readonly acres: number;
  readonly nAlong: number;
  readonly nAcross: number;
  /** blockId = blk_(blockIdBase + i·nAcross + j). */
  readonly blockIdBase: number;
  readonly geometry: ClaimGeometry;
  readonly setting: ListingSetting;
  /**
   * The size-mix prior key (§3.2, §3.9), derived from visible geometry only: proximal (top 30% of a creek's rows or
   * an order-3 creek) / midReach on creeks, fan / gulch on desert washes (the fan spreads from the outlet), bench.
   */
  readonly sizeSetting: SizeSetting;
  readonly titleKind: TitleKind;
  readonly regime: LandRegime;
  readonly status: ClaimStatus;
  readonly holderId: HolderId | CompetitorId | 'player' | null;
  readonly access: Access;
  readonly trailMi: number;
  readonly distanceToTownMi: number;
  readonly visibleFeatures: readonly VisibleFeature[];
  /** Block indices carrying an aerial-visible feature (§3.9; feeds ClaimPriors.blocks.visibleWorkings). */
  readonly visibleWorkings: readonly number[];
  readonly improvementsUsd: number;
  readonly env: ClaimEnv;
  readonly water: ClaimWater;
  readonly hidden: {
    readonly depositType: DepositType;
    readonly oldTimerKind: OldTimerKind;
    readonly oldTimerEra: readonly [number, number] | null;
    readonly truthPack: string;
    readonly truthHash: string;
    readonly trueHistory: readonly TrueSeason[];
    readonly publicRecord: PublicRecord;
    readonly permitStub: { readonly status: PermitStubStatus; readonly bondPostedCents: Cents | null };
    readonly econClass: EconClass;
  };
  readonly listingSeq: number;
  readonly cooldownUntilTurn: number | null;
}

/** Stored sparsely: world.blockStates[blockId] exists only once a block is touched (§3.5.1). */
export interface BlockState {
  readonly strippedBcy: number;
  readonly minedBcy: number;
  readonly sampledBcy: number;
  readonly oldTailingsTakenBcy: number;
  readonly disturbed: boolean;
  readonly disturbedTurn?: number;
  readonly disturbanceOrigin: 'player' | 'inherited' | 'historic';
  readonly reclaimed: boolean;
  /** ft thawed below the current surface (§7 advances it). */
  readonly thawProgress: number;
}

export interface SellerEvidenceSummary {
  readonly nPitsDug: number;
  readonly nPansDug: number;
  readonly nScrapes: number;
  readonly honestGradeOzPerBcy: number | null;
  readonly honestPayFt: number | null;
  readonly nPaystreakBlocksBelieved: number;
  readonly omittedSeasonYears: readonly number[];
  readonly kMult: number;
  readonly permitStatementTrue: boolean;
  readonly beliefRawOz: number;
}

export interface SellerProfile {
  readonly id: HolderId;
  readonly displayName: string;
  readonly situation: SellerSituation;
  /** Hidden. */
  readonly honesty: SellerHonesty;
  readonly knowledge: SellerKnowledge;
  readonly claimIds: readonly ClaimId[];
  /** Hidden; written at first listing (P1). */
  readonly evidence: Readonly<Record<ClaimId, SellerEvidenceSummary>>;
}

export interface SiteVisitReport {
  readonly turn: number;
  readonly claimId: ClaimId;
  readonly features: readonly string[];
  readonly boulders: 'low' | 'med' | 'high';
  readonly permafrostIndicator: 'likely' | 'unlikely';
  readonly flowGpm: number | null;
  readonly tellIds: readonly string[];
  readonly snowCovered: boolean;
}

export interface SupplyQueueEntry {
  readonly claimId: ClaimId;
  readonly situation: SellerSituation;
  readonly queuedTurn: number;
}

export interface WorldSlice {
  readonly genParams: GeoGenParams;
  readonly districts: Readonly<Record<DistrictId, District>>;
  readonly districtIds: readonly DistrictId[];
  readonly creeks: Readonly<Record<CreekId, Creek>>;
  readonly claims: Readonly<Record<ClaimId, Claim>>;
  readonly claimIds: readonly ClaimId[];
  readonly blockStates: Readonly<Record<BlockId, BlockState>>;
  readonly holders: Readonly<Record<HolderId, SellerProfile>>;
  readonly siteVisits: Readonly<Record<ClaimId, readonly SiteVisitReport[]>>;
  readonly watch: { readonly districtIds: readonly DistrictId[]; readonly claimIds: readonly ClaimId[] };
  readonly supplyQueue: readonly SupplyQueueEntry[];
  /** The reserved Inheritor family run (§3.4, §3.6.1): three consecutive 20-ac valley parcels, or [] when none. */
  readonly familyRunClaimIds: readonly ClaimId[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Block truth (hidden; decoded from claim.hidden.truthPack, §3.5.1)
// ---------------------------------------------------------------------------------------------------------------------

export interface BlockTruth {
  readonly overburdenFt: number;
  readonly payThicknessFt: number;
  readonly bedrockCleanupFt: number;
  /** CURRENT metal oz per bcy of the pay column, net of old-timer removal (D-3.4). */
  readonly gradeOzPerBcy: number;
  readonly virginGradeOzPerBcy: number;
  readonly sizeMix: SizeRecord;
  readonly coarseMeanMg: number;
  readonly fineness: number;
  readonly permafrost: number;
  readonly clay: number;
  readonly boulders: number;
  readonly cementation: number;
  readonly bedrockType: BedrockType;
  readonly bedrockGoldShare: number;
  readonly verticalDecayFt: number;
  readonly paystreakFraction: number;
  readonly minedOutFraction: number;
  readonly pocket?: { readonly bcy: number; readonly gradeOzPerBcy: number };
  readonly oldTailings?: { readonly bcy: number; readonly gradeOzPerBcy: number; readonly sizeMix: SizeRecord };
}

/** One claim's decoded truth (blocks in blockIdx order). */
export interface ClaimTruth {
  readonly claimId: ClaimId;
  readonly truthHash: string;
  readonly coarseMeanMg: number;
  readonly blocks: readonly BlockTruth[];
}

export interface VerticalProfile {
  readonly Tg: number;
  readonly B: number;
  readonly sb: number;
  readonly lambdaG: number;
  readonly lambdaB: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sampling (DESIGN §3.8)
// ---------------------------------------------------------------------------------------------------------------------

/** Values owned by §4's method table; §3 owns the shape. */
export type SampleMethodParams = MethodParamsData;

export interface SampleRequest {
  readonly blockId: BlockId;
  readonly volumeBcy: number;
  readonly interval?: { readonly h1: number; readonly h2: number };
  readonly fromOpenCut?: boolean;
  readonly target?: 'inSitu' | 'oldTailings';
  readonly samplerCaptureMult?: number;
}

export type Tercile = 'low' | 'med' | 'high';

export interface SampleObserved {
  readonly overburdenFt?: number;
  readonly payThicknessFt?: number;
  readonly depthToBedrockFt?: number;
  readonly bedrockType?: BedrockType;
  readonly permafrost: boolean;
  readonly clay: Tercile;
  readonly boulders: Tercile;
}

export interface SampleResult {
  readonly blockId: BlockId;
  readonly methodId: string;
  readonly volumeBcy: number;
  readonly volumeMeasuredBcy: number;
  readonly intervalDepthFt: readonly [number, number] | null;
  readonly reachedPay: boolean;
  readonly reachedBedrock: boolean;
  readonly stopReason: 'none' | 'reach' | 'frozen' | 'water';
  readonly reportedGradeOzPerBcy: number;
  readonly recoveredMg: number;
  readonly colorsBySize: SizeRecord;
  readonly massBySizeMg: SizeRecord | null;
  readonly observed: SampleObserved;
  readonly extractedBcy: number;
  /** Engine-only; stripped by selectors. */
  readonly hidden: { readonly drawnRawOz: number; readonly recoveredRawOz: number; readonly accountingRawOz: number };
}

/** The sample terms of §2.14's gold identity (§3.8 sampleGoldLines). */
export interface SampleGoldLines {
  readonly accountingRawOz: number;
  readonly creditedRawOz: number;
  readonly sampleCaptureLoss: number;
  readonly sampleProcessingLoss: number;
  readonly samplingVariance: number;
}

/** What drawSample needs beyond the block (the visible surface code and the world's physics snapshot). */
export interface DrawContext {
  readonly surface: SurfaceCode;
  readonly climateBand: ClimateBand;
  readonly physics: SamplePhysics;
}

// ---------------------------------------------------------------------------------------------------------------------
// Visible priors (DESIGN §3.9; §4 4.5.1 prints ClaimPriors, §3 fills it from template constants and visible facts only)
// ---------------------------------------------------------------------------------------------------------------------

export interface VisiblePrior {
  readonly gradeMedOzBcy: number;
  readonly gradeSigLn: number;
  readonly pBarrenCreek: number;
  readonly paystreakShare: number;
  readonly obMedFt: number;
  readonly obSigClaim: number;
  readonly obSigBlock: number;
  readonly payMedFt: number;
  readonly paySigClaim: number;
  readonly paySigBlock: number;
  readonly bedrockMix: Readonly<Partial<Record<BedrockType, number>>>;
  /** B̄ = Σ bedrockMix × B0 (north 1.54 ft, arid 0.68 ft). */
  readonly meanCleanupFt: number;
  /** s̄_b = Σ bedrockMix × s0. */
  readonly meanBedrockGoldShare: number;
  readonly sizeMixPrior: SizeRecord;
  readonly fineness: { readonly mean: number; readonly districtSd: number; readonly claimSd: number; readonly lo: number; readonly hi: number };
  readonly pFrozen: number;
}

export interface ClaimPriors {
  readonly claimId: ClaimId;
  readonly districtId: DistrictId;
  readonly creekId: CreekId;
  readonly templateId: RegionTemplateId;
  readonly setting: ListingSetting;
  readonly priorStatus: PriorStatus;
  readonly recordsQuality: number;
  readonly logGradeMedian: number;
  readonly sigma: {
    readonly district: number;
    readonly creek: number;
    readonly rich: number;
    readonly claim: number;
    readonly block: number;
  };
  readonly rangeAlongFt: number;
  readonly rangeAcrossFt: number;
  readonly streak: {
    readonly wanderSdFt: number;
    readonly halfWidthMedFt: number;
    readonly sigHalfWidth: number;
    readonly bgRatio: number;
  };
  readonly pBarrenCreek: number;
  readonly barrenMult: number;
  readonly pocket: {
    readonly pPerStreakBlock: number;
    readonly bcyMean: number;
    readonly bcy2Mean: number;
    readonly gradeMin: number;
    readonly gradeMult: number;
  };
  readonly oldTimer: {
    readonly pKind: Readonly<Partial<Record<OldTimerKind, number>>>;
    readonly knownKind?: OldTimerKind;
    readonly workedBlockIds?: readonly BlockId[];
  };
  readonly sizeMixPrior: SizeRecord;
  readonly sizeMixJitterLogSd: number;
  readonly coarseMeanMg: number;
  readonly coarseMassLogSd: number;
  readonly fineness: { readonly mean: number; readonly districtSd: number; readonly claimSd: number };
  readonly verticalDecayFt: number;
  readonly bedrockMix: Readonly<Partial<Record<BedrockType, number>>>;
  readonly geometry: {
    readonly obMedFt: number;
    readonly obSigClaim: number;
    readonly obSigBlock: number;
    readonly payMedFt: number;
    readonly paySigClaim: number;
    readonly paySigBlock: number;
  };
  readonly blocks: readonly {
    readonly blockId: BlockId;
    readonly i: number;
    readonly j: number;
    readonly xFt: number;
    readonly acres: number;
    readonly surface: SurfaceCode;
    readonly visibleWorkings: boolean;
  }[];
}
