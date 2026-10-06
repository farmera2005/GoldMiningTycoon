// One world's share of the §4 estimator calibration: generate the world with §3's engine generator, then run every
// eligible claim's evidence stages for the populations whose cells are still open. Used in-process and by the worker.
import { readFileSync } from 'node:fs';
import { baseTuning, type TuningResolved } from '../../src/data/tuning';
import { compareIds, type ClaimId } from '../../src/engine/core/ids';
import { rng } from '../../src/engine/core/rng';
import { generateWorld, type Claim, type WorldSlice } from '../../src/engine/systems/world';
import { heldCells, inListingPool, listedCell, type Population } from './estimator-cells';
import { harnessContext, runClaim, type ClaimRun, type Stage } from './estimator-stages';

export interface WorldTask {
  readonly worldIndex: number;
  readonly seedBase: number;
  readonly stages: readonly Stage[];
  readonly populations: readonly Population[];
  /** Cells still open when the task was dispatched (a cell full then stays full, so skipping is deterministic). */
  readonly openCells: readonly string[];
  readonly tuningFile?: string;
}

export interface ClaimResult {
  readonly population: Population;
  readonly cells: readonly string[];
  readonly run: ClaimRun;
}

export interface WorldResult {
  readonly worldIndex: number;
  readonly results: readonly ClaimResult[];
  readonly genMs: number;
  readonly runMs: number;
}

let cachedTuning: { file: string | undefined; tuning: TuningResolved } | null = null;

export function tuningFrom(file: string | undefined): TuningResolved {
  if (cachedTuning !== null && cachedTuning.file === file) return cachedTuning.tuning;
  let tuning: TuningResolved = baseTuning;
  if (file !== undefined) {
    const overrides = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    for (const key of Object.keys(overrides)) {
      if (!Object.prototype.hasOwnProperty.call(baseTuning, key))
        throw new Error(`--tuning: unknown tuning key ${key}`);
    }
    tuning = { ...baseTuning, ...overrides } as TuningResolved;
  }
  cachedTuning = { file, tuning };
  return tuning;
}

/** The calibration world for a seed: one northern and one arid district from §3's engine generator. */
export function calibrationWorld(seed: string, tuning: TuningResolved = baseTuning): WorldSlice {
  return generateWorld(seed, { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] }, tuning);
}

/**
 * The world's claims in a seeded pseudo-random order (ties by id). A sample that takes a few claims per world in this
 * order is a random draw from the world's claims; id order is not (ids run along each creek from its first row).
 */
export function calibrationOrder(world: WorldSlice, seed: string): ClaimId[] {
  const key: Record<string, number> = {};
  for (const id of world.claimIds) key[id] = rng(seed, 'sample', 'calibrationOrder', id).next();
  return world.claimIds.slice().sort((a, b) => (key[a] as number) - (key[b] as number) || compareIds(a, b));
}

export function runWorld(task: WorldTask): WorldResult {
  const seed = String(task.seedBase + task.worldIndex);
  const tuning = tuningFrom(task.tuningFile);
  const t0 = performance.now();
  const world = calibrationWorld(seed, tuning);
  const genMs = performance.now() - t0;
  const h = harnessContext(world, tuning);
  const open = new Set(task.openCells);
  const results: ClaimResult[] = [];
  for (const id of world.claimIds) {
    const claim = world.claims[id] as Claim;
    if (claim.status !== 'heldNpc') continue;
    if (task.populations.includes('held')) {
      const cells = heldCells(world, claim).filter((c) => open.has(`held:${c}`));
      if (cells.length > 0)
        results.push({ population: 'held', cells, run: runClaim(world, id, seed, h, 'held', task.stages) });
    }
    if (task.populations.includes('listed')) {
      const cell = listedCell(world, claim);
      if (cell !== null && open.has(`listed:${cell}`) && inListingPool(world, claim, seed)) {
        results.push({ population: 'listed', cells: [cell], run: runClaim(world, id, seed, h, 'listed', task.stages) });
      }
    }
  }
  return { worldIndex: task.worldIndex, results, genMs, runMs: performance.now() - t0 - genMs };
}
