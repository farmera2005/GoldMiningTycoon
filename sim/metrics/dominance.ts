// The strategy dominance matrix (BALANCE §5.9, O-04): bot A dominates bot B in a start type when A ≥ B on S2, the
// median NW ratio at year 5 and the p90 NW ratio at year 5, and A > B by more than the larger 95% half-width on at
// least one of them. O-04 fails on any strict dominance and is at risk when dominance holds only within interval
// overlap: A ≥ B on all three, ahead on at least one, but never by more than the half-width.
import { halfWidth, type Estimate } from './stats';

export interface DominanceInput {
  bot: string;
  s2: Estimate;
  medianNwRatio5: Estimate;
  p90NwRatio5: Estimate;
}

export type DominanceVerdict = 'dominates' | 'withinInterval' | 'none' | 'n/a';

export interface DominancePair {
  a: string;
  b: string;
  verdict: DominanceVerdict;
}

const METRICS = ['s2', 'medianNwRatio5', 'p90NwRatio5'] as const;

/** A against B on the three §5.9 metrics. */
export function dominanceVerdict(a: DominanceInput, b: DominanceInput): DominanceVerdict {
  let allAtLeast = true;
  let aheadSomewhere = false;
  let clearlyAhead = false;
  for (const m of METRICS) {
    const ea = a[m];
    const eb = b[m];
    if (ea.value === null || eb.value === null) return 'n/a';
    const diff = ea.value - eb.value;
    if (diff < 0) allAtLeast = false;
    if (diff > 0) aheadSomewhere = true;
    const ha = halfWidth(ea);
    const hb = halfWidth(eb);
    const half = Math.max(ha ?? 0, hb ?? 0);
    if (diff > half) clearlyAhead = true;
  }
  if (!allAtLeast) return 'none';
  if (clearlyAhead) return 'dominates';
  return aheadSomewhere ? 'withinInterval' : 'none';
}

/** Every ordered pair (A, B), A ≠ B, in input order. */
export function dominanceMatrix(bots: readonly DominanceInput[]): DominancePair[] {
  const out: DominancePair[] = [];
  for (const a of bots) {
    for (const b of bots) {
      if (a.bot === b.bot) continue;
      out.push({ a: a.bot, b: b.bot, verdict: dominanceVerdict(a, b) });
    }
  }
  return out;
}

/** O-04's status from a matrix: FAIL on any strict dominance, AT-RISK on dominance within the intervals. */
export function dominanceStatus(pairs: readonly DominancePair[]): 'PASS' | 'AT-RISK' | 'FAIL' | 'N/A' {
  if (pairs.length === 0 || pairs.some((p) => p.verdict === 'n/a')) return 'N/A';
  if (pairs.some((p) => p.verdict === 'dominates')) return 'FAIL';
  if (pairs.some((p) => p.verdict === 'withinInterval')) return 'AT-RISK';
  return 'PASS';
}

/** "None of X dominates `cautious`" (O-04, G-01, G-02, G-06, G-08): the verdicts of each X against the reference. */
export function dominatesReference(bots: readonly DominanceInput[], reference: string): DominancePair[] {
  const ref = bots.find((b) => b.bot === reference);
  if (ref === undefined) return [];
  return bots
    .filter((b) => b.bot !== reference)
    .map((b) => ({ a: b.bot, b: reference, verdict: dominanceVerdict(b, ref) }));
}
