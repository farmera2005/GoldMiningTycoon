import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CliIo } from '../run';
import { parseBalanceArgs, runBalanceCli } from './cli';

const dir = mkdtempSync(join(tmpdir(), 'gmt-balance-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function balance(argv: string[], games?: number): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { out: (l) => out.push(l), err: (l) => err.push(l), cwd: process.cwd() };
  const code = await runBalanceCli(argv, io, games === undefined ? {} : { games });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('npm run sim:balance', () => {
  it('parses its flags', () => {
    expect(parseBalanceArgs([])).toEqual({
      ok: true,
      options: { phase: 1, quick: false, workers: 0, out: null, baseline: null },
    });
    expect(parseBalanceArgs(['--phase', 'p0', '--quick'])).toMatchObject({
      ok: true,
      options: { phase: 0, quick: true },
    });
    expect(parseBalanceArgs(['--phase', '1'])).toMatchObject({ ok: true, options: { phase: 1 } });
    expect(parseBalanceArgs(['--phase', '2'])).toMatchObject({
      ok: false,
      message: expect.stringMatching(/available from P2/),
    });
    expect(parseBalanceArgs(['--phase', '9'])).toMatchObject({ ok: false });
    expect(parseBalanceArgs(['--frob'])).toMatchObject({ ok: false });
  });

  it('runs the P0 matrix (world block only), prints an all-N/A scorecard and writes the outputs', async () => {
    const out = join(dir, 'p0');
    // Three worlds stand in for --quick's 100 (the full §3 generator takes ~0.1 s a world).
    const r = await balance(['--phase', '0', '--quick', '--workers', '1', '--out', out], 3);
    expect(r.code).toBe(0);
    expect(r.out).toContain('no targets gate P0');
    expect(r.out).toMatch(/S_N · B_N · RS_N · retreated/);
    expect(r.out).toContain('World only: 3 worlds');
    const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
    expect(summary.cells).toEqual([]);
    expect(summary.targets.length).toBeGreaterThan(100);
    expect(summary.targets.every((t: { status: string }) => t.status === 'N/A')).toBe(true);
    expect(summary.blocks.world.worlds).toBe(3);
    expect(summary.blocks.matrix).toEqual([
      { id: 'world', cells: 0, years: 0, games: 3, gating: false, unavailable: null },
    ]);
    expect(readFileSync(join(out, 'games.csv'), 'utf8').startsWith('seed,bot,start')).toBe(true);
    expect(readFileSync(join(out, 'weekly-sample.csv'), 'utf8').startsWith('bot,start,difficulty')).toBe(true);
  });

  it('refuses a phase above the build with exit 2', async () => {
    const r = await balance(['--phase', '2']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/available from P2/);
  });
});
