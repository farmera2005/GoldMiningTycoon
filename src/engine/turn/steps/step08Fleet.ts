// Step 8 · Fleet availability (DESIGN §2.6): §9 grounding, due PM and baseline orders, shop plans per site and per
// district pool, return projections, fleetAvailability for §7 and §4. P0 stub.
import type { PipelineStep } from '../types';

export const step08Fleet: PipelineStep = { index: 8, name: 'Fleet availability', sections: [9], run: (s) => s };
