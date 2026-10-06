// Transient generation structures (DESIGN §3.1 generation order). Nothing here is stored: generateWorld turns them into
// the slice records, and the creek profiles are discarded after generation.
import type { ClaimId, CreekId, DistrictId } from '../../core/ids';
import type { Access, DepositType, LandOverlay, PointMi, RegionTemplate, SizeSetting, TownTier } from './types';

export interface GenDistrict {
  readonly index: number;
  readonly id: DistrictId;
  readonly tpl: RegionTemplate;
  readonly name: string;
  readonly gradeFactor: number;
  readonly obFactor: number;
  readonly finenessMean: number;
  readonly roadClass: Access;
  readonly roadWinterMaintained: boolean;
  readonly townTier: TownTier;
  readonly townName: string;
  readonly townRoadMi: number;
  readonly hubName: string;
  readonly hubRoadMi: number;
  readonly outlet: PointMi;
  /** Compass bearing pointing from the outlet into the map. */
  readonly inwardDeg: number;
  readonly townPos: PointMi;
  readonly nTarget: number;
  /** Reserve the Inheritor family run in this district (the world's first northernFederal district, §3.4). */
  readonly reserveFamilyRun: boolean;
}

export interface GenCreek {
  readonly idx: number;
  readonly id: CreekId;
  readonly order: 1 | 2 | 3;
  readonly parentIdx: number | null;
  readonly junctionRow: number | null;
  readonly lengthMi: number;
  readonly rows: number;
  readonly halfWidthFt: number;
  readonly points: readonly PointMi[];
  /** Compass bearing of each polyline segment, upstream. */
  readonly segHeadings: readonly number[];
  readonly mouthMiFromOutlet: number;
  readonly upstreamMiAtRow: readonly number[];
  readonly goldBearing: boolean;
  readonly gradeFactor: number;
  readonly noTrail: boolean;
  readonly fishBearing: boolean;
  readonly anadromous: boolean;
  readonly name: string;
}

export interface GenNetwork {
  readonly creeks: readonly GenCreek[];
  readonly overlays: readonly LandOverlay[];
}

/** §3.5.2 creek profile: 1-D row processes shared by every claim on the creek. */
export interface CreekProfile {
  readonly obFactor: number;
  readonly payFactor: number;
  readonly richLog: readonly number[];
  readonly centerFt: readonly number[];
  readonly hwLog: readonly number[];
  readonly obLog: readonly number[];
  readonly payLog: readonly number[];
}

/** A laid parcel before it has an id (§3.4). */
export interface ParcelSpec {
  readonly creekIdx: number;
  readonly rowStart: number;
  readonly nAlong: number;
  readonly nAcross: number;
  readonly acres: number;
  /** 0 for valley parcels; −1 left / +1 right bench, looking upstream. */
  readonly side: -1 | 0 | 1;
  readonly axisOffsetFt: number;
  readonly depositType: DepositType;
  readonly familyRun: boolean;
  /**
   * Arid washes: the valley parcel lies on the fan that spreads from the district outlet (§3.4 valleyType, as revised:
   * the parcels nearest the outlet by channel miles until the template's fan share is met). False on creek templates.
   */
  readonly fanZone: boolean;
}

/** A laid parcel with its id, position and claim-level derived facts. */
export interface GenClaim extends ParcelSpec {
  readonly id: ClaimId;
  readonly blockIdBase: number;
  readonly sizeSetting: SizeSetting;
  readonly proximal: boolean;
  /** cos of the direction a bench slope faces (toward the creek); +1 faces north; 0 for valley parcels (§3.4.1). */
  readonly northness: number;
  readonly centerMi: PointMi;
  readonly headingDeg: number;
  readonly midRow: number;
}
