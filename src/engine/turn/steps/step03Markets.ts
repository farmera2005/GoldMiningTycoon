// Step 3 · Markets refresh (DESIGN §2.6, D-2.11): §5 (a) [calling §3 supplyTick first] → §5 (b)–(e) → §4 → §8 → §9.
// §4, §8 and §9 read no step-3 output of one another, so their relative order cannot change a result.
// P0 stub (no listings, contractors, labor market or equipment market yet).
import type { PipelineStep } from '../types';

export const step03Markets: PipelineStep = {
  index: 3,
  name: 'Markets refresh',
  sections: [3, 5, 4, 8, 9],
  run: (s) => s,
};
