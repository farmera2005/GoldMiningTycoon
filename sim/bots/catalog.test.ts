// Bot catalog tests (DESIGN §2.12.1, §2.14 "Bots"; CLAUDE.md "Bots"): the registry carries every bot id CLAUDE.md
// lists with its phase; every implemented bot plays 20 seeds × 2 years with zero validator rejections and identical
// decisions under scrambled hidden state.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceWeek,
  canAdvance,
  defaultRunAnchor,
  evaluateStops,
  newGame,
  setEngineAutoFreeze,
  type Action,
  type GameState,
  type StopReason,
} from '../../src/engine';
import { simStopRules } from '../game';
import { cellRunSpec, playCell } from '../run';
import { createPool } from '../runner';
import { setupForCell } from '../setup';
import { BOT_CATALOG, BOT_VERSION, botEntry, botsActiveIn, implementedBot, parseBotSpec } from './catalog';
import { chosenOptionId } from './decisions';
import { scrambleHidden, withoutHidden } from './scramble';
import type { Bot } from './types';
import { buildBotView } from './view';

const CELL = { start: 'bootstrapper', difficulty: 'standard', background: 'none', entity: 'llc' } as const;

beforeAll(() => setEngineAutoFreeze(false));

describe('bot catalog (DESIGN §2.12.1)', () => {
  it('ships BOT_VERSION 1.0', () => {
    expect(BOT_VERSION).toBe('1.0');
  });

  it("registers exactly the bot ids of CLAUDE.md's simulator list, each with the phase it names", () => {
    const md = readFileSync(new URL('../../CLAUDE.md', import.meta.url), 'utf8');
    const line = md.split('\n').find((l) => l.startsWith('- Bot ids (§2.12.1):'));
    expect(line).toBeDefined();
    const expected: { id: string; phase: number }[] = [];
    // Groups read "`a`, `b` (P1); `c` (P2); …" plus "option bots `x` (P1), `y`, `z` (P3)".
    const body = (line as string).replace(/^.*?:/, '').split('. Every other bot')[0] as string;
    for (const group of body.split(/;|\),/)) {
      const phase = /\(P(\d)\)?/.exec(group)?.[1] ?? /P(\d)/.exec(group)?.[1];
      for (const m of group.matchAll(/`([A-Za-z0-9]+)(?:\([A-Za-z]+\))?`/g)) {
        expected.push({ id: m[1] as string, phase: phase === undefined ? 1 : Number(phase) });
      }
    }
    const registered = BOT_CATALOG.map((e) => e.id).sort();
    expect(registered).toEqual([...new Set(expected.map((e) => e.id))].sort());
    for (const e of expected) {
      // The brief's four bots carry no phase tag in that line ("Bootstrapper only" is a start note): they ship in P1.
      if (['cautious', 'balanced', 'aggressive', 'undercap'].includes(e.id)) continue;
      expect(botEntry(e.id)?.phase, e.id).toBe(e.phase);
    }
  });

  it('implements only passive in a P0 build, and passive arrives with P1', () => {
    expect(BOT_CATALOG.filter((e) => e.impl !== null).map((e) => e.id)).toEqual(['passive']);
    expect(botEntry('passive')?.phase).toBe(1);
    expect(botsActiveIn(0)).toEqual([]);
    expect(botsActiveIn(1).map((e) => e.id)).toContain('smallCrewNoForeman');
    expect(botsActiveIn(2).map((e) => e.id)).toContain('abandoner');
  });

  it('keeps undercap on the Bootstrapper', () => {
    expect(botEntry('undercap')?.starts).toEqual(['bootstrapper']);
  });

  it('parses bot specs, including brandOnly(<brandId>)', () => {
    expect(parseBotSpec('passive')).toEqual({ ok: true, spec: { id: 'passive', param: null } });
    expect(parseBotSpec('brandOnly(yellowIron)')).toEqual({ ok: true, spec: { id: 'brandOnly', param: 'yellowIron' } });
    expect(parseBotSpec('brandOnly:yellowIron')).toEqual({ ok: true, spec: { id: 'brandOnly', param: 'yellowIron' } });
    expect(parseBotSpec('brandOnly')).toEqual({ ok: false, error: { code: 'BOT_PARAM_REQUIRED', id: 'brandOnly' } });
    expect(parseBotSpec('passive(x)')).toEqual({ ok: false, error: { code: 'BOT_PARAM_UNEXPECTED', id: 'passive' } });
    expect(parseBotSpec('wizard')).toEqual({ ok: false, error: { code: 'BOT_UNKNOWN', id: 'wizard' } });
    expect(implementedBot({ id: 'cautious', param: null })).toBeNull();
  });
});

