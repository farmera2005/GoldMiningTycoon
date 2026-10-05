// §3 world generation entry point (DESIGN §3.1, §3.14 Provides). The P0 world agent replaces the body;
// the signature is the contract newGame (src/engine/state) calls.
import type { TuningResolved } from '../../../data/tuning';
import type { WorldSlice } from './types';

export interface WorldGenOptions {
  /** Number of districts; P0/P1 worlds use 2 (northernFederal + aridFederal). */
  readonly districtCount: number;
  /** Region template ids, one per district, in district order (§1 setup.world.districtTemplates). */
  readonly templateIds: readonly string[];
  /** Optional cap per district (§3 3.1). */
  readonly parcelsPerDistrict?: number;
}

export function generateWorld(_seed: string, _opts: WorldGenOptions, _tuning: TuningResolved): WorldSlice {
  return {};
}
