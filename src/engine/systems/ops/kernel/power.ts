// DESIGN §7 7.6.7 power. Generators supply the claim; electric pumps and each line's wash-plant core must be met or that
// load cannot run; concentrators are optional loads, shed largest first across the claim until demand fits, and a line
// whose concentrator is shed falls back to its sluice for the hour (7.9). Lines are served in lineId order (D-7.49).
import { compareIds } from '../../../core/ids';

export interface PowerLoad {
  id: string;
  kw: number;
}

export interface LinePowerDemand {
  lineId: string;
  /** The wash plant's powerKw (0 for a self-powered diesel trommel). */
  coreKw: number;
  /** Online concentrators on the line's plant. */
  concentrators: readonly PowerLoad[];
}

export interface PowerInput {
  /** Σ generator kW × u this hour-block. */
  supplyKw: number;
  /** Electric pumps (shared claim loads; §9's P1 pumps are diesel, powerKw 0). */
  pumps: readonly PowerLoad[];
  /** Lines in ascending lineId. */
  lines: readonly LinePowerDemand[];
}

export interface PowerAllocation {
  /** Electric pumps run (false: no circulating water this hour, cause power). */
  pumpsRun: boolean;
  /** Lines whose core load was met, in input order. */
  lineRuns: boolean[];
  /** Concentrators shed this hour, in shed order (largest first). */
  shedIds: string[];
  /** kW actually drawn. */
  servedKw: number;
  /** kW demanded (every load). */
  demandKw: number;
}

/**
 * Allocates the hour's supply (7.6.7): electric pumps first (a claim-wide core load), then each line's plant core in
 * lineId order (a line whose core does not fit cannot run, cause power), then concentrators of running lines, shedding
 * the largest first (ties: larger id first, so the lower id keeps power) until the rest fits.
 */
export function allocatePower(input: PowerInput): PowerAllocation {
  let remaining = Math.max(0, input.supplyKw);
  let demandKw = 0;
  let servedKw = 0;
  let pumpKw = 0;
  for (const pm of input.pumps) pumpKw += Math.max(0, pm.kw);
  demandKw += pumpKw;
  const pumpsRun = pumpKw <= remaining;
  if (pumpsRun) {
    remaining -= pumpKw;
    servedKw += pumpKw;
  }
  const lineRuns: boolean[] = [];
  const conc: PowerLoad[] = [];
  for (const line of input.lines) {
    const core = Math.max(0, line.coreKw);
    demandKw += core;
    for (const c of line.concentrators) demandKw += Math.max(0, c.kw);
    const runs = pumpsRun && core <= remaining;
    lineRuns.push(runs);
    if (runs) {
      remaining -= core;
      servedKw += core;
      for (const c of line.concentrators) conc.push(c);
    }
  }
  // Shed order: largest kW first; equal kW sheds the larger id first.
  const order = [...conc].sort((a, b) => b.kw - a.kw || compareIds(b.id, a.id));
  let concKw = 0;
  for (const c of conc) concKw += Math.max(0, c.kw);
  const shedIds: string[] = [];
  for (const c of order) {
    if (concKw <= remaining) break;
    shedIds.push(c.id);
    concKw -= Math.max(0, c.kw);
  }
  servedKw += concKw;
  return { pumpsRun, lineRuns, shedIds, servedKw, demandKw };
}

/** A generator's §9 load factor: clamp(demandKw / (0.75 × kW), 0.35, 1.33) (7.6.7). */
export function generatorLoadFactor(demandKw: number, generatorKw: number): number {
  if (!(generatorKw > 0)) return 0.35;
  const lf = demandKw / (0.75 * generatorKw);
  return lf < 0.35 ? 0.35 : lf > 1.33 ? 1.33 : lf;
}
