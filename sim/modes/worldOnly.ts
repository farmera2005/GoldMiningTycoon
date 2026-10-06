// `--world-only` (DESIGN §2.12; BALANCE §2 "500 seeds, no bots"): newGame for N seeds without advancing a week, each
// state handed, in seed order, to every registered collector. Collectors compute world statistics (§3 class shares,
// grade and strip bands) and must read only the state they are given; their result goes into summary.json.
import { hashState, type GameState } from '../../src/engine';
import {
  bandChecks,
  createWorldStatsAccumulator,
  type BandCheck,
  type TemplateStats,
} from '../calibration/world-stats';
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

export interface WorldClassStats {
  worlds: number;
  templates: Record<string, TemplateStats>;
  bands: BandCheck[];
}

/**
 * §3's world statistics (§3.7 class shares, §3.18 grade, strip and parcel bands; BALANCE T-01, T-02) over the same
 * worlds the bots play: the `world` slice of each newGame state. Truth-reading, like every calibration harness; the
 * result is data in summary.json, never an input to a bot.
 */
export function worldStatsCollector(): WorldStatsCollector {
  const acc = createWorldStatsAccumulator();
  // The world's own genParams snapshot (D-3.2) carries the prior and honesty settings it was generated with.
  let gp: GameState['world']['genParams'] | null = null;
  return {
    id: 'world',
    add(_index, state) {
      gp ??= state.world.genParams;
      acc.add(state.world);
    },
    result(): WorldClassStats {
      const templates = acc.templates();
      const bands =
        gp === null
          ? []
          : bandChecks(
              { worlds: acc.worlds, seedBase: 0, meanGenMs: 0, meanWorldKb: 0, templates },
              gp.prior.statusMult.listed,
              0,
              gp.seller.honestyMix,
            );
      return { worlds: acc.worlds, templates, bands };
    },
  };
}

/** Collector factories by id, run in this order on every world-only run. */
export const WORLD_COLLECTORS: Readonly<Record<string, () => WorldStatsCollector>> = {
  default: defaultWorldCollector,
  world: worldStatsCollector,
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
