// §3 init part N1 (DESIGN §3.1, D-2.13, D-2.38; P1 contract §1.5): the world is generated first, from the setup's
// district templates and the resolved tuning, and every id the generator minted is reserved in the game's counters, so
// later owners never mint a colliding id. Blocks are numbered implicitly (claim.blockIdBase + idx) and appear as strings
// only in the sparse blockStates, so a scan alone can stop short of the last block; the world's own counters cover
// every id it minted.
import { sortedKeysByCodeUnit } from '../../core/iter';
import { reserveIdsFrom } from '../../state/ids';
import type { GameState, InitCtx } from '../../state/types';
import { generateWorld, worldIdCounters } from './generate';

export function generateInto(draft: GameState, init: InitCtx): void {
  const templates = init.setup.world.districtTemplates;
  const world = generateWorld(init.seed, { districtCount: templates.length, templateIds: [...templates] }, init.tuning);
  draft.world = world;
  reserveIdsFrom(world, draft.ids);
  const minted = worldIdCounters(world);
  for (const prefix of sortedKeysByCodeUnit(minted)) {
    const n = minted[prefix] ?? 0;
    if ((draft.ids[prefix] ?? 0) < n) draft.ids[prefix] = n;
  }
}
