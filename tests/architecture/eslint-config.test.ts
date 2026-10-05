// The gmt rules only protect the engine if eslint.config.js enables them on the right files with the live registries.
// This test loads the real config and checks that wiring end to end (DESIGN §2.3, §2.4, §2.10).
import { beforeAll, describe, expect, it } from 'vitest';
import { ESLint, type Linter } from 'eslint';
import { hookRegistry } from '../../src/data/events/hooks';
import { ID_PREFIXES } from '../../src/engine/core/ids';
import { STREAMS } from '../../src/engine/core/streams';
import { loadRegistries } from '../../tools/eslint-plugin-gmt/registry.js';
import { REPO_ROOT } from './sourceScan';

const GMT_RULES = ['gmt/rng-stream-literal', 'gmt/id-prefix-literal', 'gmt/no-raw-hook-read'] as const;
type GmtRule = (typeof GMT_RULES)[number];

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: REPO_ROOT });
});

async function ruleEntry(file: string, rule: GmtRule): Promise<Linter.RuleEntry | undefined> {
  const config = (await eslint.calculateConfigForFile(file)) as Linter.Config | undefined;
  return config?.rules?.[rule];
}

function severity(entry: Linter.RuleEntry | undefined): number {
  const level = Array.isArray(entry) ? entry[0] : entry;
  if (level === undefined || level === 'off' || level === 0) return 0;
  return level === 'warn' || level === 1 ? 1 : 2;
}

function option(entry: Linter.RuleEntry | undefined, name: string): unknown {
  if (!Array.isArray(entry)) return undefined;
  const opts = entry[1] as Record<string, unknown> | undefined;
  return opts?.[name];
}

const sorted = (xs: Iterable<string>): string[] => [...xs].sort();

describe('registry loader', () => {
  it('returns exactly the engine registries', async () => {
    const reg = await loadRegistries();
    expect(reg.streams).toEqual(sorted(Object.keys(STREAMS)));
    expect(reg.idPrefixes).toEqual(sorted(Object.keys(ID_PREFIXES)));
    expect(reg.hookKeys).toEqual(sorted(hookRegistry.map((h) => h.key)));
  });
});

describe('eslint.config.js wiring of the gmt rules', () => {
  it('enables every gmt rule as an error on engine and data source files', async () => {
    for (const file of ['src/engine/core/ids.ts', 'src/engine/systems/fleet/fail.ts', 'src/data/regions/north.ts']) {
      for (const rule of GMT_RULES) expect(severity(await ruleEntry(file, rule)), `${rule} on ${file}`).toBe(2);
    }
  });

  it('passes the live registries as rule options', async () => {
    const file = 'src/engine/systems/fleet/fail.ts';
    expect(option(await ruleEntry(file, 'gmt/rng-stream-literal'), 'streams')).toEqual(sorted(Object.keys(STREAMS)));
    expect(option(await ruleEntry(file, 'gmt/id-prefix-literal'), 'prefixes')).toEqual(
      sorted(Object.keys(ID_PREFIXES)),
    );
    expect(option(await ruleEntry(file, 'gmt/no-raw-hook-read'), 'hookKeys')).toEqual(
      sorted(hookRegistry.map((h) => h.key)),
    );
  });

  it('leaves tests and the other layers alone', async () => {
    for (const file of [
      'src/engine/core/rng.test.ts',
      'src/ui/app/App.tsx',
      'sim/cli.ts',
      'tests/golden/replay.test.ts',
    ]) {
      for (const rule of GMT_RULES) expect(severity(await ruleEntry(file, rule)), `${rule} on ${file}`).toBe(0);
    }
  });

  it('lets the registry, event, tuning, difficulty and scenario data name hook keys', async () => {
    for (const file of [
      'src/data/events/hooks.ts',
      'src/data/events/catalog.ts',
      'src/data/tuning/ops.ts',
      'src/data/difficulty.ts',
      'src/data/scenarios/goldRush.ts',
    ]) {
      expect(severity(await ruleEntry(file, 'gmt/no-raw-hook-read')), file).toBe(0);
      expect(severity(await ruleEntry(file, 'gmt/rng-stream-literal')), file).toBe(2);
    }
  });

  it('reports a non-literal stream, an unregistered prefix and an aliased rng in engine code', async () => {
    const code = [
      "import { nextId, rng } from '../../core';",
      'export const a = (seed: string, s: string) => rng(seed, s as never, 1);',
      "export const b = nextId({}, 'nope' as never);",
      'export const c = [rng];',
      '',
    ].join('\n');
    const [result] = await eslint.lintText(code, { filePath: 'src/engine/systems/ops/__lint_probe__.ts' });
    const gmt = (result?.messages ?? []).filter((m) => m.ruleId?.startsWith('gmt/'));
    expect(gmt.map((m) => [m.ruleId, m.line])).toEqual([
      ['gmt/rng-stream-literal', 2],
      ['gmt/id-prefix-literal', 3],
      ['gmt/rng-stream-literal', 4],
    ]);
  });
});
