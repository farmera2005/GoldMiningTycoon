// Step 15 · Distress (DESIGN §2.6): §11 (a) reorganization case → (b) stage evaluation, acceleration, repossessions,
// P1 insolvency counter → (c) involuntary triggers and the liquidation flag (`finance.distress.liquidation`) that step
// 16d reads; §5 and §9 as called (part 15.1).
import type { StepDef } from '../types';

export const step15Distress: StepDef = { index: 15, name: 'Distress', sections: [11, 5, 9] };
