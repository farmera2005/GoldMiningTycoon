// `npm run sim` end to end, in-process (DESIGN §2.12; CLAUDE.md "Commands"): exit codes, the "available from Pn"
// refusals, tuning overrides, and the files --out writes.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runSimCli } from './cli';
import type { CliIo } from './run';

const dir = mkdtempSync(join(tmpdir(), 'gmt-sim-cli-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function sim(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { out: (l) => out.push(l), err: (l) => err.push(l), cwd: process.cwd() };
  const code = await runSimCli(argv, io);
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('npm run sim', () => {
  it('runs the P0 exit command shape (passive, 1 year) and exits 0', async () => {
    const r = await sim(['--games', '2', '--strategy', 'passive', '--years', '1', '--workers', '1']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('passive · bootstrapper · standard · none · llc · p0');
    expect(r.out).toMatch(/S_N\s+B_N\s+RS_N\s+retreated/);
    expect(r.out).toContain('bot defects: 0 rejected actions, 0 aborted games');
  });

  const refusals: [string[], RegExp][] = [
    [['--strategy', 'cautious', '--games', '1'], /--strategy cautious: available from P1/],
    [['--strategy', 'noMaintenance', '--games', '1'], /available from P3/],
    [['--strategy', 'brandOnly(yellowIron)', '--games', '1'], /available from P3/],
    [
      ['--strategy', 'passive', '--start', 'backedEquity', '--games', '1'],
      /--start backedEquity .*START_NOT_IN_PHASE.*available from P1/,
    ],
    [['--strategy', 'passive', '--start', 'inheritor', '--games', '1'], /available from P1/],
    [['--fixture', 'refSmallNorth'], /--fixture refSmallNorth: available from P1/],
    [['--market-only'], /--market-only: available from P5/],
    [['--events-only'], /--events-only: available from P3/],
    [['--world-only', '--econ', 'refSmallNorth'], /--econ refSmallNorth: available from P1/],
    [['--world-only', '--calendar'], /--calendar: available from P1/],
    [['--rules', 'p2', '--strategy', 'passive'], /phase-2 rules are available from P2/],
    [['--strategy', 'undercap', '--start', 'inheritor'], /plays only bootstrapper/],
  ];
  for (const [argv, message] of refusals) {
    it(`refuses ${argv.join(' ')} with exit 2`, async () => {
      const r = await sim([...argv, '--workers', '1']);
      expect(r.code).toBe(2);
      expect(r.err).toMatch(message);
    });
  }

  it('prints usage with exit 2 on a bad flag, and exit 0 for --help', async () => {
    const bad = await sim(['--nope']);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain('UNKNOWN_FLAG');
    expect(bad.err).toContain('usage: npm run sim');
    const help = await sim(['--help']);
    expect(help.code).toBe(0);
    expect(help.out).toContain('--world-only');
  });

  it('applies --tuning overrides (and refuses unknown or app-config keys)', async () => {
    const good = join(dir, 'good.json');
    writeFileSync(good, JSON.stringify({ 'game.startCompanyCashMult': 1.25 }));
    const out = join(dir, 'tuned');
    const r = await sim([
      '--strategy',
      'passive',
      '--games',
      '2',
      '--years',
      '1',
      '--workers',
      '1',
      '--tuning',
      good,
      '--out',
      out,
    ]);
    expect(r.code).toBe(0);
    const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
    const base = await sim([
      '--strategy',
      'passive',
      '--games',
      '2',
      '--years',
      '1',
      '--workers',
      '1',
      '--out',
      join(dir, 'base'),
    ]);
    expect(base.code).toBe(0);
    const baseSummary = JSON.parse(readFileSync(join(dir, 'base', 'summary.json'), 'utf8'));
    expect(summary.tuningHash).not.toBe(baseSummary.tuningHash);
    // $400k × 1.25 + $120k = $620k owner NW, and the NW ratio's start NW scales with it (BALANCE §5.3).
    expect(summary.cells[0].metrics.byYear[0].ownerNwUsd.p50.value).toBe(620_000);
    expect(summary.cells[0].metrics.byYear[0].nwRatio.p50.value).toBe(1);

    for (const [name, body, msg] of [
      ['unknown.json', { 'game.noSuchKey': 1 }, /TUNING_KEY_UNKNOWN/],
      ['app.json', { 'sim.defaultGames': 3 }, /TUNING_KEY_NOT_ENGINE/],
      ['array.json', [1, 2], /expected an object/],
    ] as const) {
      const p = join(dir, name);
      writeFileSync(p, JSON.stringify(body));
      const bad = await sim(['--strategy', 'passive', '--games', '1', '--workers', '1', '--tuning', p]);
      expect(bad.code).toBe(2);
      expect(bad.err).toMatch(msg);
    }
    const missing = await sim([
      '--strategy',
      'passive',
      '--games',
      '1',
      '--workers',
      '1',
      '--tuning',
      join(dir, 'none.json'),
    ]);
    expect(missing.code).toBe(2);
    expect(missing.err).toMatch(/cannot read JSON/);
  });

  it('runs --world-only and writes the world block', async () => {
    const out = join(dir, 'world');
    const r = await sim(['--world-only', '--games', '3', '--workers', '1', '--out', out]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('World only: 3 worlds');
    const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
    expect(summary.cells).toEqual([]);
    expect(summary.blocks.world.worlds).toBe(3);
    expect(summary.blocks.world.collectors.default.seeds.map((s: { seed: string }) => s.seed)).toEqual([
      '1000',
      '1001',
      '1002',
    ]);
    expect(readFileSync(join(out, 'games.csv'), 'utf8').split('\r\n')).toHaveLength(2);
  });

  it('writes summary.json with the run identity and timings only in timing.json', async () => {
    const out = join(dir, 'ident');
    const r = await sim([
      '--strategy',
      'passive',
      '--games',
      '2',
      '--years',
      '1',
      '--seed-base',
      '4242',
      '--workers',
      '1',
      '--out',
      out,
    ]);
    expect(r.code).toBe(0);
    const text = readFileSync(join(out, 'summary.json'), 'utf8');
    const summary = JSON.parse(text);
    expect(Object.keys(summary).slice(0, 5)).toEqual(['sha', 'tuningHash', 'botVersion', 'seedBase', 'gamesPerCell']);
    expect(summary).toMatchObject({ botVersion: '1.0', seedBase: 4242, gamesPerCell: 2 });
    expect(text).not.toMatch(/Ms"|meanMs|p95Ms/);
    const timing = JSON.parse(readFileSync(join(out, 'timing.json'), 'utf8'));
    expect(timing.total.weeks).toBe(102);
  });
});
