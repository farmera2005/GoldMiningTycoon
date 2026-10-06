// §1 investors pipeline parts (DESIGN §2.6; P1 contract §3): this folder's entries in the part table that
// turn/parts.ts concatenates. Each part names its step, its position in the step's §2.6 sub-order and the first rules
// phase it runs under; the table test pins the order.
import { mutatorPart } from '../../state/partKit';
import type { PipelinePart } from '../../turn/types';
import { investorsWeekly } from './waterfall';

export const INVESTORS_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'investors.weekly', step: 16, order: 2, section: 1, fromPhase: 1 }, investorsWeekly),
];
