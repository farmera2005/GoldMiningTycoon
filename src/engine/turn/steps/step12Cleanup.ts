// Step 12 · Cleanup (DESIGN §2.6, D-2.10): per cleanup, claims ascending then lines ascending: §7 gold room → weigh →
// §5 settlement → §10 addLot → §11 deferred-revenue drawdowns → §4 recordProduction → §12 onCleanup; then §4 sample
// concentrates (→ §5 → §10); last §10 standing sale orders and forward/prepay delivery. P0 stub.
import type { PipelineStep } from '../types';

export const step12Cleanup: PipelineStep = {
  index: 12,
  name: 'Cleanup',
  sections: [7, 5, 10, 11, 4, 12],
  run: (s) => s,
};
