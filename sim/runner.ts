// The worker pool (DESIGN §2.12 "Harness", D-2.12; BALANCE §6.2). Jobs are numbered by game index and handed to idle
// workers; outputs are delivered to the caller in index order, so every output is byte-identical whatever the worker
// count. `--workers 1` runs in-process through the same job function (sim/jobs.ts).
//
// Workers are child processes started with `--import tsx`, not worker threads: tsx's loader does not resolve the
// engine's extensionless and directory imports inside a worker thread (Node 22), and registering it from the worker
// would make sim/ import the tsx package, which the layering rules forbid (tests/architecture/layering.test.ts).
// Messages use the V8 serializer, the structured clone a worker thread would use.
import { fork, type ChildProcess } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { GameState } from '../src/engine';
import type { CellRunSpec, GameRecord, WeeklySampleRow } from './game';
import { runJob } from './jobs';
import type { GameResult } from './metrics/gameResult';
import type { FromWorker, Job, JobOutput, ToWorker, WorldRunSpec } from './protocol';

/** `sim.workers` / `--workers`: 0 means one per CPU core. */
export function resolveWorkerCount(requested: number): number {
  return requested > 0 ? requested : Math.max(1, availableParallelism());
}

export interface SimPool {
  /** Worker processes (1 = in-process). */
  readonly size: number;
  /** Runs jobs 0..count−1 and calls onOutput in index order. Rejects on the first failed job. */
  run(
    count: number,
    makeJob: (index: number) => Job,
    onOutput: (index: number, output: JobOutput) => void,
  ): Promise<void>;
  close(): Promise<void>;
}

const clock = (): number => performance.now();

