// §1 climate pipeline parts (DESIGN §2.6; P1 contract §3): this folder's entries in the part table that
// turn/parts.ts concatenates, and its newGame init part (contract §1.5). Each names its step (or init order), its
// position in the §2.6 sub-order and the first rules phase it runs under; the table tests pin the order.
import { initPart, mutatorPart } from '../../state/partKit';
import type { InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { initClimate, seasonWeek } from './week';

export const CLIMATE_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'climate.seasonWeek', step: 1, order: 2, section: 1, fromPhase: 1 }, seasonWeek),
];

export const CLIMATE_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'climate.init', order: 2, section: 1, fromPhase: 1 }, initClimate),
];
