import { describe, expect, it, vi } from 'vitest';
import { hashValue } from '../core/hash';
import { ledgerProblem } from '../systems/finance/ledger';
import { cashOnHandCents, companyNetWorthCents, ownerNetWorthCents } from '../systems/finance/netWorth';
import { hashState } from './hash';
import { newGame } from './newGame';
import { BUILD_RULES_PHASE, RULES_VERSION } from './rules';
import { CURRENT_SCHEMA_VERSION } from './schema';
import { SetupError, defaultNewGameSetup } from './setup';
import { SLICE_KEYS } from './types';

// Several tests build fresh worlds (§3 generation can take ~1.5 s per newGame).
vi.setConfig({ testTimeout: 60_000 });

const SETUP = defaultNewGameSetup({ companyName: 'Turn Zero Mining LLC' });

describe('newGame (DESIGN §2.2, §2.6 turn semantics, D-2.13)', () => {
  const s = newGame(SETUP, 'seed-0');

  it('builds the turn-0 state: year 1, week 1, no actions yet, every slice present', () => {
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.clock).toEqual({ turn: 0, year: 1, week: 1, actionSeq: 0, phase: {} });
    for (const key of SLICE_KEYS) expect(typeof s[key]).toBe('object');
    expect(s.company).toMatchObject({ name: 'Turn Zero Mining LLC', runStatus: 'active', endReason: null });
    expect(s.meta).toMatchObject({ seed: 'seed-0', rulesVersion: RULES_VERSION, rulesPhase: BUILD_RULES_PHASE });
    expect(s.meta.tuningHash).toBe(hashValue(s.meta.tuning));
    expect(s.meta.setup).toEqual(SETUP);
    expect(s.meta.setup).not.toBe(SETUP);
  });

  it('posts the Bootstrapper opening capital through the ledger (§1 1.8: $400,000 company, $120,000 personal)', () => {
    expect(cashOnHandCents(s.finance)).toBe(40_000_000);
    const [capital] = s.finance.books.company.txns;
    expect(capital).toMatchObject({
      id: 'txn_000001',
      seq: 1,
      book: 'company',
      date: 0,
      source: '§1/start',
      lines: [
        { account: 'cash.operating', debit: 40_000_000 },
        { account: 'eq.ownerCapital', credit: 40_000_000 },
      ],
    });
    expect(s.finance.books.owner.balances['own.cash']).toBe(12_000_000);
    expect(s.ids.txn).toBe(2);
    expect(ledgerProblem(s.finance)).toBeNull();
  });

  it('starts the owner at $520,000 scoring net worth (§1 1.8 table)', () => {
    expect(companyNetWorthCents(s.finance, s.meta.tuning)).toBe(40_000_000);
    expect(ownerNetWorthCents(s.finance, s.meta.tuning)).toBe(52_000_000);
  });

  it('writes the 156 flat pre-history weeks at turns −156…−1 plus turn 0 (§2.5, §10 10.5)', () => {
    const weekly = s.history.weekly;
    expect(weekly).toHaveLength(157);
    expect(weekly[0]?.turn).toBe(-156);
    expect(weekly[155]?.turn).toBe(-1);
    expect(weekly[156]?.turn).toBe(0);
    expect(weekly.slice(0, 156).every((w) => w.company === undefined)).toBe(true);
    expect(weekly[0]?.market).toEqual({
      spot: 4200,
      goldIdx: 1,
      cpiIndex: 1,
      cpiYoY: 0,
      baseRate: 0.04,
      realRate: 0.04 - 0.03,
      usdIdx: 100,
      cbPublished: 650,
      geoRisk: 30,
      eqSentiment: 0.2,
      dieselRack: 3.6,
    });
    expect(weekly[156]?.company).toMatchObject({ cashCents: 40_000_000, ownerNwCents: 52_000_000 });
    expect(s.history.annual).toEqual([]);
  });

  it('is deterministic and freezes the state while auto-freeze is on', () => {
    expect(hashState(newGame(SETUP, 'seed-0'))).toBe(hashState(s));
    expect(hashState(newGame(SETUP, 'seed-1'))).not.toBe(hashState(s));
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.finance.books.company.txns)).toBe(true);
  });

  it('honours the setup opening spot (§1 1.6)', () => {
    const g = newGame({ ...SETUP, world: { ...SETUP.world, openingSpotUsdPerFineOz: 3000 } }, 'seed-0');
    expect(g.history.weekly[0]?.market.spot).toBe(3000);
  });

  it('refuses an invalid setup, an empty seed and a rules phase later than the build', () => {
    expect(() => newGame({ ...SETUP, companyName: '' }, 'x')).toThrow(SetupError);
    expect(() => newGame(SETUP, '')).toThrow(RangeError);
    expect(() => newGame(SETUP, 'x', undefined, { rulesPhase: 2 })).toThrow(RangeError);
    expect(newGame(SETUP, 'x').meta.rulesPhase).toBe(1);
    expect(newGame(SETUP, 'x', undefined, { rulesPhase: 0 }).meta.rulesPhase).toBe(0);
  });

  it('keeps simulator overrides in the game tuning and its hash', () => {
    const g = newGame(SETUP, 'seed-0', { 'game.start.bootstrapper.companyCashUsd': 250000 });
    expect(cashOnHandCents(g.finance)).toBe(25_000_000);
    expect(g.meta.tuningHash).not.toBe(s.meta.tuningHash);
  });
});
