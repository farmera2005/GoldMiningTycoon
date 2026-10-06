// §9 catalog types (DESIGN §9 9.2.1, 9.2.3, 9.2.6). The catalog is data: classes, models, brands and dealer packages.
// The id unions (ModelId, BrandId, SizeKey, PackageId) are derived from the catalog literals in ./index.ts; the row
// types here use plain strings for cross-references so the catalog files can be written without a type cycle, and
// the typed views in ./index.ts narrow them (a misspelled id in a brand's `makes` or a package item fails to compile).
import type { ClimateBand } from '../../engine/systems/world/enums';
import type { CampTier, ConcentratorDevice, OpsRoleK, Prep } from '../../engine/systems/ops/kernel/types';

export type { CampTier, ConcentratorDevice, Prep };

/** §9 9.2.1 equipment classes. */
export type ClassId =
  | 'excavator'
  | 'dozer'
  | 'artTruck'
  | 'loader'
  | 'washPlant'
  | 'recovery'
  | 'pump'
  | 'generator'
  | 'drill'
  | 'conveyor'
  | 'roadTruck'
  | 'site';

/** 9.2.1's "Family" column: the component list and hazard profile (9.2.5). `none` = site items (no components). */
export type ComponentFamily = 'excavator' | 'dozer' | 'wheeled' | 'plant' | 'recovery' | 'light' | 'none';

/** 9.3.2's depreciation curves, the `<family>` of `fleet.depCurve.<family>` and of `fleet.hoursWeight`. */
export type DepFamily = 'excavator' | 'dozer' | 'wheeled' | 'plant' | 'light';

/** 9.10's book-depreciation families (`fleet.bookLifeYears`, `fleet.bookResidual`). */
export type BookFamily = 'excavator' | 'dozer' | 'wheeled' | 'plant' | 'light' | 'site';

/** 9.7.2 `machineEffectiveRate` unit. */
export type RateUnit = 'bcyHr' | 'bcyPerLoad' | 'gpm' | 'kW' | 'ftHr';

/** The catalog spec field 9.7.2's spec(m) reads for a class (9.2.1 "Spec unit"). */
export type RateSpecField =
  | 'rateBcyHr'
  | 'payloadBcy'
  | 'ratedBcyHr'
  | 'fineTreatCapBcyHr'
  | 'pumpGpm'
  | 'generatorKw'
  | 'drillFtHr'
  | 'stackerCapBcyHr';

/** 9.3.3 `fleet.listingClassWeights` groups: seven classes by name, every other class under `other`. */
export type ListingGroup = 'excavator' | 'dozer' | 'artTruck' | 'loader' | 'washPlant' | 'pump' | 'generator' | 'other';

/** §7 7.2 machine roles (9.2.1 "§7 roles"). */
export type MachineRole = OpsRoleK;

export interface ClassDef {
  readonly id: ClassId;
  readonly name: string;
  readonly family: ComponentFamily;
  readonly depFamily: DepFamily;
  readonly bookFamily: BookFamily;
  /** spec(m) of 9.7.2 and its unit; null for classes with no rate (road trucks, site items). */
  readonly rate: { readonly specField: RateSpecField; readonly unit: RateUnit } | null;
  /** 9.7.2's S term: an operated class needs an operator (§8 `operatorProfile`) and has no rate without one. */
  readonly operated: boolean;
  readonly roles: readonly MachineRole[];
  /**
   * 9.5 `loads = Σ heavy machine loads + ceil(Σ fractional light loads)`: light-pool items (recovery units, pumps,
   * generators, site items) share lowboys, so their loads are summed before rounding up (9.5 example: pump 0.3 +
   * generator 0.4 + camp 0.5 + 10k tank 1 + centrifuge 0.5 = 2.7 → 3).
   */
  readonly loadPool: 'heavy' | 'light';
  readonly listingGroup: ListingGroup;
}

/** §9 9.1 `MachineOption`. */
export type MachineOptionId = 'ripper' | 'fireSuppression' | 'extWarranty' | 'scrubber';

/** §9 9.2.1 `EquipmentModel.spec` (+ `hasScrubber` and `concentrator`, which §7 reads, 9.13). */
export interface EquipmentSpec {
  readonly rateBcyHr?: number;
  readonly payloadBcy?: number;
  readonly ratedBcyHr?: number;
  readonly prep?: Prep;
  readonly fineTreatCapBcyHr?: number;
  readonly pumpGpm?: number;
  readonly generatorKw?: number;
  readonly powerKw?: number;
  readonly drillFtHr?: number;
  readonly frozenOk?: boolean;
  readonly bouldersOk?: boolean;
  readonly hasRipper?: boolean;
  readonly stackerCapBcyHr?: number;
  readonly tankGal?: number;
  readonly capacity?: number;
  readonly campTier?: CampTier;
  readonly security?: number;
  readonly extraRatedBcyHr?: number;
  /** Excavators: §4 test-pit depth (9.2.2). */
  readonly reachFt?: number;
  /** campSafe, goldRoom. */
  readonly hasSafe?: boolean;
  /** The scrubber add-on sets the plant's `hasScrubber` (9.2.3; §7 7.9 clay scrubbing). */
  readonly hasScrubber?: boolean;
  /** Recovery units: which 7.9 base-capture row the unit runs (jig or centrifuge). */
  readonly concentrator?: ConcentratorDevice;
}

