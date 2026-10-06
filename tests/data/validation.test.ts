// zod validation of every data file under src/data (CLAUDE.md "Content and tuning": catalogs and tuning are
// zod-validated and cross-reference-checked in tests; DESIGN §2.10, §2.14 "Data validation", D-2.7). Schemas are in
// tests/data/schemas.ts; this file runs them, checks the cross-references and guards that no data file goes unchecked.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import seedsJson from '../../src/data/balance/seeds.json';
import { difficultyTable, type Difficulty } from '../../src/data/difficulty';
import { hookRegistry } from '../../src/data/events/hooks';
import { bedrockTable, holderNames, regionTemplates, townServicesByTier } from '../../src/data/regions';
import { uiText } from '../../src/data/text/ui';
import { baseTuning, tuningNamespaces, type TuningValue } from '../../src/data/tuning';
import { uiConfig } from '../../src/data/tuning/ui';
import { defaultNewGameSetup, resolveTuning } from '../../src/engine';
import {
  BEDROCK_TYPES,
  TOWN_TIERS,
  TUNING_KEY_SCHEMAS,
  bedrockTableSchema,
  difficultyTableSchema,
  holderNamesSchema,
  hookRegistrySchema,
  lnLaw,
  mixArray,
  mixOf,
  prob,
  range,
  regionTemplateSchema,
  scalarRule,
  seedsSchema,
  townServicesSchema,
  tuningValue,
  uiConfigSchema,
  uiTextSchema,
} from './schemas';

