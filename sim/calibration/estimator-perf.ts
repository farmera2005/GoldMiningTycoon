// `npx tsx sim/calibration/estimator-perf.ts [--reps N]`: the §4 estimator's time budgets (DESIGN §2.13, §4.22
// "Performance"; s04 #2) on claims from §3's engine generator. Reports (1) the full solve of one claim, from a cold memo
// and on new evidence with the prior model cached: a 20-acre claim with 20 pits and a 160-acre claim with 60 samples
// (large-claim mode); (2) an economic-layer rerun (planning price moved, statistical layer cached); (3) the synthetic
// 8-tracked-claim year (sim/calibration/estimator-week.ts) refreshed every week through the incremental path, with
// each refresh classified by the deepest memo layer it computed (an appended production batch is the `append` row).
// `tests/perf/estimator.perf.test.ts` gates the same measurements. The 1.5 ms/week budget itself is measured on
// simulator games of the `cautious` and `heavyProspector` bots (4.22); the synthetic year is the regression check.
import { perfBudgets } from '../config';
import { benchEconRerun, benchFullSolves, formatStats, timingStats } from './estimator-bench';
import { buildEstimatorWeekScenario, REFRESH_KINDS, runEstimatorWeeks } from './estimator-week';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const reps = Number(arg('reps') ?? 20);
const now = (): number => performance.now();

const small = benchFullSolves('small', reps, now);
const large = benchFullSolves('large', Math.max(3, Math.ceil(reps / 4)), now, 1);
const econ = benchEconRerun(Math.max(4, Math.ceil(reps / 2)), now);
const scenario = buildEstimatorWeekScenario();
runEstimatorWeeks(scenario, now); // compile the incremental path before the timed year
const week = runEstimatorWeeks(scenario, now);

console.log(`§4 estimator performance (Node ${process.version}; world seed 2013)`);
console.log(
  `  full solve, 20-acre claim, ${small.samples} pits (${small.claims} claims), cold: ${formatStats(timingStats(small.coldMs))}   [budget ≤ 10 ms]`,
);
console.log(`  full solve, 20-acre claim, prior model cached: ${formatStats(timingStats(small.cachedMs))}`);
console.log(
  `  full solve, 160-acre claim (${large.blocks} blocks), ${large.samples} samples, large-claim mode (${large.claims} claims, ${large.hypotheses} hypotheses), cold: ${formatStats(timingStats(large.coldMs))}   [budget ≤ 60 ms]`,
);
console.log(`  full solve, 160-acre claim, prior model cached: ${formatStats(timingStats(large.cachedMs))}`);
console.log(
  `  economic-layer rerun (price moved, statistical layer cached): ${formatStats(timingStats(econ))}   [budget ≤ ${perfBudgets['sim.perf.estimatorEconRerunMs']} ms]`,
);
console.log(
  `  synthetic year, 8 tracked claims (2 operating, 1 prospecting, 5 watched): mean ${week.meanMs.toFixed(2)} ms per game-week from a cold memo, ${week.steadyMeanMs.toFixed(2)} from week 2, p95 ${week.p95Ms.toFixed(2)}   [budget ≤ ${perfBudgets['sim.perf.estimatorWeekMs']} ms on bot games]`,
);
console.log(
  `    by role (ms per week): operating ${week.byRoleMs.operating.toFixed(2)}, prospecting ${week.byRoleMs.prospecting.toFixed(2)}, watched ${week.byRoleMs.watched.toFixed(2)}`,
);
for (const kind of REFRESH_KINDS) {
  const xs = week.calls.filter((c) => c.kind === kind).map((c) => c.ms);
  if (xs.length === 0) continue;
  const total = xs.reduce((a, b) => a + b, 0);
  const budget = kind === 'append' ? '   [budget ≤ 1 ms per appended batch]' : '';
  console.log(`    ${kind.padEnd(6)} ${formatStats(timingStats(xs))}, ${total.toFixed(0)} ms in the year${budget}`);
}
