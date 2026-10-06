// `finance.*` tuning constants (DESIGN §11 11.25). Keys must start with 'finance.'. P1 Wave 0 (contracts-data) wrote the
// difficulty-scaled keys and the keys read outside §11 (§1's start setup, §8's payroll displays, §13, bots; P1 contract
// §9.1); §11 adds the rest of 11.25.
import type { TuningTable } from './types';

export const financeTuning = {
  // ---- Difficulty-scaled (§1 1.11 via data/difficulty.ts)
  // P1 insolvency counter: weeks of negative cash before the run ends.
  'finance.p1InsolvencyGraceWeeks': 6,
  // Stage 0 Watch and §13's cash.projectedNegative when the 13-week P50 goes negative within N weeks (D-11.56).
  'finance.distress.watchWeeks': 4,

  // ---- Rates, payroll burden and the operating target
  // Prime = market.openingBaseRate + 3% (R5, calibration anchor).
  'finance.primeSpread': 0.03,
  // P1 payroll burden on gross (the 1.22× anchor).
  'finance.p1PayrollTaxRate': 0.14,
  'finance.p1WcRate': 0.08,
  'finance.defaultOperatingTargetUsd': 25000,

  // ---- Banker background P1 stub loan (§1 1.7; IR-2: the loan is §11's product, D-11.79): 9.0% at the opening prime.
  'finance.p1BankerLoanUsd': 150000,
  'finance.p1BankerLoanSpread': 0.02,
  'finance.p1BankerLoanTermMonths': 60,
} as const satisfies TuningTable;
