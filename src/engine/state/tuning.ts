// Tuning resolution (DESIGN §2.10). Tuning resolves once, at newGame: base → difficulty ({ mul } scales a numeric
// base, { set } replaces it) → scenario overrides → the setup's world choices → simulator overrides. The result is the
// game's TuningResolved and its hash is meta.tuningHash; the game keeps it until the player migrates. `ui.*`, `sim.*`
// and `save.*` are application configuration outside TuningResolved and its hash (D-13.32, §2.16).
import { difficultyTable, type DifficultyTable } from '../../data/difficulty';
import { baseTuning, type TuningKey, type TuningResolved, type TuningTable, type TuningValue } from '../../data/tuning';
import { hashValue } from '../core/hash';
import { sortedKeysByCodeUnit } from '../core/iter';
import type { NewGameSetup, ScenarioId } from './setup';

/** Replacement values by key (simulator `--tuning overrides.json`, scenario overrides). */
export type TuningOverrides = Readonly<Partial<Record<TuningKey, TuningValue>>>;

export interface TuningSources {
  readonly base: TuningTable;
  readonly difficulty: DifficultyTable;
  /** §1 1.10 scenario overrides by scenario id (none ship before P6). */
  readonly scenarios: Readonly<Record<ScenarioId, TuningTable>>;
}

/** The build's own sources. */
export const BUILD_TUNING_SOURCES: TuningSources = { base: baseTuning, difficulty: difficultyTable, scenarios: {} };

export type TuningErrorCode = 'TUNING_KEY_UNKNOWN' | 'TUNING_KEY_NOT_ENGINE' | 'TUNING_VALUE_INVALID';

export class TuningError extends Error {
  readonly code: TuningErrorCode;
  readonly key: string;

  constructor(code: TuningErrorCode, key: string, message: string) {
    super(`${code} (${key}): ${message}`);
    this.name = 'TuningError';
    this.code = code;
    this.key = key;
  }
}

const APP_CONFIG_PREFIXES = ['ui.', 'sim.', 'save.'];
const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

function isTuningValue(v: unknown): v is TuningValue {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' || typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.every(isTuningValue);
  if (typeof v === 'object' && v !== null) {
    const rec = v as Record<string, unknown>;
    return sortedKeysByCodeUnit(rec).every((k) => isTuningValue(rec[k]));
  }
  return false;
}

function cloneValue(v: TuningValue): TuningValue {
  return typeof v === 'object' ? (JSON.parse(JSON.stringify(v)) as TuningValue) : v;
}

function checkKey(out: Record<string, TuningValue>, key: string, origin: string): void {
  if (APP_CONFIG_PREFIXES.some((p) => key.startsWith(p))) {
    throw new TuningError('TUNING_KEY_NOT_ENGINE', key, `${origin}: app configuration is not engine tuning`);
  }
  if (!hasOwn(out, key)) throw new TuningError('TUNING_KEY_UNKNOWN', key, `${origin}: no such tuning key`);
}

function replaceAll(out: Record<string, TuningValue>, table: Readonly<Record<string, unknown>>, origin: string): void {
  for (const key of sortedKeysByCodeUnit(table)) {
    checkKey(out, key, origin);
    const v = table[key];
    if (!isTuningValue(v)) throw new TuningError('TUNING_VALUE_INVALID', key, `${origin}: not a tuning value`);
    out[key] = cloneValue(v);
  }
}

function applyDifficulty(out: Record<string, TuningValue>, sources: TuningSources, setup: NewGameSetup): void {
  for (const key of sortedKeysByCodeUnit(sources.difficulty)) {
    checkKey(out, key, 'difficulty');
    const entry = sources.difficulty[key]?.[setup.difficulty];
    if (entry === undefined) continue;
    if ('mul' in entry) {
      const base = out[key];
      if (typeof base !== 'number' || !Number.isFinite(entry.mul)) {
        throw new TuningError('TUNING_VALUE_INVALID', key, 'difficulty { mul } needs a numeric base and multiplier');
      }
      out[key] = base * entry.mul;
    } else {
      if (!isTuningValue(entry.set)) throw new TuningError('TUNING_VALUE_INVALID', key, 'difficulty { set }');
      out[key] = cloneValue(entry.set);
    }
  }
}

/** Setup choices that map onto tuning keys (§1 1.6: the opening spot override; the display calendar's start year). */
function applySetup(out: Record<string, TuningValue>, setup: NewGameSetup): void {
  const fromSetup: Record<string, TuningValue> = { 'game.startCalendarYear': setup.world.startCalendarYear };
  if (setup.world.openingSpotUsdPerFineOz !== null) {
    fromSetup['market.openingSpotUsdPerFineOz'] = setup.world.openingSpotUsdPerFineOz;
  }
  replaceAll(out, fromSetup, 'setup');
}

/** Resolves the game's tuning. Throws TuningError on an unknown key or an invalid value in any layer. */
export function resolveTuning(
  setup: NewGameSetup,
  overrides: TuningOverrides = {},
  sources: TuningSources = BUILD_TUNING_SOURCES,
): TuningResolved {
  const out: Record<string, TuningValue> = {};
  for (const key of sortedKeysByCodeUnit(sources.base)) out[key] = cloneValue(sources.base[key] as TuningValue);
  applyDifficulty(out, sources, setup);
  if (setup.mode === 'scenario' && setup.scenarioId !== null) {
    const scenario = sources.scenarios[setup.scenarioId];
    if (scenario !== undefined) replaceAll(out, scenario, `scenario ${setup.scenarioId}`);
  }
  applySetup(out, setup);
  replaceAll(out, overrides, 'overrides');
  return out as TuningResolved;
}

/** meta.tuningHash: FNV-1a 64 over the canonical JSON of the resolved tuning (§2.10). */
export function tuningHashOf(tuning: TuningResolved): string {
  return hashValue(tuning);
}

/** A numeric tuning value (throws when the key holds anything else: a data bug). */
export function tuningNumber(tuning: TuningResolved, key: TuningKey): number {
  const v = tuning[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TuningError('TUNING_VALUE_INVALID', key, 'not a number');
  return v;
}
