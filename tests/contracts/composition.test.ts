// Per-folder composition (P1 contract §1.1, §12): no selector or explainer name in two folders, and every explainer
// callable on a fresh P1 state, with arguments naming entities of that state where it has them (Wave-0 stubs answer
// with a zero leaf that says so; real bodies answer from the state).
import { describe, expect, it } from 'vitest';
import { defaultNewGameSetup, explain, newGame, type CalcNode, type ExplainerName } from '../../src/engine';
import { EXPLAINER_SOURCES } from '../../src/engine/explain';
import { SELECTOR_SOURCES } from '../../src/engine/select';

const SETUP = defaultNewGameSetup({ companyName: 'Composition Test' });
const STATE = newGame(SETUP, 'composition');
const claimId = STATE.world.claimIds[0] ?? '';
const districtId = STATE.world.districtIds[0] ?? '';
const year1 = { kind: 'year', year: 1 } as const;

/** Arguments after the state, per explainer (the rest take none). */
const ARGS: Partial<Record<ExplainerName, readonly unknown[]>> = {
  seasonForecast: [districtId],
  weatherHoursMult: [districtId, 0],
  startPreview: [SETUP],
  statementLine: [year1, 'revenue'],
  loanPayment: ['loan_000001'],
  costPerOunce: [year1],
  fleetMaintRate: ['mch_000001'],
  resaleEstimate: ['mch_000001'],
  equipmentPrice: ['lst_000001'],
  transportQuote: [[], claimId],
  bookValue: ['mch_000001'],
  lotFineness: ['lot_000001'],
  netSalePerFineOz: ['lot_000001'],
  localBuyerQuote: [[], 'lb_000001'],
  claimEstimate: [claimId],
  programPreview: [{}],
  listingAsk: ['lst_000001'],
  claimValue: [claimId],
  cleanupSplit: [claimId, 1, 'L1'],
  leaseObligations: ['ten_000001'],
  valuationView: [claimId],
  opsProjection: [claimId],
  recoveryBySize: [claimId, 'L1'],
  siteMobilization: [claimId],
  morale: ['emp_000001'],
  quitRisk: ['emp_000001'],
  ask: ['cand_000001'],
  accessFactors: [claimId],
  waterAvailable: [claimId],
  siteVisitQuote: [claimId],
};

function collisions(sources: Readonly<Record<string, object>>): string[] {
  const seen: Record<string, string> = {};
  const out: string[] = [];
  for (const [folder, entries] of Object.entries(sources)) {
    for (const name of Object.keys(entries)) {
      const first = seen[name];
      if (first !== undefined) out.push(`${name}: ${first} and ${folder}`);
      else seen[name] = folder;
    }
  }
  return out;
}

describe('per-folder composition (P1 contract §1.1)', () => {
  it('has no selector or explainer name in two folders', () => {
    expect(collisions(SELECTOR_SOURCES)).toEqual([]);
    expect(collisions(EXPLAINER_SOURCES)).toEqual([]);
  });

  it('calls every explainer on a fresh P1 state and gets a calc tree', () => {
    expect(STATE.meta.rulesPhase).toBe(1);
    for (const name of Object.keys(explain) as ExplainerName[]) {
      const fn = explain[name] as (state: typeof STATE, ...args: readonly unknown[]) => CalcNode;
      const args = ARGS[name] ?? [];
      const tree = fn(STATE, ...args);
      expect(typeof tree.label, name).toBe('string');
      expect(Number.isFinite(tree.value), name).toBe(true);
    }
  });
});
