// §9 equipment catalog (DESIGN §9 9.2): the typed views of the catalog files. The id unions are derived from the
// literals (contract §4.9: "ModelId / BrandId / ClassId / SizeKey string unions derived from the catalog"); assigning
// the literal tables to the typed records below is the compile-time cross-reference check (a brand that makes an
// unknown model, a package item with an unknown brand, or a model whose default brand is misspelled fails tsc).
// The engine reads the catalog through §9's `modelOf` / `classOf` (systems/fleet); src/data/equipment/catalog.test.ts
// validates values and the remaining cross-references.
import { equipmentBrands } from './brands';
import { CLASS_IDS, equipmentClasses } from './classes';
import { inheritedFleetSpec } from './inheritedFleet';
import { equipmentModels } from './models';
import { equipmentPackages } from './packages';
import type {
  BrandRow,
  ClassDef,
  ClassId,
  EquipmentModelRow,
  EquipmentPackageRow,
  InheritedFleetSpecRow,
  MachineOptionId,
} from './types';

export type * from './types';
export { CLASS_IDS };

export type ModelId = keyof typeof equipmentModels;
/** The catalog size slot (one model per slot, so a SizeKey is a ModelId). */
export type SizeKey = ModelId;
export type BrandId = keyof typeof equipmentBrands;
export type PackageId = keyof typeof equipmentPackages;

/** DESIGN 9.2.1 `EquipmentModel`. */
export type EquipmentModel = Omit<EquipmentModelRow, 'id' | 'sizeKey' | 'brandId' | 'p1DefaultBrandId'> & {
  readonly id: ModelId;
  readonly sizeKey: SizeKey;
  readonly brandId: BrandId;
  readonly p1DefaultBrandId: BrandId;
};

/** DESIGN 9.2.6 `Brand`. */
export type Brand = Omit<BrandRow, 'id' | 'makes'> & { readonly id: BrandId; readonly makes: readonly ModelId[] };

/** DESIGN 9.2.3 `EquipmentPackage`. */
export type EquipmentPackage = Omit<EquipmentPackageRow, 'id' | 'items'> & {
  readonly id: PackageId;
  readonly items: readonly { readonly modelId: ModelId; readonly brandId: BrandId }[];
};

/** DESIGN 9.1 `InheritedFleetSpec` (D-9.61). */
export type InheritedFleetSpec = Omit<InheritedFleetSpecRow, 'items'> & {
  readonly items: readonly {
    readonly modelId: ModelId;
    readonly ageYears: number;
    readonly hours: number;
    readonly options: readonly MachineOptionId[];
  }[];
};

export const EQUIPMENT_CLASSES: Readonly<Record<ClassId, ClassDef>> = equipmentClasses;
export const EQUIPMENT_MODELS: Readonly<Record<ModelId, EquipmentModel>> = equipmentModels;
export const EQUIPMENT_BRANDS: Readonly<Record<BrandId, Brand>> = equipmentBrands;
export const EQUIPMENT_PACKAGES: Readonly<Record<PackageId, EquipmentPackage>> = equipmentPackages;
export const INHERITED_FLEET_SPEC: InheritedFleetSpec = inheritedFleetSpec;

/** Every catalog model id in DESIGN's table order (9.2.2–9.2.4, then the phase-3 rows). */
export const MODEL_IDS = [
  'ex20',
  'ex30',
  'dz6',
  'dz8',
  'ld950',
  'ld966',
  'adt30',
  'grz40',
  'tr50',
  'tr75',
  'tr150',
  'dw20',
  'jigS',
  'cenM',
  'pmp6',
  'gen100',
  'pickup',
  'campT8',
  'rocker',
  'drywasherHand',
  'testPlant',
  'ex45',
  'dz9',
  'adt40',
  'ld980',
  'tr300',
  'scrub',
  'cnv24',
  'cenL',
  'pmp10',
  'gen300',
  'gen500',
  'campM25',
  'tank10k',
] as const satisfies readonly ModelId[];

export const BRAND_IDS = [
  'caldera',
  'hokuto',
  'nordvik',
  'ironside',
  'tianlong',
  'marlow',
  'klondike',
  'vortex',
  'generic',
] as const satisfies readonly BrandId[];

/** §4's prospecting tools (9.2.4, D-9.47): site items rented by the day (`fleet.toolRentUsdPerDay`) or bought. */
export const TOOL_MODEL_IDS = ['rocker', 'drywasherHand', 'testPlant'] as const satisfies readonly ModelId[];

/** The models P1–P2 markets may list or sell: phase-1 rows (the 18 machines of 9.2.7 plus the three tools). */
export const P1_MODEL_IDS: readonly ModelId[] = MODEL_IDS.filter((id) => EQUIPMENT_MODELS[id].phase === 1);

/** True when `id` names a catalog model. */
export function isModelId(id: string): id is ModelId {
  return Object.prototype.hasOwnProperty.call(equipmentModels, id);
}

/** True when `id` names a brand. */
export function isBrandId(id: string): id is BrandId {
  return Object.prototype.hasOwnProperty.call(equipmentBrands, id);
}
