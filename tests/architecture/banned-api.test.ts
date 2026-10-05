// A cheap text scan that backs up ESLint's engine purity and determinism rules (DESIGN §2.1, §2.3; CLAUDE.md
// "Engine purity", "Determinism"). It catches what a lint run can miss: an eslint-disable comment, a config edit that
// stops matching a file, or a rule switched off. Comments and string, template and regex literal text are blanked
// first, so prose about `Math.exp` or a flavor string mentioning a Date is not a hit.
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { isTestFile, listSourceFiles, parseFile, parseText } from './sourceScan';

interface Ban {
  readonly id: string;
  readonly pattern: RegExp;
  readonly why: string;
  /** Layers the ban applies to (mirrors the ESLint config blocks). */
  readonly scope: 'engine' | 'engine+data';
  /** Files allowed to use the API (the one module that wraps it). */
  readonly allow?: readonly string[];
}

// No member access before the name (`x.Date` is a property, not the global).
const NOT_MEMBER = '(?<![\\w$.])';

// Math.sqrt is IEEE-exact and stays allowed, as do floor/ceil/round/abs/min/max/imul/sign/trunc/fround.
const TRANSCENDENTAL = [
  'random',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
];

const BANS: readonly Ban[] = [
  {
    id: 'Math.transcendental',
    pattern: new RegExp(`${NOT_MEMBER}Math\\s*\\.\\s*(?:${TRANSCENDENTAL.join('|')})\\b`),
    why: 'Math.random and transcendental Math.* differ across JS engines; use rng() and engine/core/dmath.ts (§2.3)',
    scope: 'engine+data',
  },
  {
    id: 'Date',
    pattern: new RegExp(`${NOT_MEMBER}Date\\b`),
    why: 'no wall clock in the engine; time is `turn` (§2.3 item 3)',
    scope: 'engine+data',
  },
  {
    id: 'Object.keys/values/entries',
    pattern: new RegExp(`${NOT_MEMBER}Object\\s*\\.\\s*(?:keys|values|entries)\\b`),
    why: 'insertion-order iteration; use sortedKeys/sortedValues/sortedEntries from engine/core/iter.ts (§2.3 item 3)',
    scope: 'engine',
    allow: ['src/engine/core/iter.ts'],
  },
  {
    id: 'new Map/Set',
    pattern: /\bnew\s+(?:Map|Set|WeakRef)\b/,
    why: 'Map/Set iterate in insertion order; use Records and engine/core/iter.ts (memo.ts holds the caches, §2.3 item 6)',
    scope: 'engine+data',
    allow: ['src/engine/core/memo.ts'],
  },
  {
    id: 'for…in',
    pattern: /\bfor\s*\(\s*(?:const|let|var)\s+[\w$]+\s+in\b/,
    why: 'for…in iterates in insertion order; use engine/core/iter.ts (§2.3 item 3)',
    scope: 'engine+data',
  },
  {
    id: 'locale',
    pattern: /\.\s*(?:localeCompare|toLocale\w*)\s*\(|(?<![\w$.])Intl\b/,
    why: 'locale-dependent results; use compareIds or code-unit order (§2.1)',
    scope: 'engine+data',
  },
  {
    id: 'ambient',
    pattern: new RegExp(
      `${NOT_MEMBER}(?:performance|process|window|document|globalThis|navigator|localStorage|sessionStorage|indexedDB)\\s*\\.|${NOT_MEMBER}(?:setTimeout|setInterval|fetch|require)\\s*\\(`,
    ),
    why: 'no browser, Node or timer APIs in the engine (§2.1)',
    scope: 'engine+data',
  },
];

/** The source with comments and literal text replaced by spaces (line breaks kept, so line numbers still match). */
function codeOnly(sf: ts.SourceFile): string {
  const text = sf.text;
  const chars = text.split('');
  const blank = (start: number, end: number): void => {
    for (let i = start; i < end; i++) if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
  };
  const visit = (node: ts.Node): void => {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.RegularExpressionLiteral:
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail:
      case ts.SyntaxKind.JsxText:
        blank(node.getStart(sf), node.getEnd());
        return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // With every literal blanked, `//` and `/*` can only start comments.
  return chars.join('').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\r\n]/g, ' '));
}

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly ban: string;
}

