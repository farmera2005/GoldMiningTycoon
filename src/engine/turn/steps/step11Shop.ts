// Step 11 · Shop (DESIGN §2.6): §9 mechanic hours on PM, repairs and rebuilds; parts; P1–P2 flat maintenance; rental,
// lease-overage and yard bills (paid in step 14). P0 stub.
import type { PipelineStep } from '../types';

export const step11Shop: PipelineStep = { index: 11, name: 'Shop', sections: [9], run: (s) => s };
