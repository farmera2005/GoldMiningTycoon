// §9's seam to the equipment catalog (DESIGN §9 9.2; P1 contract §4.9). The catalog is data that `fleet-catalog` owns
// in src/data/equipment, with the id unions (ModelId, BrandId, SizeKey) derived from its literals. This file is the one
// place the engine reads it: every other §9 file imports the catalog types and lookups from here.
import { sortedKeysByCodeUnit } from '../../core/iter';
import {
  EQUIPMENT_CLASSES,
  EQUIPMENT_MODELS,
  isModelId,
  type ClassDef,
  type ClassId,
  type EquipmentModel,
  type ModelId,
} from '../../../data/equipment';

export type {
  BrandId,
  ClassDef,
  ClassId,
  ComponentFamily,
  EquipmentModel,
  InheritedFleetSpec,
  MachineOptionId,
  ModelId,
  SizeKey,
} from '../../../data/equipment';

const MODELS: Readonly<Record<ModelId, EquipmentModel>> = EQUIPMENT_MODELS;
const CLASSES: Readonly<Partial<Record<ClassId, ClassDef>>> = EQUIPMENT_CLASSES;

export class FleetLookupError extends Error {
  constructor(
    readonly code: 'MODEL_UNKNOWN' | 'CLASS_UNKNOWN',
    readonly id: string,
  ) {
    super(`${code}: ${id}`);
    this.name = 'FleetLookupError';
  }
}

export function modelOf(modelId: string): EquipmentModel {
  const m = isModelId(modelId) ? MODELS[modelId] : undefined;
  if (m === undefined) throw new FleetLookupError('MODEL_UNKNOWN', modelId);
  return m;
}

export function classOf(classId: ClassId): ClassDef {
  const c = CLASSES[classId];
  if (c === undefined) throw new FleetLookupError('CLASS_UNKNOWN', classId);
  return c;
}

/** Every catalog model id in code-unit order. */
export function catalogModelIds(): ModelId[] {
  return sortedKeysByCodeUnit(MODELS);
}
