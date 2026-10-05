// Golden replays (DESIGN §2.3 item 5, §2.14): recorded action logs (`<name>.log.json`) with the per-week state hashes
// they must reproduce (`<name>.hashes.json`). Regenerate the hashes only for an intentional rule change, in the same
// commit, with a CHANGELOG note: `npm run goldens:update`.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES_VERSION, replayLog, type ReplayLog, type TurnHash } from '../../src/engine';

export const GOLDEN_DIR = dirname(fileURLToPath(import.meta.url));

export interface GoldenHashes {
  name: string;
  rulesVersion: string;
  /** meta.tuningHash of the replayed game (a tuning change shows here first). */
  tuningHash: string;
  weeks: number;
  hashes: TurnHash[];
}

/** Every recorded log in tests/golden, sorted by file name. */
export function goldenLogFiles(): string[] {
  return readdirSync(GOLDEN_DIR)
    .filter((f) => f.endsWith('.log.json'))
    .sort()
    .map((f) => join(GOLDEN_DIR, f));
}

export function hashesFileFor(logFile: string): string {
  return logFile.replace(/\.log\.json$/, '.hashes.json');
}

export function readLog(file: string): ReplayLog {
  return JSON.parse(readFileSync(file, 'utf8')) as ReplayLog;
}

export function readHashes(file: string): GoldenHashes {
  return JSON.parse(readFileSync(file, 'utf8')) as GoldenHashes;
}

/** Replays a log and returns its golden record. */
export function computeGolden(log: ReplayLog, name: string): GoldenHashes {
  const r = replayLog(log);
  return { name, rulesVersion: RULES_VERSION, tuningHash: r.state.meta.tuningHash, weeks: log.weeks, hashes: r.hashes };
}

export function goldenName(logFile: string): string {
  return logFile.slice(GOLDEN_DIR.length + 1).replace(/\.log\.json$/, '');
}
