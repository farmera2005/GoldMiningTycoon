// §8 staff pipeline parts (DESIGN §8.15, §2.6; P1 contract §3) and its init part N8 (contract §1.5). Each part names
// its step, its position in the step's §2.6 sub-order and the first rules phase it runs under; the table test pins the
// order.
import { initPart, mutatorPart } from '../../state/partKit';
import type { InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { availability, hoursAndFatigue, initPools, laborMarket, wrapUp, yearStart } from './week';

export const STAFF_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'staff.yearStart', step: 1, order: 3, section: 8, fromPhase: 1 }, yearStart),
  mutatorPart({ id: 'staff.laborMarket', step: 3, order: 3, section: 8, fromPhase: 1 }, laborMarket),
  mutatorPart({ id: 'staff.availability', step: 7, order: 3, section: 8, fromPhase: 1 }, availability),
  mutatorPart({ id: 'staff.hoursAndFatigue', step: 10, order: 5, section: 8, fromPhase: 1 }, hoursAndFatigue),
  mutatorPart({ id: 'staff.wrapUp', step: 16, order: 9, section: 8, fromPhase: 1 }, wrapUp),
];

export const STAFF_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'staff.initPools', order: 8, section: 8, fromPhase: 1 }, initPools),
];
