// One world's share of the §4 estimator calibration: generate the world with §3's engine generator, then run every
// eligible claim's evidence stages for the populations whose cells are still open. Used in-process and by the worker.
import { readFileSync } from 'node:fs';
import { baseTuning, type TuningResolved } from '../../src/data/tuning';
import { generateWorld, type Claim } from '../../src/engine/systems/world';
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
      if (!Object.prototype.hasOwnProperty.call(baseTuning, key)) throw new Error(`--tuning: unknown tuning key ${key}`);
    }
    tuning = { ...baseTuning, ...overrides } as TuningResolved;
  }
  cachedTuning = { file, tuning };
  return tuning;
}

export function runWorld(task: WorldTask): WorldResult {
  const seed = String(task.seedBase + task.worldIndex);
  const tuning = tuningFrom(task.tuningFile);
  const t0 = performance.now();
  const world = generateWorld(seed, { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] }, tuning);
  const genMs = performance.now() - t0;
  const h = harnessContext(world, tuning);
  const open = new Set(task.openCells);
  const results: ClaimResult[] = [];
  for (const id of world.claimIds) {
    const claim = world.claims[id] as Claim;
    if (claim.status !== 'heldNpc') continue;
    if (task.populations.includes('held')) {
      const cells = heldCells(world, claim).filter((c) => open.has(`held:${c}`));
      if (cells.length > 0) results.push({ population: 'held', cells, run: runClaim(world, id, seed, h, 'held', task.stages) });
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