function scanText(file: string, sf: ts.SourceFile, bans: readonly Ban[]): Hit[] {
  const lines = codeOnly(sf).split('\n');
  const hits: Hit[] = [];
  lines.forEach((line, i) => {
    for (const ban of bans) if (ban.pattern.test(line)) hits.push({ file, line: i + 1, ban: ban.id });
  });
  return hits;
}

function bansFor(file: string): Ban[] {
  const isEngine = file.startsWith('src/engine/');
  return BANS.filter((b) => (b.scope === 'engine+data' || isEngine) && !(b.allow ?? []).includes(file));
}

const files = listSourceFiles('src/engine', 'src/data').filter((f) => !isTestFile(f) && /\.(ts|tsx)$/.test(f));

describe('banned APIs in engine/ and data/ (backs up ESLint)', () => {
  it('scans the engine and data sources', () => {
    expect(files.filter((f) => f.startsWith('src/engine/')).length).toBeGreaterThan(10);
    expect(files.filter((f) => f.startsWith('src/data/')).length).toBeGreaterThan(5);
  });

  it('finds no banned API outside its one allowed module', () => {
    const hits = files.flatMap((f) => scanText(f, parseFile(f), bansFor(f)));
    const why = new Map(BANS.map((b) => [b.id, b.why]));
    expect(hits.map((h) => `${h.file}:${h.line} ${h.ban}: ${why.get(h.ban)}`)).toEqual([]);
  });
});

describe('banned-API scanner', () => {
  const hitsIn = (code: string, file = 'src/engine/systems/ops/x.ts'): string[] =>
    scanText(file, parseText(file, code), bansFor(file)).map((h) => `${h.line}:${h.ban}`);

  it('flags each banned API in code', () => {
    expect(
      hitsIn(
        [
          'const u = Math.random();',
          'const e = Math . exp(x);',
          'const t = Date.now();',
          'const k = Object.keys(rec);',
          'const m = new Map<string, number>();',
          'for (const k in rec) {}',
          'const c = a.localeCompare(b);',
          'const n = x.toLocaleString();',
          'const f = new Intl.NumberFormat();',
          'const p = performance.now();',
          'setTimeout(tick, 0);',
          'const env = process.env.X;',
        ].join('\n'),
      ),
    ).toEqual([
      '1:Math.transcendental',
      '2:Math.transcendental',
      '3:Date',
      '4:Object.keys/values/entries',
      '5:new Map/Set',
      '6:for…in',
      '7:locale',
      '8:locale',
      '9:locale',
      '10:ambient',
      '11:ambient',
      '12:ambient',
    ]);
  });

  it('ignores comments, string, template and regex text, and allowed Math functions', () => {
    expect(
      hitsIn(
        [
          '// Math.exp(x) differs across engines; Date.now() is a wall clock.',
          '/* Object.keys(rec) is insertion-ordered; new Map() too */',
          "const s = 'Math.random() and Date';",
          'const t = `new Set() ${a + b} Object.values`;',
          'const r = /Math\\.pow|Date/;',
          'const ok = Math.sqrt(x) + Math.floor(y) + Math.imul(a, b);',
          'const prop = row.Date + row.window;',
          'for (const k of sortedKeys(rec)) {}',
          'const mapped = items.map((d) => d);',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('keeps the code inside template substitutions', () => {
    expect(hitsIn('const s = `t=${Date.now()}`;')).toEqual(['1:Date']);
  });

  it('applies the Object.* ban to the engine only and honours the allowed modules', () => {
    expect(hitsIn('const k = Object.keys(t);', 'src/data/tuning/x.ts')).toEqual([]);
    expect(hitsIn('const k = Object.keys(t);', 'src/engine/core/iter.ts')).toEqual([]);
    expect(hitsIn('const m = new Map();', 'src/engine/core/memo.ts')).toEqual([]);
    expect(hitsIn('const m = new Map();', 'src/data/x.ts')).toEqual(['1:new Map/Set']);
  });
});
