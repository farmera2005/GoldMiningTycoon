// The simulator consumes the engine only through its public surface (CLAUDE.md "Public surface"; DESIGN §2.12: bots
// and the harness never import engine internals) plus src/data/**, and never the UI or persistence layers.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const simDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(simDir, '..');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|mjs)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:import|export)[^'"]*?from\s+'([^']+)'|import\('([^']+)'\)|^import\s+'([^']+)'/gm)].map(
    (m) => (m[1] ?? m[2] ?? m[3]) as string,
  );
}

describe('simulator layering', () => {
  const files = sources(simDir).filter((f) => !relative(simDir, f).startsWith('calibration'));

  it('finds the simulator sources', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    it(`${relative(root, file)} imports the engine only through src/engine/index.ts`, () => {
      for (const spec of imports(file).filter((s) => s.startsWith('.'))) {
        const target = relative(root, resolve(dirname(file), spec));
        if (target.startsWith('src/engine')) expect(target, spec).toBe('src/engine');
        expect(target.startsWith('src/ui') || target.startsWith('src/persistence'), spec).toBe(false);
      }
    });
  }
});
