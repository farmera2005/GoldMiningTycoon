// Step 14 · Finance (DESIGN §2.6; §11 11.22 a–k): accruals → payroll → bills → receipts before payments → one
// priority settlement → statuses → borrowing base → month end → quarter end → annual items → sweeps. P0 stub (no
// bills, payroll or loans yet; the week calendar from step 1 carries the month/quarter/year flags it will read).
import type { PipelineStep } from '../types';

export const step14Finance: PipelineStep = { index: 14, name: 'Finance', sections: [11], run: (s) => s };
