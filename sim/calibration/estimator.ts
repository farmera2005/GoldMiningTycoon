// `npm run calibrate:estimator -- [--claims N] [--seed-base S] [--population held|listed|all] [--mix <stage>]
//   [--quota cell=N,...] [--workers N] [--max-worlds W] [--tuning overrides.json] [--json path]`
// The §4 estimator calibration against §3's engine generator (DESIGN §4.22 "Calibration", §4.19 P0 gate): N claims
// per cell (template × setting, old-timer kind, deep muck, 160-acre claims, listing pool) at every evidence mix.
// Gates per cell and mix: P10–P90 coverage 0.72–0.88, median ln(P50/truth) within ±0.10, block z sd 0.85–1.15; the
// listing pool also runs the teeth test. Exits non-zero on any FAIL. Worlds are consumed in index order and claims in
// id order, so the result is identical for any worker count.
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import {
  addRun,
  cellResult,
  GATES,
  HIDDEN_GATED_MIXES,
  newCell,
  TEETH,
  type CellAcc,
  type CellResult,
  type Population,
} from './estimator-cells';
import { STAGES, type Stage } from './estimator-stages';
import { runWorld, type WorldResult, type WorldTask } from './estimator-world';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function defaultSeedBase(): number {
  const seeds = JSON.parse(readFileSync(new URL('../../src/data/balance/seeds.json', import.meta.url), 'utf8')) as Record<
    string,
    number
  >;
  return seeds['p0'] ?? 1000;
}

/** Visible cells gate at every mix; hidden-attribute cells (`.ot.`, deepMuck) gate from the pit grid on. */
export const HELD_CELLS = [
  'north.valleyBottom',
  'north.bench',
  'north.dredgedGround',
  'north.noVisibleWorkings',
  'north.vis.handCut',
  'north.vis.recentCat',
  'north.vis.dredge',
  'north.160ac',
  'north.deepMuck',
  'north.ot.none',
  'north.ot.drift',
  'north.ot.handCut',
  'north.ot.recentCat',
  'north.ot.dredge',
  'arid.fan',
  'arid.gulch',
  'arid.bench',
  'arid.dredgedGround',
  'arid.noVisibleWorkings',
  'arid.vis.dryWash',
  'arid.vis.recentCat',
  'arid.vis.dredge',
  'arid.160ac',
  'arid.ot.none',
  'arid.ot.dryWash',
  'arid.ot.recentCat',
  'arid.ot.dredge',
] as const;
export const LISTED_CELLS = ['north.listed', 'arid.listed'] as const;

const f3 = (x: number): string => (Number.isFinite(x) ? x.toFixed(3) : '  —  ');
const f2 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : ' — ');

function report(r: CellResult): string[] {
  const lines = [
    `\n[${r.population}] ${r.cell}: ${r.claims} claims${r.pass ? '' : '   ← FAIL'}`,
    '  mix          n   cover  (95% CI)        <P10   >P90   bias    z mean  z sd   ms/est  gate',
  ];
  for (const s of r.stages) {
    const verdict = s.pass ? 'PASS' : `FAIL (${s.failing.join(', ')})`;
    lines.push(
      `  ${s.stage.padEnd(10)} ${String(s.n).padStart(4)}  ${f3(s.coverage)}  (${f3(s.coverLo)}–${f3(s.coverHi)})  ${f3(s.belowP10)}  ${f3(s.aboveP90)}  ${s.medianBias >= 0 ? '+' : ''}${f3(s.medianBias)}  ${f2(s.zMean).padStart(5)}  ${f2(s.zSd)}  ${s.msPerEstimate.toFixed(1).padStart(6)}  ${s.gated ? verdict : `reported: ${verdict.toLowerCase()}`}`,
    );
  }
  if (r.teeth !== undefined) {
    lines.push(
      `  teeth: statusMult.listed = 1 raises the prior-only median bias by ${r.teeth.delta.toFixed(4)} (target ${TEETH.target.toFixed(4)} ± ${TEETH.tol}) ${r.teeth.pass ? 'PASS' : 'FAIL'}`,
    );
  }
  return lines;
}

/** A worker that registers tsx's ESM loader before importing the TypeScript worker module. */
function workerBootstrap(): URL {
  const api = import.meta.resolve('tsx/esm/api');
  const target = new URL('./estimator-worker.ts', import.meta.url).href;
  const code = `import { register } from ${JSON.stringify(api)}; register(); await import(${JSON.stringify(target)});`;
  return new URL(`data:text/javascript,${encodeURIComponent(code)}`);
}

