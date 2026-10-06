// Step 14 · Finance (DESIGN §2.6; §11 11.22 a–k): accruals → payroll → bills → receipts before payments → one
// priority settlement → statuses → borrowing base → month end → quarter end → annual items → sweeps (part 14.1, which
// calls §8's payroll and §1's owner items itself; no other section has a part in steps 13–15).
import type { StepDef } from '../types';

export const step14Finance: StepDef = { index: 14, name: 'Finance', sections: [11] };