/** §9 9.2.1 `EquipmentModel.transport` (+ `selfPropelled`: road vehicles drive at `fleet.driveUsdPerMile`, 9.5). */
export interface EquipmentTransport {
  /** Lowboy loads; fractional for light-pool items (9.2.3–9.2.4). */
  readonly loads: number;
  /** Needs one oversize permit (`fleet.permitOsUsd`); every overweight (OW) row in 9.2.2 is also OS. */
  readonly oversize: boolean;
  readonly superload: boolean;
  /** Can fly (9.5 `air`); priced by `weightLb`. */
  readonly airliftable: boolean;
  /** Rigging crew hours to assemble on arrival (plants; 9.5). Absent = none. */
  readonly assemblyCrewHours?: number;
  readonly selfPropelled: boolean;
}

/** A catalog row (DESIGN 9.2.1 `EquipmentModel`) with string cross-references; see ./index.ts for the typed view. */
export interface EquipmentModelRow {
  readonly id: string;
  readonly classId: ClassId;
  /** The catalog size slot; one model per slot, so it equals `id` (brands make a slot, 9.2.6). */
  readonly sizeKey: string;
  /** The model's reference brand: its `p1DefaultBrandId` (the slot is brand-agnostic; machines and listings carry their own brand). */
  readonly brandId: string;
  readonly name: string;
  /** Tier-1 reference list price, year-1 USD (list = newBaseUsd × brand.newPriceMult × cpiIndex × newMult). */
  readonly newBaseUsd: number;
  /** Labor and PM scaling (9.2.5 `fleet.sizeLaborScale`, 9.8.1). */
  readonly scale: 'small' | 'medium' | 'large';
  readonly spec: EquipmentSpec;
  readonly hp?: number;
  /** Gal/hr at medium load (load factor 1.0); 0 for electric or unpowered items. */
  readonly gph: number;
  readonly weightLb: number;
  readonly transport: EquipmentTransport;
  /** §11 MACRS class: road trucks and pickups lightTruck5, everything else mining7 (R4 §8). */
  readonly taxClass: 'mining7' | 'lightTruck5';
  readonly firstYear: number;
  readonly lastYear?: number;
  /** Model years from this one carry DEF/DPF aftertreatment (9.2.6). Absent = no Tier-4 diesel. */
  readonly tier4FromYear?: number;
  /** Phase-3 rows ship in P1 as data that fixtures and tests may build; P1–P2 markets never list them (D-9.57). */
  readonly phase: 1 | 3 | 5 | 6;
  /** Brand of dealer-new units and dealer graded-used offers below rules 3 (D-9.71). */
  readonly p1DefaultBrandId: string;
}

export interface BrandWarranty {
  readonly weeks: number;
  /** Absent = unlimited hours. */
  readonly hours?: number;
  readonly scope: 'full' | 'powertrain' | 'structure';
}

/** A brand row (DESIGN 9.2.6 `Brand`) with string cross-references (+ `makes`, `dealerOnlyIn`, `usedAgeYr`). */
export interface BrandRow {
  readonly id: string;
  readonly name: string;
  readonly newPriceMult: number;
  readonly hazardMult: number;
  readonly partsCostMult: number;
  readonly partsLeadMult: number;
  readonly retention: number;
  readonly fuelMult: number;
  readonly captive: boolean;
  /** P(a district hub has this brand's dealer), rolled at world generation on `fleet-world` (9.2.6). */
  readonly dealerP: number;
  /** The climate bands whose hubs may have the dealer (Klondike: northern hubs only); absent = every hub. */
  readonly dealerOnlyIn?: readonly ClimateBand[];
  /** Market share by class: the brand's listing weight among the brands that make a model of the class. */
  readonly share: Readonly<Partial<Record<ClassId, number>>>;
  readonly warranty: readonly BrandWarranty[];
  readonly pmPartsFree?: { readonly weeks: number; readonly hours: number };
  readonly defunctYear?: number;
  /** 9.2.6 "Makes": the catalog models (size slots) this brand builds. */
  readonly makes: readonly string[];
  /** 9.3.3's brand age limits on used listings ("Marlow ≥ 16; Tianlong ≤ 12"). */
  readonly usedAgeYr?: { readonly min?: number; readonly max?: number };
}

/** A dealer turnkey spread (DESIGN 9.2.3 `EquipmentPackage`) with string cross-references (+ `phase`). */
export interface EquipmentPackageRow {
  readonly id: string;
  readonly name: string;
  readonly items: readonly { readonly modelId: string; readonly brandId: string }[];
  /** Price = Σ item list × (1 − discountPct); the default is `fleet.packageDiscountPct`. */
  readonly discountPct: number;
  /** Replaces the items' own assembly hours. */
  readonly assemblyCrewHours: number;
  readonly phase: 1 | 3 | 5 | 6;
}

/** §9 `InheritedFleetSpec` (D-9.61) with a string model id; ./index.ts narrows it. */
export interface InheritedFleetSpecRow {
  readonly items: readonly {
    readonly modelId: string;
    readonly ageYears: number;
    readonly hours: number;
    readonly options: readonly MachineOptionId[];
  }[];
}
