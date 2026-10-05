// advanceWeek time budget (DESIGN §2.13, `npm run test:perf`): mean ≤ sim.perf.weekMeanMs and p95 ≤ sim.perf.weekCeilingMs
// in simulator mode (explain off, auto-freeze off) on a fixed fixture: a P0 Bootstrapper played for ten years. The
// P3 mid-game fixture (4 claims, 5 plant lines, 24 machines) replaces it when those systems exist. Also checks the
// state's serialized size against save.maxStateKb at year 10.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  advanceWeek,
  defaultNewGameSetup,
  newGame,
  serializeSaveFile,
  setEngineAutoFreeze,
  toSaveFile,
  type GameState,
} from '../../src/engine';
import { perfBudgets, saveBudgets } from './budgets';

const WARMUP_WEEKS = 26;
const MEASURED_WEEKS = 520;

function percentile(sorted: readonly number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, idx)] as number;
}

beforeAll(() => setEngineAutoFreeze(false));
afterAll(() => setEngineAutoFreeze(true));

describe('advanceWeek performance (§2.13)', () => {
  it('meets the simulator mean and p95 budgets over ten years', () => {
    let s: GameState = newGame(defaultNewGameSetup({ companyName: 'Perf Placers' }), 'perf-p0');
    for (let i = 0; i < WARMUP_WEEKS; i++) s = advanceWeek(s).state;
    const times: number[] = [];
    for (let i = 0; i < MEASURED_WEEKS; i++) {
      const t0 = performance.now();
      s = advanceWeek(s, { explain: false }).state;
      times.push(performance.now() - t0);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = percentile(
      [...times].sort((a, b) => a - b),
      0.95,
    );
    console.log(`advanceWeek: mean ${mean.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms over ${MEASURED_WEEKS} weeks`);
    expect(mean).toBeLessThanOrEqual(perfBudgets['sim.perf.weekMeanMs']);
    expect(p95).toBeLessThanOrEqual(perfBudgets['sim.perf.weekCeilingMs']);

    const stateKb = JSON.stringify(s).length / 1024;
    const fileKb = serializeSaveFile(toSaveFile(s, { slotName: 'perf', savedAt: '' })).length / 1024;
    const historyKb = JSON.stringify(s.history).length / 1024;
    console.log(
      `year-${s.clock.year} state ${stateKb.toFixed(1)} kB, save ${fileKb.toFixed(1)} kB, history ${historyKb.toFixed(1)} kB`,
    );
    expect(stateKb).toBeLessThanOrEqual(saveBudgets['save.maxStateKb']);
    expect(fileKb).toBeLessThanOrEqual(saveBudgets['save.maxFileKb']);
    expect(historyKb).toBeLessThanOrEqual(saveBudgets['save.sliceBudgetKb'].history);
  });
});
