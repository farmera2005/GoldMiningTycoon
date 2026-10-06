// §3 listing, seller-evidence, tell, access and map shapes (DESIGN §3.6.1, §3.9, §3.10, §3.11, §3.12, §3.14; P1
// contract §4.3), re-exported by world/types.ts. `SellerClaimSummary.hidden` is the seller's reservation input and is
// never rendered; everything else here is visible.
import type { Cents } from '../../core/money';
import type { BlockId, ClaimId, ClaimListingId, CompetitorId, CreekId, DistrictId, HolderId } from '../../core/ids';
import type {
  Access,
  ClaimStatus,
  LandRegime,
  ListingSetting,
  SellerSituation,
  TitleKind,
  TownTier,
  VisibleFeature,
  WaterSourceKind,
} from './enums';
import type { ClaimEnv, LandOverlay, PointMi, TownServices, WaterRightStub } from './types';

/** §3.10.2 old valuation report (e.g. 1938, $0.85/yd at $35 → 0.0243 oz/yd). */
export interface OldReport {
  readonly year: number;
  readonly usdPerYd: number;
  readonly goldPriceThenUsd: number;
  readonly author: string;
}

/** §3.10.2 what the seller claims (shown on the listing). */
export interface ClaimedEvidence {
  readonly gradeOzPerBcy: number | null;
  readonly gradeBasis: 'bank' | 'screenedFeed' | 'unspecified';
  readonly thickness?: { readonly overburdenFt: number; readonly payFt: number };
  readonly samples: readonly {
    readonly blockIdx: number | null;
    readonly method: 'pan' | 'testPit' | 'bedrockScrape';
    readonly volumeBcy: number;
    readonly gradeOzPerBcy: number;
    readonly year: number;
    readonly lab: 'none' | 'local' | 'certified' | 'unknown';
    readonly finenessNote?: string;
  }[];
  readonly history: readonly {
    readonly year: number;
    readonly bcy: number;
    readonly rawOz: number;
    readonly basis: 'bank' | 'loose' | 'unspecified';
  }[];
  readonly oldReport?: OldReport;
  /** Templated statements. */
  readonly narrative: readonly string[];
}

/** §3.10.3 §5's pricing inputs; `hidden` is the reservation input and is never rendered. */
export interface SellerClaimSummary {
  readonly evidenceClass: 'none' | 'anecdotal' | 'history' | 'report' | 'production';
  readonly claimedGradeOzBcy: number | null;
  readonly claimedRawOz: number;
  readonly claimedFineness: number | null;
  /** = dataPackage none / partial / complete. */
  readonly recordsQuality: 'none' | 'fair' | 'good';
  readonly hidden: { readonly beliefRawOz: number };
}

/** §3.9 a listing's water as shown. */
export type ListingWater = (
  | { readonly kind: 'creek'; readonly flowGpm: { readonly early: number; readonly mid: number; readonly late: number } }
  | {
      readonly kind: 'arid';
      readonly springGpm: number | null;
      readonly regionalWellGpm: readonly [number, number];
      readonly regionalDepthFt: readonly [number, number];
      readonly nearestFillMi: number;
    }
) & {
  /** P2+; null in P1. */
  readonly seniorRight: { readonly gpm: number; readonly source: 'surface' | 'groundwater' } | null;
};

/** §3.9 a listing's visible snapshot, built by §3 at candidate creation and stored by §5 as `Listing.info`. */
export interface ListingInfo {
  readonly claimId: ClaimId;
  readonly districtId: DistrictId;
  readonly creekName: string;
  readonly acres: number;
  readonly titleKind: TitleKind;
  readonly regime: LandRegime;
  readonly setting: ListingSetting;
  readonly access: Access;
  readonly accessNote: string;
  readonly distanceToTownMi: number;
  readonly town: { readonly name: string; readonly tier: TownTier; readonly services: TownServices };
  readonly env: ClaimEnv;
  readonly water: ListingWater;
  /** clamp(expectedGpm / 750, 0, 1). */
  readonly waterScore: number;
  readonly visibleFeatures: readonly VisibleFeature[];
  /** §5 improvement credit. */
  readonly improvementsUsd: number;
  /** The seller's statement; §5 derives the presented authority from it. */
  readonly permits: {
    readonly status: 'none' | 'noticeOnFile' | 'planApproved' | 'unknown';
    readonly bondPostedCents: Cents | null;
  };
  readonly disturbance: {
    readonly inheritedUnreclaimedAcres: number;
    readonly historicAcres: number;
    readonly liabilityEstimateCents: Cents;
  };
  readonly claimed: ClaimedEvidence;
  readonly summary: SellerClaimSummary;
  readonly seller: {
    readonly holderId: HolderId | CompetitorId;
    readonly displayName: string;
    readonly situation: SellerSituation;
    readonly dataPackage: 'complete' | 'partial' | 'none';
  };
}

