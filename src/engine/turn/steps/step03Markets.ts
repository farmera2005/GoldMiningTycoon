// Step 3 · Markets refresh (DESIGN §2.6, D-2.11): §5 (a) [calling §3 supplyTick first] → §5 (b)–(e) → §4 → §8 → §9,
// as the parts 3.1–3.4. §4, §8 and §9 read no step-3 output of one another, so their relative order cannot change a
// result (the declared sub-order independence test permutes them through the part-order seam, turn/seams.ts).
import type { StepDef } from '../types';

export const step03Markets: StepDef = { index: 3, name: 'Markets refresh', sections: [3, 5, 4, 8, 9] };
