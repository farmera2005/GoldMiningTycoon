// §9's seam to the equipment catalog (DESIGN §9 9.2; P1 contract §4.9). The catalog is data that `fleet-catalog` owns
// in src/data/equipment, with the id unions (ModelId, BrandId, SizeKey) derived from its literals. This file is the one
// place the engine reads it: `modelOf` and `classOf` are real lookups (contract: "real; the catalog may be empty until
// the §9 package"), and every other §9 file imports the catalog types from here. Until the catalog package has merged
// the tables are empty and the id types are plain strings; at that merge this file's types become re-exports of
// src/data/equipment and the two tables its EQUIPMENT_MODELS and EQUIPMENT_CLASSES, and nothing else changes.
import { sortedKeysByCodeUnit } from '../../core/iter';

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

/** A catalog model id (narrowed to the catalog's literal union once the catalog has merged). */
export type ModelId = string;
/** The catalog size slot, e.g. 'ex30' (one model per slot). */
export type SizeKey = string;
export type BrandId = string;
/** §9 9.1 `MachineOption`. */
export type MachineOptionId = 'ripper' | 'fireSuppression' | 'extWarranty' | 'scrubber';

/** 9.2.1's family column (component list and hazard profile; `none` = site items). */
export type ComponentFamily = 'excavator' | 'dozer' | 'wheeled' | 'plant' | 'recovery' | 'light' | 'none';

/** The fields of a class definition the engine reads (the catalog's `ClassDef` is a superset). */
export interface ClassDef {
  readonly id: ClassId;
  readonly name: string;
  readonly family: ComponentFamily;
  /** 9.7.2's S term: an operated class needs an operator. */
  readonly operated: boolean;
  readonly loadPool: 'heavy' | 'light';
}

/** DESIGN 9.2.1 `EquipmentModel` (the fields the engine reads; the catalog's type is a superset). */
export interface EquipmentModel {
  readonly id: ModelId;
  readonly classId: ClassId;
  readonly sizeKey: SizeKey;
  readonly brandId: BrandId;
  readonly name: string;
  readonly newBaseUsd: number;
  readonly scale: 'small' | 'medium' | 'large';
  readonly spec: Readonly<Record<string, number | boolean | string | undefined>>;
  readonly hp?: number;
  readonly gph: number;
  readonly weightLb: number;
  readonly transport: {
    readonly loads: number;
    readonly oversize: boolean;
    readonly superload: boolean;
    readonly airliftable: boolean;
    readonly assemblyCrewHours?: number;
  };
  readonly taxClass: 'mining7' | 'lightTruck5';
  readonly firstYear: number;
  readonly lastYear?: number;
  readonly tier4FromYear?: number;
  readonly phase: 1 | 3 | 5 | 6;
  readonly p1DefaultBrandId: BrandId;
}

/** DESIGN 9.1 `InheritedFleetSpec` (D-9.61; the data lives in the catalog). */
export interface InheritedFleetSpec {
  readonly items: readonly {
    readonly modelId: ModelId;
    readonly ageYears: number;
    readonly hours: number;
    readonly options: readonly MachineOptionId[];
  }[];
}

const MODELS: Readonly<Record<ModelId, EquipmentModel>> = {};
const CLASSES: Readonly<Partial<Record<ClassId, ClassDef>>> = {};

export class FleetLookupError extends Error {
  constructor(
    readonly code: 'MODEL_UNKNOWN' | 'CLASS_UNKNOWN',
    readonly id: string,
  ) {
    super(`${code}: ${id}`);
    this.name = 'FleetLookupError';
  }
}

export function modelOf(modelId: ModelId): EquipmentModel {
  const m = Object.prototype.hasOwnProperty.call(MODELS, modelId) ? MODELS[modelId] : undefined;
  if (m === undefined) throw new FleetLookupError('MODEL_UNKNOWN', modelId);
  return m;
}

export function classOf(classId: ClassId): ClassDef {
  const c = CLASSES[classId];
  if (c === undefined) throw new FleetLookupError('CLASS_UNKNOWN', classId);
  return c;
}

/** Every catalog model id in code-unit order (empty until the catalog has merged). */
export function catalogModelIds(): ModelId[] {
  return sortedKeysByCodeUnit(MODELS);
}
