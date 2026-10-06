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
import {
  geophysicsDepthCv,
  prospectingEngagements,
  prospectingMethods,
  smallCountTable,
} from '../../src/data/prospecting';
import { bedrockTable, holderNames, regionTemplates, townServicesByTier } from '../../src/data/regions';
import { uiText } from '../../src/data/text/ui';
import { baseTuning, tuningNamespaces, type TuningValue } from '../../src/data/tuning';
import { uiConfig } from '../../src/data/tuning/ui';
import { defaultNewGameSetup, resolveTuning } from '../../src/engine';
import { methodMeasurementRowsFromDesign } from './designTables';
import { TEXT_COVERAGE } from './schemas/text';
import {
  BEDROCK_TYPES,
  TOWN_TIERS,
  TUNING_KEY_SCHEMAS,
  bedrockTableSchema,
  difficultyTableSchema,
  geophysicsDepthCvSchema,
  holderNamesSchema,
  hookRegistrySchema,
  lnLaw,
  mixArray,
  mixOf,
  prob,
  prospectingEngagementsSchema,
  prospectingMethodsSchema,
  range,
  regionTemplateSchema,
  scalarRule,
  seedsSchema,
  smallCountTableSchema,
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

describe('prospecting content (DESIGN §4.2, §4.4.4, §4.13)', () => {
  const METHODS: Readonly<Record<string, unknown>> = prospectingMethods;

  it('methods.ts: every row is a valid §4.2 row keyed by its own id', () => {
    expect(problems(prospectingMethodsSchema, prospectingMethods)).toEqual([]);
    expect(problems(geophysicsDepthCvSchema, geophysicsDepthCv)).toEqual([]);
  });

  it('methods.ts: the draw blocks state DESIGN §4.2.B’s numbers', () => {
    const rows = methodMeasurementRowsFromDesign();
    expect(rows.map((r) => r.id).sort()).toEqual(Object.keys(METHODS).sort());
    let compared = 0;
    for (const r of rows) {
      const draw = (METHODS[r.id] as { draw: Record<string, unknown> | null } | undefined)?.draw;
      if (draw === null || draw === undefined) continue;
      if (r.capture !== null) {
        const c = draw['captureBySize'] as Record<string, number>;
        expect([c['coarse'], c['medium'], c['fine'], c['ultrafine']], `${r.id} capture`).toEqual(r.capture);
        compared++;
      }
      (['volumeCv', 'weighCv', 'geomCv', 'thickCv'] as const).forEach((f, k) => {
        const v = r.cvs?.[k];
        if (v !== null && v !== undefined) expect(draw[f], `${r.id} ${f}`).toBe(v);
      });
      if (r.bedrockPenFt !== null) expect(draw['bedrockPenFt'], `${r.id} bedrockPenFt`).toBe(r.bedrockPenFt);
      if (r.frozenOk !== null) expect(draw['frozenOk'], `${r.id} frozenOk`).toBe(r.frozenOk);
      if (typeof r.maxDepthFt === 'number') expect(draw['maxDepthFt'], `${r.id} maxDepthFt`).toBe(r.maxDepthFt);
      if (r.maxDepthFt === 'reach') expect(draw['maxDepthFt'], `${r.id} maxDepthFt`).toBeNull();
      expect(draw['positionMode'], `${r.id} positionMode`).toBe(r.positionMode);
      const fb = (METHODS[r.id] as { falseBedrockP: number }).falseBedrockP;
      if (r.falseBedrockP !== null) expect(fb, `${r.id} falseBedrockP`).toBe(r.falseBedrockP);
    }
    expect(compared).toBeGreaterThanOrEqual(10);
  });

  it('methods.ts: the historic churn row reads §3’s geology.method.churnHistoric (one source of truth)', () => {
    const draw = prospectingMethods.churnHistoric.draw as unknown as Record<string, unknown>;
    const s3 = BASE['geology.method.churnHistoric'] as Readonly<Record<string, unknown>>;
    for (const [k, v] of Object.entries(s3)) expect(draw[k], k).toEqual(v);
  });

  it('smallCountTable.ts is valid and is the tuning value geology.estSmallCountTable', () => {
    expect(problems(smallCountTableSchema, smallCountTable)).toEqual([]);
    expect(BASE['geology.estSmallCountTable']).toEqual(smallCountTable);
    expect(problems(smallCountTableSchema, [smallCountTable[1], smallCountTable[0]])).not.toEqual([]);
  });

  it('engagements.ts (§4.2.A lower rows, §4.13)', () => {
    expect(problems(prospectingEngagementsSchema, prospectingEngagements)).toEqual([]);
  });

  it('reject a malformed method row', () => {
    const bad = { ...prospectingMethods, sonic: { ...prospectingMethods.sonic, falseBedrockP: 1.2 } };
    expect(problems(prospectingMethodsSchema, bad)).not.toEqual([]);
    const wrongId = { ...prospectingMethods, rc: { ...prospectingMethods.rc, id: 'sonic' } };
    expect(problems(prospectingMethodsSchema, wrongId)).not.toEqual([]);
    const drill = { ...prospectingMethods.sonic, sampleBcy: { kind: 'perFtOfColumn', bcyPerFt: 0.01 } };
    expect(problems(prospectingMethodsSchema, { ...prospectingMethods, sonic: drill })).not.toEqual([]);
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
  'prospecting/engagements.ts': 'prospectingEngagementsSchema',
  'prospecting/index.ts': 'aggregator of the prospecting files',
  'prospecting/methods.ts': 'prospectingMethodsSchema, geophysicsDepthCvSchema, DESIGN §4.2.B cross-check',
  'prospecting/smallCountTable.ts': 'smallCountTableSchema (= geology.estSmallCountTable)',
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
  ...TEXT_COVERAGE, // §13 text catalogs (tests/data/schemas/text.ts)
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
