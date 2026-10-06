// §11 finance pipeline parts (DESIGN §2.6; P1 contract §3): this folder's entries in the part table that turn/parts.ts
// concatenates. §1's owner items and §8's payroll are called by §11 inside 14.1; no other section has a part in steps
// 13–15 besides §6's 13.1. The P4 pending-deals part (6.4) is registered empty so the order is fixed now.
import { emptyPart, mutatorPart } from '../../state/partKit';
import type { PipelinePart } from '../../turn/types';
import { distressStep, financeStep } from './week';

export const FINANCE_PARTS: readonly PipelinePart[] = [
  emptyPart({ id: 'finance.pendingDeals', step: 6, order: 4, section: 11, fromPhase: 4 }),
  mutatorPart({ id: 'finance.financeStep', step: 14, order: 1, section: 11, fromPhase: 1 }, financeStep),
  mutatorPart({ id: 'finance.distressStep', step: 15, order: 1, section: 11, fromPhase: 1 }, distressStep),
];