/** §3.12 §5's staking view of a claim with status 'open' (P2 consumer). */
export interface OpenParcel {
  readonly id: ClaimId;
  readonly districtId: DistrictId;
  readonly blockIds: readonly BlockId[];
  readonly acres: number;
  readonly setting: ListingSetting;
  readonly visibleOldWorkings: readonly VisibleFeature[];
  readonly env: ClaimEnv;
  readonly priorContainedOz: number;
}

/** §3.11 `supplyTick` output, in claim-id order. */
export interface ListingCandidate {
  readonly claimId: ClaimId;
  readonly holderId: HolderId | CompetitorId;
  readonly situation: SellerSituation;
  readonly info: ListingInfo;
  /** P5+, rolled once here; §5 does not redraw it. */
  readonly firstLookUntilTurn: number | null;
  /** P2+ initial-market stratum: §5 offers lease / lease-with-option terms. */
  readonly starterLease: boolean;
}

/** §3.10.4 the twelve seller tells. */
export const TELL_KINDS = [
  'gradeBasisScreened',
  'historyLooseYards',
  'thicknessOverstated',
  'sampleClustering',
  'unreportedPits',
  'bedrockScrapeSamples',
  'historyGaps',
  'noProductionRecord',
  'inflatedHistory',
  'saltedSignature',
  'unknownLab',
  'permitStatusMismatch',
] as const;
export type TellKind = (typeof TELL_KINDS)[number];

/** §3.10.4 a found tell (only found tells are stored). */
export interface SellerTell {
  /** '<listingId>/<tellKind>'. */
  readonly id: string;
  readonly kind: TellKind;
  readonly listingId: ClaimListingId;
  readonly channel: 'recordsReview' | 'geologistReview' | 'siteVisit';
  readonly text: string;
  readonly foundTurn: number;
}

/** §3.12 a site visit's quote for §13 (S13-9). */
export interface SiteVisitQuote {
  readonly costCents: Cents;
  readonly days: number;
  readonly fitsThisWeek: boolean;
  readonly earliestTurn: number;
  readonly blockedBy: 'access' | null;
}

/** §3.14 `claimAccess(state, claimId)`: this week, on §1 `accessOpen` plus the claim-scoped closure (D-1.74). */
export interface ClaimAccess {
  readonly heavyOpen: boolean;
  readonly freightOpen: boolean;
  readonly freightMode: 'road' | 'trail' | 'air';
}

/** §3.11 why a listing closed (`onListingClosed`). */
export type ListingCloseOutcome =
  | 'expired'
  | 'withdrawn'
  | 'soldOffscreen'
  | 'soldToPlayer'
  | 'leasedToPlayer'
  | 'soldToCompetitor';

/**
 * §3.6.1 the Inheritor's family records, from §3 to §4 (contract): the run's claims, the optimistic family ledger, the
 * old pit logs and the pre-stripped blocks. §4 shows them and never admits them before verification.
 */
export interface FamilyRecords {
  readonly claimIds: readonly ClaimId[];
  readonly seasons: readonly { readonly year: number; readonly bcyWashed: number; readonly rawOzRecovered: number }[];
  readonly pitLogs: readonly {
    readonly blockId: BlockId;
    readonly year: number;
    readonly depthFt: number;
    readonly recoveredOzPerYd: number;
  }[];
  readonly preStrippedBlockIds: readonly BlockId[];
}

/** §3.14 `districtMap(state, districtId)`: everything §13's base map draws (it reads no District geometry directly). */
export interface DistrictMap {
  readonly widthMi: number;
  readonly heightMi: number;
  readonly outlet: PointMi;
  readonly creeks: readonly {
    readonly id: CreekId;
    readonly order: 1 | 2 | 3;
    readonly name: string;
    readonly points: readonly PointMi[];
  }[];
  readonly routes: readonly { readonly access: Access; readonly points: readonly PointMi[] }[];
  readonly town: {
    readonly name: string;
    readonly tier: TownTier;
    readonly services: TownServices;
    /** May lie off the map (drawn as an edge marker with road miles). */
    readonly positionMi: PointMi;
  };
  /** Display only (D-3.76). */
  readonly airstrips: readonly PointMi[];
  readonly overlays: readonly {
    readonly kind: LandOverlay['kind'];
    readonly label: string;
    readonly polygon: readonly PointMi[];
  }[];
  readonly claims: readonly {
    readonly id: ClaimId;
    readonly status: ClaimStatus;
    /** Four corners from the claim geometry. */
    readonly polygon: readonly PointMi[];
    readonly nAlong: number;
    readonly nAcross: number;
    readonly surfaceCodes: string;
  }[];
}

/** The visible fields of a claim's water plus the listed flow (P1 contract §4 supporting types). */
export interface ClaimWaterView {
  readonly sourceKind: WaterSourceKind;
  readonly baseGpm: number;
  readonly benchLiftFt: number;
  readonly nearestFillMi: number;
  readonly rightStub?: WaterRightStub;
  readonly listedFlowGpm: number;
}