function inProcessPool(): SimPool {
  return {
    size: 1,
    run(count, makeJob, onOutput) {
      try {
        for (let i = 0; i < count; i++) onOutput(i, runJob(makeJob(i), clock));
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
    close: () => Promise.resolve(),
  };
}

/** The repository root: workers run there so `--import tsx` resolves from its node_modules. */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKER_ENTRY = fileURLToPath(new URL('./worker.ts', import.meta.url));

class ProcessPool implements SimPool {
  readonly size: number;
  private readonly workers: ChildProcess[];
  private runs = 0;

  constructor(size: number) {
    this.size = size;
    this.workers = Array.from({ length: size }, () =>
      fork(WORKER_ENTRY, [], { cwd: REPO_ROOT, execArgv: ['--import', 'tsx'], serialization: 'advanced' }),
    );
  }

  run(
    count: number,
    makeJob: (index: number) => Job,
    onOutput: (index: number, output: JobOutput) => void,
  ): Promise<void> {
    if (count === 0) return Promise.resolve();
    const runId = ++this.runs;
    return new Promise<void>((resolve, reject) => {
      let nextIndex = 0;
      let nextToDeliver = 0;
      let failed = false;
      // Outputs that finished ahead of a slower earlier index wait here; at most `size` are ever in flight.
      const buffer = new Map<number, JobOutput>();
      const cleanups: (() => void)[] = [];
      const finish = (err: Error | null): void => {
        if (failed) return;
        if (err !== null) failed = true;
        for (const c of cleanups) c();
        if (err === null) resolve();
        else reject(err);
      };
      const dispatch = (w: ChildProcess): void => {
        if (nextIndex >= count) return;
        const index = nextIndex++;
        const msg: ToWorker = { type: 'job', runId, jobId: index, job: makeJob(index) };
        w.send(msg);
      };
      for (const w of this.workers) {
        const onMessage = (raw: unknown): void => {
          const msg = raw as FromWorker;
          if (failed || msg.runId !== runId) return;
          if (msg.type === 'failed') {
            finish(new Error(`simulator job ${msg.jobId} failed in a worker: ${msg.message}\n${msg.stack}`));
            return;
          }
          buffer.set(msg.jobId, msg.output);
          try {
            while (buffer.has(nextToDeliver)) {
              const out = buffer.get(nextToDeliver) as JobOutput;
              buffer.delete(nextToDeliver);
              onOutput(nextToDeliver, out);
              nextToDeliver++;
            }
          } catch (e) {
            finish(e instanceof Error ? e : new Error(String(e)));
            return;
          }
          if (nextToDeliver >= count) finish(null);
          else dispatch(w);
        };
        const onError = (e: Error): void => finish(new Error(`simulator worker failed: ${e.message}`));
        const onExit = (code: number | null): void =>
          finish(new Error(`simulator worker exited early (code ${String(code)})`));
        w.on('message', onMessage);
        w.on('error', onError);
        w.on('exit', onExit);
        cleanups.push(() => {
          w.off('message', onMessage);
          w.off('error', onError);
          w.off('exit', onExit);
        });
      }
      for (const w of this.workers) dispatch(w);
    });
  }

  async close(): Promise<void> {
    await Promise.all(
      this.workers.map(
        (w) =>
          new Promise<void>((done) => {
            if (w.exitCode !== null || w.signalCode !== null) return done();
            w.once('exit', () => done());
            w.kill();
          }),
      ),
    );
  }
}

/** A pool of `workers` processes; 1 runs in-process. */
export function createPool(workers: number): SimPool {
  return workers <= 1 ? inProcessPool() : new ProcessPool(workers);
}

export interface TimingStats {
  weeks: number;
  meanMs: number | null;
  p95Ms: number | null;
}

/** Mean and type-7 p95 of per-week times (DESIGN §2.13; O-13's speed half). Console and timing.json only. */
export function timingStats(weekMs: Float64Array | readonly number[]): TimingStats {
  const n = weekMs.length;
  if (n === 0) return { weeks: 0, meanMs: null, p95Ms: null };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += weekMs[i] as number;
  const sorted = Float64Array.from(weekMs).sort();
  const h = (n - 1) * 0.95;
  const lo = Math.floor(h);
  const xLo = sorted[lo] as number;
  const xHi = sorted[Math.min(lo + 1, n - 1)] as number;
  return { weeks: n, meanMs: sum / n, p95Ms: xLo + (h - lo) * (xHi - xLo) };
}

export interface WeeklySample {
  index: number;
  seed: string;
  rows: WeeklySampleRow[];
}

export interface CellRun {
  spec: CellRunSpec;
  /** Index order. */
  results: GameResult[];
  weekly: WeeklySample[];
  /** advanceWeek times of every simulated week of the cell, ms (never in deterministic outputs). */
  weekMs: Float64Array;
}

/** Plays every game of a cell. */
export async function runCell(pool: SimPool, spec: CellRunSpec): Promise<CellRun> {
  const results: GameResult[] = [];
  const weekly: WeeklySample[] = [];
  const times: number[][] = [];
  await pool.run(
    spec.games,
    (index) => ({ kind: 'game', spec, index }),
    (index, out) => {
      if (out.kind !== 'game') throw new Error('runCell: a worker returned a non-game output');
      const record: GameRecord = out.record;
      results.push(record.result);
      if (record.weekly !== null) weekly.push({ index, seed: record.result.seed, rows: record.weekly });
      times.push(record.weekMs);
    },
  );
  let total = 0;
  for (const t of times) total += t.length;
  const weekMs = new Float64Array(total);
  let at = 0;
  for (const t of times) {
    weekMs.set(t, at);
    at += t.length;
  }
  return { spec, results, weekly, weekMs };
}

/** World-only (DESIGN §2.12): newGame for each seed, states delivered in index order to `onState`. */
export async function runWorlds(
  pool: SimPool,
  spec: WorldRunSpec,
  onState: (index: number, state: GameState) => void,
): Promise<void> {
  await pool.run(
    spec.games,
    (index) => ({ kind: 'world', spec, index }),
    (index, out) => {
      if (out.kind !== 'world') throw new Error('runWorlds: a worker returned a non-world output');
      onState(index, out.state);
    },
  );
}
