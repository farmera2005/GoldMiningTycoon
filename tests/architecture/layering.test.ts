// DESIGN §2.1 layering, checked on the real import graph (ESLint's no-restricted-imports is the first line; this test
// also sees through re-exports, dynamic import(), require() and relative paths that lint patterns can miss).
import { describe, expect, it } from 'vitest';
import {
  importsOf,
  isTestFile,
  listSourceFiles,
  parseFile,
  parseText,
  resolveImport,
  type ImportRef,
  type ImportTarget,
} from './sourceScan';

type Layer = 'engine' | 'data' | 'ui' | 'persistence' | 'app' | 'sim' | 'tools' | 'tests' | 'other';

/** True for `dir` itself (a directory import such as '../engine') and anything below it. */
const within = (rel: string, dir: string): boolean => rel === dir || rel.startsWith(`${dir}/`);

function layerOf(rel: string): Layer {
  if (within(rel, 'src/engine')) return 'engine';
  if (within(rel, 'src/data')) return 'data';
  if (within(rel, 'src/ui')) return 'ui';
  if (within(rel, 'src/persistence')) return 'persistence';
  if (within(rel, 'src')) return 'app'; // main.tsx and other app entry files
  if (within(rel, 'sim')) return 'sim';
  if (within(rel, 'tools')) return 'tools';
  if (within(rel, 'tests')) return 'tests';
  return 'other';
}

const UI_CONFIG = 'src/data/tuning/ui.ts';
const BALANCE_DATA = 'src/data/balance';

/** The only package the engine may load: Immer (pure TS, DESIGN §2.2 "Immutability"). */
const ENGINE_PACKAGES = new Set(['immer']);
/** The simulator turns Immer auto-freeze off for speed (CLAUDE.md "Reducers are pure"); it needs no other package. */
const SIM_PACKAGES = new Set(['immer']);

function describeTarget(t: ImportTarget): string {
  return t.kind === 'file' ? t.rel : `${t.kind} '${t.name}'`;
}

/** The §2.1 rule an import breaks, or null. Test files are free to import what they test (and tests/ helpers). */
function layeringViolation(from: string, imp: ImportRef, target: ImportTarget): string | null {
  if (isTestFile(from)) return null;
  const src = layerOf(from);
  const dst = target.kind === 'file' ? layerOf(target.rel) : null;

  if (dst === 'tests') return 'only tests may import from tests/';
  const corner = dataCornerViolation(from, target);
  if (corner !== null) return corner;
  switch (src) {
    case 'engine':
      if (target.kind === 'package' && ENGINE_PACKAGES.has(target.name)) return null;
      if (dst === 'engine' || dst === 'data') return null;
      return 'engine/ imports only engine/ and data/ (and Immer)';
    case 'data':
      if (dst === 'data') return null;
      if (dst === 'engine' && imp.typeOnly) return null;
      if (dst === 'engine') return 'data/ may import engine/ only with `import type`';
      return 'data/ imports only data/ and engine types';
    case 'ui':
    case 'persistence':
    case 'app':
      if (dst === 'sim' || dst === 'tools') return `${src === 'app' ? 'the app' : `${src}/`} must not import ${dst}/`;
      return null;
    case 'sim':
      if (target.kind === 'node') return null;
      if (target.kind === 'package')
        return SIM_PACKAGES.has(target.name) ? null : 'sim/ imports engine, data and Node built-ins only';
      if (dst === 'engine' || dst === 'data' || dst === 'sim') return null;
      return 'sim/ imports engine, data and Node built-ins only';
    case 'tools':
    case 'tests':
    case 'other':
      return null;
  }
}

/**
 * Two corners of data/ with narrower readers (CLAUDE.md "Content and tuning", repository layout). `data/tuning/ui.ts` is
 * app configuration outside TuningResolved and its hash: the UI reads it, the engine (directly or through another data
 * module) must not. `data/balance/` holds BALANCE seeds and fixtures read by sim/ only.
 */
function dataCornerViolation(from: string, target: ImportTarget): string | null {
  if (target.kind !== 'file') return null;
  const src = layerOf(from);
  if (target.rel === UI_CONFIG && from !== UI_CONFIG && (src === 'engine' || src === 'data')) {
    return 'ui.* config is outside TuningResolved; the engine must not reach it';
  }
  if (within(target.rel, BALANCE_DATA) && !within(from, BALANCE_DATA) && src !== 'sim') {
    return 'data/balance/ is read by sim/ only';
  }
  return null;
}

interface Edge {
  from: string;
  imp: ImportRef;
  target: ImportTarget;
}

function buildGraph(): Edge[] {
  const edges: Edge[] = [];
  for (const file of listSourceFiles('src', 'sim', 'tools')) {
    for (const imp of importsOf(parseFile(file)))
      edges.push({ from: file, imp, target: resolveImport(file, imp.specifier) });
  }
  return edges;
}

const files = listSourceFiles('src', 'sim', 'tools');
const edges = buildGraph();