/** The schema's issues as "path: message" lines, so a failure names the bad value. */
function problems(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

const BASE: Readonly<Record<string, TuningValue>> = baseTuning;
const has = (rec: object, key: string): boolean => Object.prototype.hasOwnProperty.call(rec, key);
const schemaFor = (key: string): z.ZodType => TUNING_KEY_SCHEMAS[key] ?? scalarRule(key);

describe('the schemas have teeth', () => {
  it('reject non-finite numbers, out-of-range probabilities, bad mixes and missing classes', () => {
    expect(problems(prob, Number.NaN)).not.toEqual([]);
    expect(problems(prob, Number.POSITIVE_INFINITY)).not.toEqual([]);
    expect(problems(prob, -0.01)).not.toEqual([]);
    expect(problems(prob, 1.01)).not.toEqual([]);
    const mix = mixOf(['accurate', 'optimistic', 'cherryPicked', 'fraudulent']);
    expect(problems(mix, { accurate: 0.55, optimistic: 0.3, cherryPicked: 0.12, fraudulent: 0.03 })).toEqual([]);
    expect(problems(mix, { accurate: 0.65, optimistic: 0.35, cherryPicked: 0.12, fraudulent: 0.08 })).not.toEqual([]);
    expect(problems(mix, { accurate: 0.5, optimistic: 0.5, cherryPicked: 0 })).not.toEqual([]);
    expect(problems(mixArray(4), [0.6, 0.3, 0.1])).not.toEqual([]);
    expect(problems(range(), [3, 1])).not.toEqual([]);
    expect(problems(lnLaw, { median: 1.45, sigma: 0.15, lo: 1.5, hi: 2.2 })).not.toEqual([]);
    expect(problems(tuningValue, { a: [1, Number.NaN] })).not.toEqual([]);
    expect(problems(scalarRule('geology.world.branchP'), 1.2)).not.toEqual([]);
    expect(problems(scalarRule('game.startCompanyCashMult'), 0)).not.toEqual([]);
  });

  it('reject a region template with a claim-size mix that misses a size class', () => {
    const bad = { ...regionTemplates.northernFederal, claimSizeMix: { '20': 0.6, '40': 0.25, '80': 0.15 } };
    expect(problems(regionTemplateSchema, bad).join()).toMatch(/claimSizeMix/);
    const sum = { ...regionTemplates.aridFederal, depositMix: { desertFan: 0.5, gulch: 0.5, bench: 0.1 } };
    expect(problems(regionTemplateSchema, sum).join()).toMatch(/sum to 1/);
  });
});

describe('tuning tables (DESIGN §2.10; each namespace file)', () => {
  for (const [ns, table] of Object.entries(tuningNamespaces)) {
    it(`${ns}: every key is namespaced and every value is finite tuning data of its key's shape`, () => {
      for (const [key, value] of Object.entries(table as Readonly<Record<string, TuningValue>>)) {
        expect(key.startsWith(`${ns}.`), key).toBe(true);
        expect(problems(tuningValue, value), key).toEqual([]);
        expect(problems(schemaFor(key), value), key).toEqual([]);
      }
    });
  }

  it('every object- or array-valued key has a shape schema', () => {
    const missing = Object.entries(BASE)
      .filter(([k, v]) => typeof v === 'object' && !has(TUNING_KEY_SCHEMAS, k))
      .map(([k]) => k);
    expect(missing, 'add a schema to tests/data/schemas.ts TUNING_KEY_SCHEMAS').toEqual([]);
  });

  it('names only keys that exist (no stale schema)', () => {
    expect(Object.keys(TUNING_KEY_SCHEMAS).filter((k) => !has(BASE, k))).toEqual([]);
  });
});

describe('difficulty table (DESIGN §1 1.11, §2.10)', () => {
  it('is well formed, names resolvable keys, and puts { mul } only on numeric bases', () => {
    expect(problems(difficultyTableSchema, difficultyTable)).toEqual([]);
    for (const [key, row] of Object.entries(difficultyTable as Readonly<Record<string, Record<string, object>>>)) {
      expect(has(BASE, key), key).toBe(true);
      for (const entry of Object.values(row)) if ('mul' in entry) expect(typeof BASE[key], key).toBe('number');
    }
  });

  it('resolves at every difficulty to values that still pass their keys’ schemas', () => {
    for (const difficulty of ['easy', 'standard', 'hard'] as Difficulty[]) {
      const t = resolveTuning(defaultNewGameSetup({ companyName: 'Schema Test', difficulty })) as Readonly<
        Record<string, TuningValue>
      >;
      for (const key of Object.keys(difficultyTable)) {
        expect(problems(schemaFor(key), t[key]), `${key} on ${difficulty}`).toEqual([]);
      }
    }
  });
});

describe('region templates (DESIGN §3.2)', () => {
  for (const [id, template] of Object.entries(regionTemplates)) {
    it(`${id}: valid, keyed by its own id, and cross-referenced to the bedrock and town tables`, () => {
      expect(problems(regionTemplateSchema, template)).toEqual([]);
      expect(template.id).toBe(id);
      for (const b of Object.keys(template.bedrockMix)) expect(has(bedrockTable, b), b).toBe(true);
      for (const t of Object.keys(template.townTierMix)) expect(has(townServicesByTier, t), t).toBe(true);
    });
  }

  it('the bedrock, town and holder-name tables are valid and complete', () => {
    expect(problems(bedrockTableSchema, bedrockTable)).toEqual([]);
    expect(Object.keys(bedrockTable).sort()).toEqual([...BEDROCK_TYPES].sort());
    expect(problems(townServicesSchema, townServicesByTier)).toEqual([]);
    expect(Object.keys(townServicesByTier).sort()).toEqual([...TOWN_TIERS].sort());
    expect(problems(holderNamesSchema, holderNames)).toEqual([]);
  });
});

describe('the other data files', () => {
  it('balance/seeds.json (BALANCE §6.2)', () => {
    expect(problems(seedsSchema, seedsJson)).toEqual([]);
  });

  it('tuning/ui.ts (DESIGN §13.25)', () => {
    expect(problems(uiConfigSchema, uiConfig)).toEqual([]);
    expect(problems(uiConfigSchema, { ...uiConfig, 'ui.planVarianceWarnPct': 1.5 })).not.toEqual([]);
  });

  it('text/ui.ts (DESIGN §13.19)', () => {
    expect(problems(uiTextSchema, uiText)).toEqual([]);
  });

  it('events/hooks.ts (DESIGN §2.10, §12 12.3)', () => {
    expect(problems(hookRegistrySchema, hookRegistry)).toEqual([]);
    const dup = { key: 'ops.digMult', ownerSection: 7, neutral: 1, unit: '×' };
    expect(problems(hookRegistrySchema, [dup, dup])).not.toEqual([]);
  });
});

/**
 * Each data file and what validates it, so a new file cannot slip past. A file that holds no data says why (types,
 * an aggregator of files listed here, or a loader of a validated JSON file).
 */
const COVERAGE: Readonly<Record<string, string>> = {
  'balance/seeds.json': 'seedsSchema',
  'balance/seeds.ts': 'loader of seeds.json (validated)',
  'difficulty.ts': 'difficultyTableSchema',
  'events/hooks.ts': 'hookRegistrySchema',
  'regions/aridFederal.ts': 'regionTemplateSchema',
  'regions/northernFederal.ts': 'regionTemplateSchema',
  'regions/bedrock.ts': 'bedrockTableSchema',
  'regions/names.ts': 'holderNamesSchema',
  'regions/towns.ts': 'townServicesSchema',
  'regions/index.ts': 'aggregator of the region files',
  'text/ui.ts': 'uiTextSchema',
  'tuning/index.ts': 'aggregator of the namespace files',
  'tuning/types.ts': 'types only',
  'tuning/ui.ts': 'uiConfigSchema',
  ...Object.fromEntries(Object.keys(tuningNamespaces).map((ns) => [`tuning/${ns}.ts`, 'TUNING_KEY_SCHEMAS'])),
};

function dataFiles(dir: string, root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...dataFiles(p, root));
    else if (/\.(ts|json)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(relative(root, p).split('\\').join('/'));
  }
  return out;
}

describe('coverage', () => {
  it('every file under src/data is validated here (or holds no data)', () => {
    const root = fileURLToPath(new URL('../../src/data', import.meta.url));
    const files = dataFiles(root, root).sort();
    expect(
      files.filter((f) => !has(COVERAGE, f)),
      'add the file and its schema to COVERAGE',
    ).toEqual([]);
    expect(
      Object.keys(COVERAGE).filter((f) => !files.includes(f)),
      'COVERAGE names a missing file',
    ).toEqual([]);
  });
});
