// Region templates (DESIGN §3.2). P1 ships northernFederal and aridFederal; temperateFederal, alaskaState and yukon
// arrive with P6.
import type { RegionTemplate, RegionTemplateId } from '../../engine/systems/world/types';
import { aridFederal } from './aridFederal';
import { northernFederal } from './northernFederal';

export { bedrockTable } from './bedrock';
export type { BedrockDef } from './bedrock';
export { holderNames } from './names';
export { townServicesByTier } from './towns';

export const regionTemplates = {
  northernFederal,
  aridFederal,
} as const satisfies Partial<Record<RegionTemplateId, RegionTemplate>>;

export type ShippedRegionTemplateId = keyof typeof regionTemplates;

/** The template for an id, or undefined when that template has not shipped yet. */
export function regionTemplate(id: string): RegionTemplate | undefined {
  switch (id) {
    case 'northernFederal':
      return regionTemplates.northernFederal;
    case 'aridFederal':
      return regionTemplates.aridFederal;
    default:
      return undefined;
  }
}