describe('import graph (DESIGN §2.1)', () => {
  it('covers the engine, data, UI and tools layers', () => {
    const layers = new Set(files.map(layerOf));
    for (const layer of ['engine', 'data', 'ui', 'persistence', 'tools'] as const) expect(layers).toContain(layer);
    expect(edges.length).toBeGreaterThan(50);
  });

  it('resolves relative imports to files in the repository', () => {
    const engineToCore = edges.find((e) => e.from === 'src/engine/core/rng.ts' && e.imp.specifier === './streams');
    expect(engineToCore?.target).toEqual({ kind: 'file', rel: 'src/engine/core/streams.ts' });
  });

  it('keeps every layer inside its dependency rules', () => {
    const violations: string[] = [];
    for (const { from, imp, target } of edges) {
      const why = layeringViolation(from, imp, target);
      if (why !== null) violations.push(`${from}:${imp.line} imports ${describeTarget(target)}: ${why}`);
    }
    expect(violations).toEqual([]);
  });

  it('never imports tests/ from outside the test suite', () => {
    const offenders = edges
      .filter((e) => !isTestFile(e.from) && e.target.kind === 'file' && within(e.target.rel, 'tests'))
      .map((e) => `${e.from}:${e.imp.line}`);
    expect(offenders).toEqual([]);
  });
});

describe('layering checker', () => {
  const edgeFrom = (from: string, code: string): Edge[] =>
    importsOf(parseText(from, code)).map((imp) => ({ from, imp, target: resolveImport(from, imp.specifier) }));
  const verdicts = (from: string, code: string): (string | null)[] =>
    edgeFrom(from, code).map((e) => layeringViolation(e.from, e.imp, e.target));

  it('sees static, re-export, dynamic, require and type-position imports', () => {
    const imps = importsOf(
      parseText(
        'src/engine/x.ts',
        [
          "import { a } from './a';",
          "import type { B } from './b';",
          "import { type C } from './c';",
          "export * from './d';",
          "export type { E } from './e';",
          "const f = await import('./f');",
          "const g = require('./g');",
          "type H = import('./h').H;",
        ].join('\n'),
      ),
    );
    expect(imps.map((i) => [i.specifier, i.typeOnly])).toEqual([
      ['./a', false],
      ['./b', true],
      ['./c', false], // still loads ./c under verbatimModuleSyntax
      ['./d', false],
      ['./e', true],
      ['./f', false],
      ['./g', false],
      ['./h', true],
    ]);
  });

  it('flags the engine reaching outside engine/ and data/', () => {
    expect(
      verdicts(
        'src/engine/systems/ops/x.ts',
        [
          "import { produce } from 'immer';",
          "import { t } from '../../../data/tuning';",
          "import { s } from '../../../ui/store/store';",
          "import { f } from 'node:fs';",
          "import { z } from 'zod';",
          "import { u } from '../../../data/tuning/ui';",
          "import { b } from '../../../data/balance/fixtures';",
          "const p = await import('../../../persistence');",
        ].join('\n'),
      ).map((v) => v !== null),
    ).toEqual([false, false, true, true, true, true, true, true]);
  });

  it('lets data/ import engine types only', () => {
    expect(
      verdicts(
        'src/data/events/x.ts',
        [
          "import type { HookKey } from '../../engine/core/effective';",
          "import { compareIds } from '../../engine/core/ids';",
          "import { type ClaimId } from '../../engine/core/ids';",
          "import { opsTuning } from '../tuning/ops';",
          "import { z } from 'zod';",
        ].join('\n'),
      ).map((v) => v !== null),
    ).toEqual([false, true, true, false, true]);
  });

  it('keeps the UI and persistence away from sim/, tools/ and tests/, and sim/ on engine, data and Node', () => {
    expect(verdicts('src/ui/app/x.tsx', "import { run } from '../../../sim/runner';")).not.toEqual([null]);
    expect(verdicts('src/persistence/x.ts', "import { f } from '../../tests/golden/fixtures';")).not.toEqual([null]);
    expect(verdicts('src/ui/app/x.tsx', "import { useState } from 'react';")).toEqual([null]);
    expect(
      verdicts(
        'sim/bots/x.ts',
        [
          "import { newGame } from '../../src/engine';",
          "import { cpus } from 'node:os';",
          "import { Worker } from 'worker_threads';",
          "import { setAutoFreeze } from 'immer';",
          "import { App } from '../../src/ui/app/App';",
          "import { create } from 'zustand';",
        ].join('\n'),
      ).map((v) => v !== null),
    ).toEqual([false, false, false, false, true, true]);
  });

  it('keeps ui.* config away from the engine and balance fixtures for sim/', () => {
    expect(verdicts('src/ui/app/x.tsx', "import { uiConfig } from '../../data/tuning/ui';")).toEqual([null]);
    expect(verdicts('src/data/tuning/index.ts', "import { uiConfig } from './ui';")).not.toEqual([null]);
    expect(verdicts('src/data/balance/fixtures.ts', "import seeds from './seeds.json';")).toEqual([null]);
    expect(verdicts('sim/balance/matrix.ts', "import { fixtures } from '../../src/data/balance/fixtures';")).toEqual([
      null,
    ]);
    expect(verdicts('src/ui/app/x.tsx', "import { fixtures } from '../../data/balance/fixtures';")).not.toEqual([null]);
    expect(verdicts('src/data/regions/x.ts', "import seeds from '../balance/seeds.json';")).not.toEqual([null]);
  });

  it('exempts test files but not from importing tests/ helpers into production code', () => {
    expect(
      verdicts('src/engine/core/x.test.ts', "import fc from 'fast-check'; import { h } from '../../../tests/h';"),
    ).toEqual([null, null]);
    expect(verdicts('tools/x.js', "import { h } from '../tests/h';")).not.toEqual([null]);
  });
});
