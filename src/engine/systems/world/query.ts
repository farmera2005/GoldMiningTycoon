// Engine-internal lookups over the world slice (DESIGN §3.14): decoded truth (hidden: engine physics, the simulator,
// tests and the dev reveal only), block coordinates and block state (visible), and the draw context drawSample needs.
import { formatId, parseId, type BlockId, type ClaimId } from '../../core/ids';
import { decodeClaimTruth } from './pack';
import { templateOf } from './params';
import { UNTOUCHED_BLOCK } from './sample';
import type { BlockState, BlockTruth, Claim, ClaimTruth, DrawContext, SurfaceCode, WorldSlice } from './types';

/** Accepts a GameState or a bare world slice. */
export type WorldHolder = { readonly world: WorldSlice } | WorldSlice;

function worldOf(h: WorldHolder): WorldSlice {
  return 'world' in h ? h.world : h;
}

function claimOf(world: WorldSlice, claimId: ClaimId): Claim {
  const c = world.claims[claimId];
  if (c === undefined) throw new RangeError(`unknown claim ${claimId}`);
  return c;
}

/** claimTruth(state, claimId): decoded, memoized by (claimId, truthHash) (D-3.32). Never for UI or bot selectors. */
export function claimTruth(h: WorldHolder, claimId: ClaimId): ClaimTruth {
  const c = claimOf(worldOf(h), claimId);
  return decodeClaimTruth(c.id, c.hidden.truthPack, c.hidden.truthHash);
}

export interface BlockCoords {
  readonly claimId: ClaimId;
  readonly blockIdx: number;
  /** Along the valley: 0 = downstream end, increasing upstream. */
  readonly i: number;
  /** Across: 0 = left bank looking upstream. */
  readonly j: number;
}

/**
 * blockCoords(blockId) (§3.5.1, visible). Block ids are allocated per claim in claim-id order, so the owning claim is
 * found by binary search on blockIdBase.
 */
export function blockCoords(h: WorldHolder, blockId: BlockId): BlockCoords {
  const world = worldOf(h);
  const parsed = parseId(blockId);
  if (parsed === null || parsed.prefix !== 'blk' || parsed.num === null) throw new RangeError(`not a block id: ${blockId}`);
  const n = parsed.num;
  const ids = world.claimIds;
  let lo = 0;
  let hi = ids.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const c = claimOf(world, ids[mid] as ClaimId);
    if (c.blockIdBase <= n) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) throw new RangeError(`unknown block ${blockId}`);
  const c = claimOf(world, ids[found] as ClaimId);
  const idx = n - c.blockIdBase;
  if (idx >= c.nAlong * c.nAcross) throw new RangeError(`unknown block ${blockId}`);
  return { claimId: c.id, blockIdx: idx, i: Math.floor(idx / c.nAcross), j: idx % c.nAcross };
}

export function blockIdOf(claim: Pick<Claim, 'blockIdBase'>, blockIdx: number): BlockId {
  return formatId('blk', claim.blockIdBase + blockIdx);
}

/** blockTruth(state, blockId): hidden, engine-internal. */
export function blockTruth(h: WorldHolder, blockId: BlockId): BlockTruth {
  const co = blockCoords(h, blockId);
  const bt = claimTruth(h, co.claimId).blocks[co.blockIdx];
  if (bt === undefined) throw new RangeError(`unknown block ${blockId}`);
  return bt;
}

/** Block state (sparse; an untouched block reads as all zero). Visible. */
export function blockStateOf(h: WorldHolder, blockId: BlockId): BlockState {
  return worldOf(h).blockStates[blockId] ?? UNTOUCHED_BLOCK;
}

/** The visible surface code and the world's physics snapshot for a block (drawSample's context). */
export function drawContextFor(h: WorldHolder, blockId: BlockId): DrawContext {
  const world = worldOf(h);
  const co = blockCoords(world, blockId);
  const c = claimOf(world, co.claimId);
  const d = world.districts[c.districtId];
  if (d === undefined) throw new RangeError(`unknown district ${c.districtId}`);
  return {
    surface: (c.env.surfaceCodes[co.blockIdx] ?? 'u') as SurfaceCode,
    climateBand: templateOf(world.genParams, d.templateId).climateBand,
    physics: world.genParams.sample,
  };
}
