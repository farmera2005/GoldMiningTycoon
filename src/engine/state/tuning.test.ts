import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../data/tuning';
import { uiConfig } from '../../data/tuning/ui';
import { hashValue } from '../core/hash';
import { defaultNewGameSetup, type NewGameSetup } from './setup';
import {
  BUILD_TUNING_SOURCES,
  TuningError,
  resolveTuning,
  tuningHashOf,
  tuningNumber,
  type TuningOverrides,
  type TuningSources,
} from './tuning';

const setup = (over: Partial<NewGameSetup> = {}): NewGameSetup =>
  defaultNewGameSetup({ companyName: 'Tuning Test', ...over });

const sources: TuningSources = {
  base: { 'game.a': 10, 'game.b': 4, 'game.flag': false, 'game.table': { x: 1 } },
  difficulty: {
    'game.a': { easy: { mul: 1.25 }, standard: { mul: 1 }, hard: { mul: 0.85 } },
    'game.flag': { easy: { set: true }, standard: { set: false }, hard: { set: false } },
  },
  scenarios: { rush: { 'game.b': 7 } },
};

function code(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    if (e instanceof TuningError) return e.code;
    throw e;
  }
  return 'no error';
}

describe('resolveTuning (DESIGN §2.10): base → difficulty → scenario → setup → overrides', () => {
  it('applies { mul } to a numeric base and { set } as a replacement, per difficulty', () => {
    // The fixture base has no setup keys, so the setup layer adds them; read only the fixture's keys.
    const easy = resolveTuning(
      setup({ difficulty: 'easy' }),
      {},
      { ...sources, base: { ...sources.base, ...setupKeys } },
    );
    const hard = resolveTuning(
      setup({ difficulty: 'hard' }),
      {},
      { ...sources, base: { ...sources.base, ...setupKeys } },
    );
    const read = (t: unknown, k: string): unknown => (t as Record<string, unknown>)[k];
    expect(read(easy, 'game.a')).toBe(12.5);
    expect(read(hard, 'game.a')).toBeCloseTo(8.5, 12);
    expect(read(easy, 'game.flag')).toBe(true);
    expect(read(hard, 'game.flag')).toBe(false);
    expect(read(easy, 'game.table')).toEqual({ x: 1 });
  });

  it('replaces with scenario overrides, then the setup, then simulator overrides', () => {
    const all = { ...sources, base: { ...sources.base, ...setupKeys } };
    const scen = resolveTuning(setup({ mode: 'scenario', scenarioId: 'rush' }), {}, all) as unknown as Record<
      string,
      unknown
    >;
    expect(scen['game.b']).toBe(7);
    const over = resolveTuning(
      setup({ mode: 'scenario', scenarioId: 'rush' }),
      { 'game.b': 9 } as unknown as TuningOverrides,
      all,
    ) as unknown as Record<string, unknown>;
    expect(over['game.b']).toBe(9);
  });

  it('maps the setup world choices onto their keys (§1 1.6)', () => {
    const t = resolveTuning(
      setup({ world: { ...setup().world, openingSpotUsdPerFineOz: 3100, startCalendarYear: 2030 } }),
    );
    expect(t['market.openingSpotUsdPerFineOz']).toBe(3100);
    expect(t['game.startCalendarYear']).toBe(2030);
    expect(resolveTuning(setup())['market.openingSpotUsdPerFineOz']).toBe(4200);
  });

  it('rejects unknown keys, app configuration keys and invalid values in overrides', () => {
    const s = setup();
    expect(code(() => resolveTuning(s, { 'game.nope': 1 } as unknown as TuningOverrides))).toBe('TUNING_KEY_UNKNOWN');
    expect(code(() => resolveTuning(s, { 'ui.runMaxWeeksDefault': 4 } as unknown as TuningOverrides))).toBe(
      'TUNING_KEY_NOT_ENGINE',
    );
    expect(code(() => resolveTuning(s, { 'sim.workers': 4 } as unknown as TuningOverrides))).toBe(
      'TUNING_KEY_NOT_ENGINE',
    );
    expect(code(() => resolveTuning(s, { 'game.history.weeklyKeep': Number.NaN } as unknown as TuningOverrides))).toBe(
      'TUNING_VALUE_INVALID',
    );
  });

  it('rejects a difficulty row for a key the base does not have, and { mul } on a non-number', () => {
    const bad: TuningSources = {
      ...sources,
      base: { ...sources.base, ...setupKeys },
      difficulty: { 'game.ghost': { easy: { mul: 2 }, standard: { mul: 1 }, hard: { mul: 1 } } },
    };
    expect(code(() => resolveTuning(setup(), {}, bad))).toBe('TUNING_KEY_UNKNOWN');
    const mulOnFlag: TuningSources = {
      ...sources,
      base: { ...sources.base, ...setupKeys },
      difficulty: { 'game.flag': { easy: { mul: 2 }, standard: { mul: 1 }, hard: { mul: 1 } } },
    };
    expect(code(() => resolveTuning(setup(), {}, mulOnFlag))).toBe('TUNING_VALUE_INVALID');
  });

  it('hashes the resolved table canonically; ui.* is outside it (§13 T11)', () => {
    const t = resolveTuning(setup());
    expect(tuningHashOf(t)).toBe(hashValue(t));
    expect(tuningHashOf(resolveTuning(setup()))).toBe(tuningHashOf(t));
    for (const key of Object.keys(t)) expect(key.startsWith('ui.')).toBe(false);
    // The ui table exists and is not read by resolution: no ui key can reach the hash.
    expect(Object.keys(uiConfig).length).toBeGreaterThan(0);
    expect(tuningHashOf(resolveTuning(setup(), { 'game.nw.partsResaleFactor': 0.5 }))).not.toBe(tuningHashOf(t));
  });

  it('copies table values so a resolved game never aliases the data files', () => {
    const all = { ...sources, base: { ...sources.base, ...setupKeys } };
    const t = resolveTuning(setup(), {}, all) as unknown as Record<string, unknown>;
    expect(t['game.table']).toEqual(sources.base['game.table']);
    expect(t['game.table']).not.toBe(sources.base['game.table']);
  });

  it('builds from the real data with every base key present', () => {
    const t = resolveTuning(setup());
    expect(Object.keys(t).sort()).toEqual(Object.keys(baseTuning).sort());
    expect(BUILD_TUNING_SOURCES.base).toBe(baseTuning);
    expect(tuningNumber(t, 'game.start.bootstrapper.companyCashUsd')).toBe(400000);
  });
});

const setupKeys = { 'market.openingSpotUsdPerFineOz': 4200, 'game.startCalendarYear': 2027 };