describe('shared decision answering (BALANCE §4.0)', () => {
  const decision = {
    id: 'dec_000001',
    kind: 'test',
    ownerSection: 2,
    blocking: true,
    createdTurn: 1,
    deadlineTurn: 3,
    options: [
      { id: 'zeta', labelKey: 'z', consequenceKey: 'z', action: { type: 'decision/answer' } },
      { id: 'alpha', labelKey: 'a', consequenceKey: 'a', action: { type: 'decision/answer' } },
    ],
    context: { templateKey: 't', params: {}, subject: [] },
  } as unknown as Parameters<typeof chosenOptionId>[0];

  it('takes the rule’s pick, else the default, else the lowest option id', () => {
    expect(chosenOptionId(decision, () => 'zeta')).toBe('zeta');
    expect(chosenOptionId({ ...decision, defaultOptionId: 'zeta' }, () => null)).toBe('zeta');
    expect(chosenOptionId({ ...decision, defaultOptionId: 'zeta' }, () => 'nope')).toBe('zeta');
    expect(chosenOptionId(decision, () => null)).toBe('alpha');
  });
});

/** A bot's decisions over a game, week by week, from a state and its scrambled twin (the game advances on the truth). */
function decisionTrace(bot: Bot, seed: string, years: number): { plain: Action[][]; scrambled: Action[][] } {
  let s: GameState = newGame(setupForCell(CELL), seed);
  const rules = simStopRules();
  let stops: StopReason[] = [];
  const plain: Action[][] = [];
  const scrambled: Action[][] = [];
  while (s.clock.turn < 52 * years - 1 && canAdvance(s) === null) {
    plain.push(bot.decide(s, buildBotView(s, stops)));
    const twin = scrambleHidden(s, `scramble-${seed}`);
    scrambled.push(bot.decide(twin, buildBotView(twin, stops)));
    const week = advanceWeek(s, { explain: false });
    stops = evaluateStops(s, week, rules, defaultRunAnchor(s));
    s = week.state;
  }
  return { plain, scrambled };
}

describe('every implemented catalog bot', () => {
  const implemented = BOT_CATALOG.filter((e) => e.impl !== null);

  for (const e of implemented) {
    // Through the harness itself (a two-process pool), so the counts are the ones `npm run sim` reports.
    it(`${e.id}: zero validator rejections over 20 seeds × 2 years`, async () => {
      const spec = cellRunSpec({
        cell: CELL,
        bot: { id: e.id, param: null },
        rulesPhase: 0,
        overrides: {},
        years: 2,
        seedBase: 5000,
        games: 20,
      });
      const pool = createPool(2);
      try {
        const { run, summary } = await playCell(pool, spec);
        expect(run.results).toHaveLength(20);
        for (const r of run.results) {
          expect(r.rejectedActions, `seed ${r.seed}`).toBe(0);
          expect(r.abortReason, `seed ${r.seed}`).toBeNull();
          expect(r.finalTurn).toBe(103);
        }
        expect(summary.metrics.rejectedActions).toBe(0);
        expect(summary.metrics.abortedGames).toBe(0);
      } finally {
        await pool.close();
      }
    }, 60_000);

    it(`${e.id}: identical decisions under scrambled hidden state (§2.14)`, () => {
      const bot = implementedBot({ id: e.id, param: null });
      if (bot === null) throw new Error(`${e.id} is not implemented`);
      for (const seed of ['7001', '7002']) {
        const { plain, scrambled } = decisionTrace(bot, seed, 1);
        expect(scrambled).toEqual(plain);
      }
    });
  }
});

