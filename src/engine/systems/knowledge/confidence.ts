// Confidence classes (DESIGN §4.8, D-4.6): spread, coverage and support gates, all of which must pass; a class also
// needs every gate of the class below it. Spread is measured without the pocket term (pockets are upside that no
// amount of drilling rules out, D-4.31).
import { exp, sqrt } from '../../core/dmath';
import type { EconLayer } from './economic';
import type { EstimatorParams } from './params';
import type { StatLayer } from './statistical';
import type { ConfidenceClass, ConfidenceGates } from './types';

export interface GateValues {
  readonly spread: number;
  readonly cov0: number;
  readonly cov2: number;
  readonly coarseSd: number;
  readonly processedBcy: number;
  readonly bedrockSamples: number;
  readonly productionBcy: number;
  readonly bulkBlocks: number;
}

type Conf = EstimatorParams['conf'];

/** The first failing gate of each class, in class order (inferred, indicated, measured). */
function failingGates(g: GateValues, c: Conf): { cls: ConfidenceClass; gate: string }[] {
  const out: { cls: ConfidenceClass; gate: string }[] = [];
  const inferred: [boolean, string][] = [
    [g.spread <= c.inferredMaxSpread, 'spread'],
    [g.cov2 >= c.inferredCoverage, 'coverage'],
    [g.bedrockSamples >= c.inferredMinBedrockSamples, 'bedrockSamples'],
  ];
  const indicated: [boolean, string][] = [
    [g.spread <= c.indicatedMaxSpread, 'spread'],
    [g.cov0 >= c.indicatedCoverage, 'coverage'],
    [g.coarseSd <= c.indicatedMaxCoarseLogSd, 'coarse'],
    [g.processedBcy >= c.indicatedMinProcessedBcy, 'support'],
  ];
  const measured: [boolean, string][] = [
    [g.spread <= c.measuredMaxSpread, 'spread'],
    [g.cov0 >= c.measuredCoverage, 'coverage'],
    [g.coarseSd <= c.measuredMaxCoarseLogSd, 'coarse'],
    [g.productionBcy >= c.measuredMinProdBcy || g.bulkBlocks >= c.measuredMinBulkBlocks, 'support'],
  ];
  for (const [cls, gates] of [
    ['inferred', inferred],
    ['indicated', indicated],
    ['measured', measured],
  ] as const) {
    const f = gates.find(([ok]) => !ok);
    if (f !== undefined) out.push({ cls, gate: f[1] });
  }
  return out;
}

/** classify(gates): the highest class whose gates and every lower class's gates pass. */
export function classifyConfidence(
  g: GateValues,
  c: Conf,
): { cls: ConfidenceClass; failing: { cls: ConfidenceClass; gate: string }[] } {
  const failing = failingGates(g, c);
  const fails = (cls: ConfidenceClass): boolean => failing.some((f) => f.cls === cls);
  let cls: ConfidenceClass = 'speculative';
  if (!fails('inferred')) {
    cls = 'inferred';
    if (!fails('indicated')) {
      cls = 'indicated';
      if (!fails('measured')) cls = 'measured';
    }
  }
  return { cls, failing };
}

/**
 * d_b: along-valley distance in rows from b to the nearest block in the same or an adjacent column with a
 * bedrock-logged sample; 0 only for a block sampled itself (a neighbour on the same row counts 1).
 */
export function coverageDistances(stat: StatLayer): Int32Array {
  const m = stat.model;
  const n = m.n;
  const d = new Int32Array(n).fill(1 << 20);
  const sampled: number[] = [];
  for (let b = 0; b < n; b++) if ((stat.stats.bedrock[b] as number) > 0) sampled.push(b);
  for (let b = 0; b < n; b++) {
    if ((stat.stats.bedrock[b] as number) > 0) {
      d[b] = 0;
      continue;
    }
    for (const c of sampled) {
      const dj = Math.abs((m.bj[c] as number) - (m.bj[b] as number));
      if (dj > 1) continue;
      const di = Math.abs((m.bi[c] as number) - (m.bi[b] as number));
      d[b] = Math.min(d[b] as number, Math.max(di, dj));
    }
  }
  return d;
}

export interface ConfidenceResult {
  readonly gates: ConfidenceGates;
  readonly cls: ConfidenceClass;
  readonly blockClass: readonly ConfidenceClass[];
}

export function confidence(stat: StatLayer, econ: EconLayer): ConfidenceResult {
  const m = stat.model;
  const n = m.n;
  const c = m.params.conf;
  // Footprint F (§4.8): the minable set; else blocks whose P90 clears the cutoff; else all blocks ('belowCutoff').
  let F: number[] = [];
  for (let b = 0; b < n; b++) if (econ.blocks.minable[b] === 1) F.push(b);
  let belowCutoff = false;
  if (F.length === 0) {
    for (let b = 0; b < n; b++)
      if ((stat.gradeQ.p90[b] as number) >= (econ.blocks.cutoff[b] as number) && stat.agg.alive[b] === 1) F.push(b);
  }
  if (F.length === 0) {
    belowCutoff = true;
    F = [];
    for (let b = 0; b < n; b++) F.push(b);
  }
  const d = coverageDistances(stat);
  let c0 = 0;
  let c2 = 0;
  let bulkBlocks = 0;
  for (const b of F) {
    if ((d[b] as number) === 0) c0++;
    if ((d[b] as number) <= c.inferredMaxRowGap) c2++;
    if (stat.stats.bulk[b] === 1) bulkBlocks++;
  }
  let processedBcy = 0;
  let bedrockSamples = 0;
  for (const s of stat.samples) {
    if (s.interval === 'fullColumn') bedrockSamples++;
    const fam = s.rec.methodId;
    if (
      s.reachedPay &&
      s.interval !== 'exposure' &&
      (fam === 'excavatorPit' || fam === 'trench' || fam === 'handPit' || fam === 'drywasher' || fam === 'bulkSample')
    ) {
      processedBcy += s.V;
    }
  }
  const R50 = exp(stat.coarse.mr);
  const p50 = R50 / (1 + R50);
  const anyMinable = econ.blocks.minable.some((x) => x === 1);
  const spread = anyMinable
    ? econ.minable.baseP90 / econ.minable.baseP10
    : stat.contained.baseP90 / stat.contained.baseP10;
  const values: GateValues = {
    spread,
    cov0: c0 / F.length,
    cov2: c2 / F.length,
    coarseSd: p50 * sqrt(stat.coarse.vr),
    processedBcy,
    bedrockSamples,
    productionBcy: 0,
    bulkBlocks,
  };
  const { cls, failing } = classifyConfidence(values, c);
  const blockClass: ConfidenceClass[] = [];
  for (let b = 0; b < n; b++) {
    const sd = stat.lnGSd[b] as number;
    const big = (stat.stats.maxPaySampleBcy[b] as number) >= c.blockMeasuredMinSampleBcy;
    if (big && sd <= c.blockMaxLogSd.measured) blockClass.push('measured');
    else if ((stat.stats.bedrock[b] as number) > 0 && sd <= c.blockMaxLogSd.indicated) blockClass.push('indicated');
    else if ((d[b] as number) <= c.inferredMaxRowGap && sd <= c.blockMaxLogSd.inferred) blockClass.push('inferred');
    else blockClass.push('speculative');
  }
  return { gates: { ...values, belowCutoff, failing }, cls, blockClass };
}
