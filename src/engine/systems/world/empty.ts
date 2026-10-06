// An empty world (no districts) with the base-tuning snapshot: test fixtures and placeholders only. newGame builds the
// real slice with generateWorld (DESIGN §3.1).
import { baseTuning } from '../../../data/tuning';
import { snapshotGenParams } from './params';
import type { WorldSlice } from './types';

export function emptyWorldSlice(): WorldSlice {
  return {
    genParams: snapshotGenParams(baseTuning, []),
    districts: {},
    districtIds: [],
    creeks: {},
    claims: {},
    claimIds: [],
    blockStates: {},
    holders: {},
    siteVisits: {},
    watch: { districtIds: [], claimIds: [] },
    supplyQueue: [],
    familyRunClaimIds: [],
    foundTells: {},
  };
}
