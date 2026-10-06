// Balance baselines (BALANCE §6.7, §10.1): the signed-off summary of each phase is committed as
// docs/balance/baseline-phase-N.json. A run compares with its own phase's baseline when one exists (a re-run after
// sign-off), else with the previous phase's (the §10.1 template's "baseline compared against").
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TargetResult } from './scorecard';

export interface LoadedBaseline {
  path: string;
  targets: TargetResult[];
}

export function baselinePath(root: string, phase: number): string {
  return join(root, 'docs', 'balance', `baseline-phase-${phase}.json`);
}

function read(path: string): LoadedBaseline {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { targets?: unknown };
  if (!Array.isArray(parsed.targets))
    throw new Error(`${path}: a baseline needs a targets array (BALANCE §6.6 summary.json)`);
  return { path, targets: parsed.targets as TargetResult[] };
}

/** The baseline to compare with: an explicit path, else phase N's, else phase N − 1's, else none. */
export function findBaseline(root: string, phase: number, explicit: string | null): LoadedBaseline | null {
  if (explicit !== null) return read(explicit);
  for (const p of [phase, phase - 1]) {
    if (p < 0) continue;
    const path = baselinePath(root, p);
    if (existsSync(path)) return read(path);
  }
  return null;
}
