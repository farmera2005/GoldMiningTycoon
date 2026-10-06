// `--world-only` (DESIGN §2.12; BALANCE §2 "500 seeds, no bots"): newGame for N seeds without advancing a week, each
// state handed, in seed order, to every registered collector. Collectors compute world statistics (§3 class shares,
// grade and strip bands) and must read only the state they are given; their result goes into summary.json.
import { hashState, type GameState } from '../../src/engine';
import { seedFor } from '../game';
import type { WorldRunSpec } from '../protocol';
import { runWorlds, type SimPool } from '../runner';

export interface WorldStatsCollector {
  /** Stable id: the key of the collector's result in summary.json. */
  readonly id: string;
  /** Called once per seed, in ascending game index. */
  add(index: number, state: GameState): void;
  /** JSON-serializable, deterministic. */
  result(): unknown;
}

export interface WorldSeedRecord {
  index: number;
  seed: string;
  stateHash: string;
  /** UTF-8 bytes of the world slice's JSON (§2.13: the world slice budget is 1,000 kB). */
  worldBytes: number;
  tuningHash: string;
}

export interface DefaultWorldStats {
  worlds: number;
  worldBytes: { min: number; max: number; mean: number } | null;
  seeds: WorldSeedRecord[];
}

/** The build's own collector: per-seed state hash and world-slice size. */
export function defaultWorldCollector(): WorldStatsCollector {
  const seeds: WorldSeedRecord[] = [];
  return {
    id: 'default',
    add(index, state) {
      seeds.push({
        index,
        seed: state.meta.seed,
        stateHash: hashState(state),
        worldBytes: Buffer.byteLength(JSON.stringify(state.world), 'utf8'),
        tuningHash: state.meta.tuningHash,
      });
    },
    result(): DefaultWorldStats {
      if (seeds.length === 0) return { worlds: 0, worldBytes: null, seeds };
      let min = Number.POSITIVE_INFINITY;
      let max = 0;
      let sum = 0;
      for (const s of seeds) {
        min = Math.min(min, s.worldBytes);
        max = Math.max(max, s.worldBytes);
        sum += s.worldBytes;
      }
      return {
        worlds: seeds.length,
        worldBytes: { min, max, mean: Math.round((sum / seeds.length) * 100) / 100 },
        seeds,
      };
    },
  };
}

/**
 * Collector factories by id, run in this order on every world-only run.
 *
 * INTEGRATION HOOK (P0 world package): register the §3 world-statistics collector from sim/calibration/world-stats.ts
 * here, e.g. `world: () => worldStatsCollector()`, so `--world-only` and the balance world block report §3's class
 * shares and grade and strip bands (BALANCE T-01, T-02). world-stats.ts today exposes `runCalibration({ worlds,
 * seedBase })`, which generates its own worlds; the collector form takes each newGame state's `world` slice instead
 * (its per-world accumulation in `add`, its percentiles and `bandChecks` in `result`), so the statistics describe the
 * same worlds the bots play and the balance scorecard can read T-01/T-02 from summary.json.
 */
export const WORLD_COLLECTORS: Readonly<Record<string, () => WorldStatsCollector>> = {
  default: defaultWorldCollector,
};

export interface WorldOnlyResult {
  worlds: number;
  tuningHash: string | null;
  collectors: Record<string, unknown>;
}

export async function runWorldOnly(
  pool: SimPool,
  spec: WorldRunSpec,
  collectors: readonly WorldStatsCollector[] = Object.values(WORLD_COLLECTORS).map((make) => make()),
): Promise<WorldOnlyResult> {
  let tuningHash: string | null = null;
  let worlds = 0;
  await runWorlds(pool, spec, (index, state) => {
    if (state.meta.seed !== seedFor(spec.seedBase, index)) throw new Error(`world-only: seed mismatch at ${index}`);
    tuningHash ??= state.meta.tuningHash;
    worlds++;
    for (const c of collectors) c.add(index, state);
  });
  const results: Record<string, unknown> = {};
  for (const c of collectors) results[c.id] = c.result();
  return { worlds, tuningHash, collectors: results };
}

/** The world-only block's console lines (the default collector's figures). */
export function formatWorldOnly(result: WorldOnlyResult): string[] {
  const d = result.collectors['default'] as DefaultWorldStats | undefined;
  const lines = [`World only: ${result.worlds} worlds (newGame, no weeks), tuning ${result.tuningHash ?? 'n/a'}`];
  if (d !== undefined && d.worldBytes !== null) {
    lines.push(
      `  world slice JSON: min ${d.worldBytes.min} B, mean ${d.worldBytes.mean} B, max ${d.worldBytes.max} B (§2.13 budget 1,000 kB)`,
    );
    const first = d.seeds
      .slice(0, 5)
      .map((s) => `${s.seed}:${s.stateHash}`)
      .join('  ');
    lines.push(`  state hashes (first ${Math.min(5, d.seeds.length)}): ${first}`);
  }
  const others = Object.keys(result.collectors).filter((k) => k !== 'default');
  if (others.length > 0) lines.push(`  other collectors: ${others.join(', ')} (see summary.json blocks.world)`);
  return lines;
}
