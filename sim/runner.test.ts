// The pool's determinism contract (D-2.12; BALANCE §6.2): game i uses seed seedBase + i, outputs are in game-index
// order, and summary.json and games.csv are byte-identical for any worker count and across runs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashState, newGame, setEngineAutoFreeze } from '../src/engine';
import { seedFor, playGame } from './game';
import { runWorldOnly } from './modes/worldOnly';
import { gamesCsv, orderedSummary, SUMMARY_METHODS, summaryJson, weeklySampleCsv, type SimSummary } from './report';
import { cellRunSpec, playCell, type PlayedCell } from './run';
import { createPool, resolveWorkerCount, timingStats, type SimPool } from './runner';
import { setupForCell } from './setup';

const CELL = { start: 'bootstrapper', difficulty: 'standard', background: 'none', entity: 'llc' } as const;
const spec = cellRunSpec({
  cell: CELL,
  bot: { id: 'passive', param: null },
  rulesPhase: 0,
  overrides: {},
  years: 1,
  seedBase: 2000,
  games: 4,
});

function summaryOf(p: PlayedCell): string {
  const s: SimSummary = {
    sha: 'test',
    tuningHash: p.summary.tuningHash,
    botVersion: '1.0',
    seedBase: spec.seedBase,
    gamesPerCell: spec.games,
    rulesVersion: 'test',
    methods: SUMMARY_METHODS,
    cells: [p.summary],
    targets: [],
    blocks: {},
  };
  return summaryJson(orderedSummary(s));
}

beforeAll(() => setEngineAutoFreeze(false));
afterAll(() => setEngineAutoFreeze(true));

describe('seed mapping (BALANCE §6.2)', () => {
  it('game i plays seed seedBase + i', () => {
    expect(seedFor(1000, 0)).toBe('1000');
    expect(seedFor(1000, 41)).toBe('1041');
    const rec = playGame(spec, 3, () => 0);
    expect(rec.result.seed).toBe('2003');
    expect(rec.result.index).toBe(3);
  });

  it('plays Y years to turn 52Y − 1, the last week of year Y', () => {
    const rec = playGame(spec, 0, () => 0);
    expect(rec.result.finalTurn).toBe(51);
    expect(rec.weekMs).toHaveLength(51);
    expect(rec.weekly).toHaveLength(52);
    expect(rec.result.byYear).toHaveLength(1);
    expect(rec.result.byYear[0]).toMatchObject({ year: 1, turn: 51, carried: false, netIncomeCents: 0 });
  });

  it('resolves worker count 0 to the CPU cores', () => {
    expect(resolveWorkerCount(0)).toBeGreaterThanOrEqual(1);
    expect(resolveWorkerCount(3)).toBe(3);
  });
});

describe('worker-count invariance and determinism (D-2.12)', () => {
  // One in-process pool and one of three threads serve every test here (each thread boots tsx and the engine once).
  let one: SimPool;
  let three: SimPool;
  beforeAll(() => {
    one = createPool(1);
    three = createPool(3);
  });
  afterAll(async () => {
    await one.close();
    await three.close();
  });

  it('workers 1 and 3 give byte-identical summary.json, games.csv and weekly-sample.csv', async () => {
    // Two runs of the same cell: in-process and on three workers.
    const a = await playCell(one, spec);
    const b = await playCell(three, spec);
    expect(b.run.results.map((r) => r.seed)).toEqual(['2000', '2001', '2002', '2003']);
    expect(summaryOf(b)).toBe(summaryOf(a));
    expect(gamesCsv([b.run])).toBe(gamesCsv([a.run]));
    expect(weeklySampleCsv([b.run])).toBe(weeklySampleCsv([a.run]));
    // Timings exist but are kept out of every deterministic output.
    expect(timingStats(b.run.weekMs).weeks).toBe(4 * 51);
    expect(summaryOf(b)).not.toContain('Ms');

    const worldSpec = { setup: setupForCell(CELL), rulesPhase: 0 as const, overrides: {}, seedBase: 2000, games: 3 };
    const w1 = await runWorldOnly(one, worldSpec);
    const w3 = await runWorldOnly(three, worldSpec);
    expect(JSON.stringify(w3)).toBe(JSON.stringify(w1));
    expect((w1.collectors['default'] as { seeds: { stateHash: string }[] }).seeds[2]?.stateHash).toBeDefined();
  }, 30_000);

  it('a worker job that throws rejects the run with the job index, and the pool keeps working', async () => {
    const broken = { ...spec, bot: { id: 'cautious' as const, param: null }, botLabel: 'cautious' };
    await expect(playCell(three, broken)).rejects.toThrow(
      /job \d+ failed in a worker: playGame: bot cautious is not implemented/,
    );
    // Late replies from the failed run are ignored by the next one.
    const next = await playCell(three, spec);
    expect(next.run.results.map((r) => r.seed)).toEqual(['2000', '2001', '2002', '2003']);
  }, 30_000);

  it('the world block hashes match newGame directly', async () => {
    const r = await runWorldOnly(one, {
      setup: setupForCell(CELL),
      rulesPhase: 0,
      overrides: {},
      seedBase: 10,
      games: 2,
    });
    const direct = newGame(setupForCell(CELL), '11');
    const seeds = (r.collectors['default'] as { seeds: { seed: string; stateHash: string }[] }).seeds;
    expect(seeds[1]).toMatchObject({ seed: '11', stateHash: hashState(direct) });
  });
});
