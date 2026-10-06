// Wave-0 stubs (P1 contract §0.2): every `CONTRACT-STUB(§n) <folder>.<function>` marker in src/engine and every stubbed
// action type is on the allowlist. The allowlist only shrinks: a package that implements a stub deletes its marker and
// its allowlist line together, so this test never goes red on progress; P1 exit requires both lists empty.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stubbedActionTypes } from '../../src/engine';
import { STUB_ACTIONS, STUB_FUNCTIONS } from './stubAllowlist';

const MARKER = /CONTRACT-STUB\((§\d+)\)(.*)$/;
const ID = /^ ([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

interface Marker {
  file: string;
  line: number;
  section: string;
  id: string | null;
}

function markers(): Marker[] {
  const out: Marker[] = [];
  for (const file of sourceFiles('src/engine')) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      const m = MARKER.exec(text);
      if (m === null) return;
      const id = ID.exec(m[2] ?? '');
      out.push({ file, line: i + 1, section: m[1] ?? '', id: id?.[1] ?? null });
    });
  }
  return out;
}

describe('Wave-0 stubs (P1 contract §0.2)', () => {
  const found = markers();

  it('names every marker with its function id', () => {
    expect(found.filter((m) => m.id === null).map((m) => `${m.file}:${m.line}`)).toEqual([]);
  });

  it('finds only allowlisted markers', () => {
    const allowed = new Set(STUB_FUNCTIONS);
    expect(
      found.filter((m) => m.id !== null && !allowed.has(m.id)).map((m) => `${m.id} (${m.file}:${m.line})`),
    ).toEqual([]);
  });

  it('lists only allowlisted stub actions', () => {
    const allowed = new Set(STUB_ACTIONS);
    expect(stubbedActionTypes().filter((t) => !allowed.has(t))).toEqual([]);
  });

  it('keeps the allowlist sorted and free of duplicates', () => {
    for (const list of [STUB_FUNCTIONS, STUB_ACTIONS]) {
      expect([...list].sort()).toEqual(list);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
