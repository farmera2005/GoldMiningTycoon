// §5 land and tenure pipeline parts (DESIGN §2.6; P1 contract §3): this folder's entries in the part table that
// turn/parts.ts concatenates. Each part names its step, its position in the step's §2.6 sub-order and the first rules
// phase it runs under; the table test pins the order.
import type { PipelinePart } from '../../turn/types';

export const LAND_PARTS: readonly PipelinePart[] = [];