async function main(): Promise<void> {
  const claims = Number(arg('claims') ?? 1000);
  const seedBase = Number(arg('seed-base') ?? defaultSeedBase());
  const popArg = arg('population') ?? 'all';
  const populations: Population[] = popArg === 'all' ? ['held', 'listed'] : [popArg as Population];
  const mix = arg('mix');
  const stages: Stage[] = mix === undefined ? [...STAGES] : (mix.split(',') as Stage[]);
  for (const s of stages) if (!STAGES.includes(s)) throw new Error(`--mix: unknown evidence mix ${s}`);
  const maxWorlds = Number(arg('max-worlds') ?? 4000);
  const workers = Number(arg('workers') ?? Math.max(1, cpus().length));
  const tuningFile = arg('tuning');
  const onlyCells = arg('cells')?.split(',');
  const quota: Record<string, number> = {};
  for (const q of (arg('quota') ?? '').split(',').filter((x) => x.length > 0)) {
    const [k, v] = q.split('=');
    if (k !== undefined && v !== undefined) quota[k] = Number(v);
  }

  const accs: Record<string, CellAcc> = {};
  const cellKeys: string[] = [];
  for (const p of populations) {
    for (const c of p === 'held' ? HELD_CELLS : LISTED_CELLS) {
      if (onlyCells !== undefined && !onlyCells.includes(c)) continue;
      const key = `${p}:${c}`;
      accs[key] = newCell(c, p);
      cellKeys.push(key);
    }
  }
  const target = (key: string): number => quota[key.slice(key.indexOf(':') + 1)] ?? claims;
  const openCells = (): string[] => cellKeys.filter((k) => (accs[k] as CellAcc).claims < target(k));

  const t0 = performance.now();
  let genMs = 0;
  let worldsUsed = 0;
  const merge = (r: WorldResult): void => {
    worldsUsed = Math.max(worldsUsed, r.worldIndex + 1);
    genMs += r.genMs;
    for (const cr of r.results) {
      for (const c of cr.cells) {
        const key = `${cr.population}:${c}`;
        const acc = accs[key];
        if (acc === undefined || acc.claims >= target(key)) continue;
        addRun(acc, cr.run);
        if (cr.run.teethLnRatio !== undefined) acc.teethLnRatio.push(cr.run.teethLnRatio);
      }
    }
  };
  const task = (worldIndex: number): WorldTask => ({
    worldIndex,
    seedBase,
    stages,
    populations,
    openCells: openCells(),
    ...(tuningFile !== undefined ? { tuningFile } : {}),
  });

  if (workers <= 1) {
    for (let w = 0; w < maxWorlds && openCells().length > 0; w++) merge(runWorld(task(w)));
  } else {
    await new Promise<void>((resolve, reject) => {
      const pool: Worker[] = [];
      const pending: Record<number, WorldResult> = {};
      let nextDispatch = 0;
      let nextMerge = 0;
      let inFlight = 0;
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        for (const w of pool) void w.terminate();
        resolve();
      };
      const dispatch = (w: Worker): void => {
        if (done || nextDispatch >= maxWorlds || openCells().length === 0) {
          if (inFlight === 0) finish();
          return;
        }
        inFlight++;
        w.postMessage(task(nextDispatch++));
      };
      for (let i = 0; i < workers; i++) {
        const w = new Worker(workerBootstrap());
        w.on('message', (r: WorldResult) => {
          inFlight--;
          pending[r.worldIndex] = r;
          while (pending[nextMerge] !== undefined) {
            merge(pending[nextMerge] as WorldResult);
            delete pending[nextMerge];
            nextMerge++;
          }
          if (openCells().length === 0 && !done) {
            // Remaining in-flight worlds come after the merge point: their claims cannot be needed.
            finish();
            return;
          }
          dispatch(w);
        });
        w.on('error', reject);
        pool.push(w);
      }
      for (const w of pool) dispatch(w);
    });
  }

  const results = cellKeys.map((k) => cellResult(accs[k] as CellAcc, stages));
  const secs = (performance.now() - t0) / 1000;
  const out: string[] = [
    `Estimator calibration (DESIGN §4.22): ${claims} claims per cell${Object.keys(quota).length > 0 ? ` (quotas ${arg('quota')})` : ''}, seed base ${seedBase}, ${worldsUsed} worlds, ${workers} worker(s); ${secs.toFixed(0)} s (world generation ${(genMs / 1000).toFixed(0)} s of worker time)`,
    `Gates: coverage ${GATES.coverLo}–${GATES.coverHi}; |median ln(P50/truth)| ≤ ${GATES.biasAbs}; block z sd ${GATES.zsdLo}–${GATES.zsdHi}`,
    `Visible cells gate at every mix; hidden-attribute cells (.ot.<kind>, deepMuck) are reported before and gate at ${HIDDEN_GATED_MIXES.join(', ')}.`,
  ];
  for (const r of results) out.push(...report(r));
  const failed = results.filter((r) => !r.pass);
  const short = results.filter((r) => r.claims < target(`${r.population}:${r.cell}`));
  if (short.length > 0) out.push(`\nShort of quota after ${worldsUsed} worlds: ${short.map((r) => `${r.cell} (${r.claims})`).join(', ')}`);
  out.push(
    failed.length === 0
      ? '\nAll gated cell × mix results PASS.'
      : `\n${failed.length} cell(s) FAIL a gated mix: ${failed.map((r) => `${r.population}:${r.cell} (${r.stages.filter((s) => s.gated && !s.pass).map((s) => s.stage).join(', ')})`).join('; ')}`,
  );
  console.log(out.join('\n'));
  const json = arg('json');
  if (json !== undefined) writeFileSync(json, JSON.stringify({ claims, seedBase, worldsUsed, secs, results }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

void main();