describe('the scrambled-truth twin (DESIGN §2.12 Visibility, §3.1 hidden world truth)', () => {
  const s = newGame(setupForCell(CELL), '42');
  const twin = scrambleHidden(s, 'scramble-42');
  const w = s.world;
  const tw = twin.world;
  const each = <V>(rec: Readonly<Record<string, V>>): [string, V][] => Object.entries(rec);
  const at = <V>(rec: Readonly<Record<string, V>>, id: string): V => rec[id] as V;

  it('changes every hidden field of every claim, creek, district and holder', () => {
    expect(w.claimIds.length).toBeGreaterThan(50);
    for (const [id, c] of each(w.claims)) {
      const t = at(tw.claims, id);
      for (const f of ['depositType', 'oldTimerKind', 'oldTimerEra', 'truthPack', 'truthHash', 'econClass'] as const) {
        expect(t.hidden[f], `${id}.hidden.${f}`).not.toEqual(c.hidden[f]);
      }
      expect(t.hidden.trueHistory, `${id} trueHistory`).not.toEqual(c.hidden.trueHistory);
      expect(t.hidden.publicRecord, `${id} publicRecord`).not.toEqual(c.hidden.publicRecord);
      expect(t.hidden.permitStub.status, `${id} permitStub`).not.toBe(c.hidden.permitStub.status);
      expect(t.water.hidden.wellYieldGpm, `${id} well`).not.toBe(c.water.hidden.wellYieldGpm);
      expect(t.water.hidden.depthToWaterFt, `${id} depth`).not.toBe(c.water.hidden.depthToWaterFt);
    }
    for (const [id, c] of each(w.creeks)) {
      const h = at(tw.creeks, id).hidden;
      expect(h.goldBearing, id).toBe(!c.hidden.goldBearing);
      expect([h.gradeFactor, h.obFactor, h.payFactor], id).not.toEqual([
        c.hidden.gradeFactor,
        c.hidden.obFactor,
        c.hidden.payFactor,
      ]);
      expect(h.history, id).not.toEqual(c.hidden.history);
    }
    for (const [id, d] of each(w.districts)) {
      const h = at(tw.districts, id).hidden;
      expect(h.gradeFactor, id).not.toBe(d.hidden.gradeFactor);
      expect(h.obFactor, id).not.toBe(d.hidden.obFactor);
      expect(h.finenessMean, id).not.toBe(d.hidden.finenessMean);
    }
    expect(Object.keys(w.holders).length).toBeGreaterThan(10);
    for (const [id, h] of each(w.holders)) expect(at(tw.holders, id).honesty, id).not.toBe(h.honesty);
  });

  it('keeps the packed truth decodable: each claim takes another claim’s pack of the same block grid', () => {
    const grid = (c: { nAlong: number; nAcross: number }) => `${c.nAlong}x${c.nAcross}`;
    const packOwner: Record<string, string> = {};
    for (const [id, c] of each(w.claims)) packOwner[c.hidden.truthPack] = id;
    let sameGrid = 0;
    for (const [id, c] of each(tw.claims)) {
      const donor = packOwner[c.hidden.truthPack] as string;
      expect(donor, id).toBeDefined();
      expect(at(w.claims, donor).hidden.truthHash, id).toBe(c.hidden.truthHash);
      if (grid(at(w.claims, donor)) === grid(c)) sameGrid++;
    }
    expect(sameGrid).toBeGreaterThan(w.claimIds.length * 0.9);
  });

  it('changes nothing visible: with the hidden fields removed, state and twin are equal', () => {
    expect(withoutHidden(twin)).toEqual(withoutHidden(s));
    expect(JSON.stringify(withoutHidden(s))).not.toBe(JSON.stringify(s));
  });

  it('covers every `hidden` block in the state (a new one needs a scrambler)', () => {
    const left: string[] = [];
    const walk = (v: unknown, path: string): void => {
      if (typeof v !== 'object' || v === null) return;
      for (const [k, x] of Object.entries(v)) {
        if (k === 'hidden') left.push(`${path}.${k}`);
        walk(x, `${path}.${k}`);
      }
    };
    walk(withoutHidden(s), 'state');
    expect(left).toEqual([]);
  });

  it('is deterministic in its seed and leaves the input untouched', () => {
    const before = JSON.stringify(s);
    expect(scrambleHidden(s, 'scramble-42')).toEqual(twin);
    expect(scrambleHidden(s, 'other')).not.toEqual(twin);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('catches a bot that reads hidden truth (the decision-identity test can fail)', () => {
    // A deliberately leaky bot: it acts on the yardstick class of the first claim, a hidden field.
    const leaky: Bot = {
      id: 'passive',
      decide: (state) => {
        const first = state.world.claimIds[0] as string;
        const econ = (state.world.claims as Record<string, { hidden: { econClass: string } }>)[first]?.hidden.econClass;
        return [{ type: 'decision/answer', decisionId: 'dec_000001', optionId: String(econ) } as Action];
      },
    };
    const { plain, scrambled } = decisionTrace(leaky, '7001', 1);
    expect(scrambled).not.toEqual(plain);
    // The honest bot passes the same check on the same seed.
    const passive = implementedBot({ id: 'passive', param: null }) as Bot;
    const honest = decisionTrace(passive, '7001', 1);
    expect(honest.scrambled).toEqual(honest.plain);
  });
});
