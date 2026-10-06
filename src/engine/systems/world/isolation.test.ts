// Stream isolation of world generation (DESIGN §2.3 item 1, §2.14 "stream isolation", §3.1 generation order). A
// test-only spy wraps core rng(): it salts the seed of one 'world' sub-stream, which changes that step's draws without
// retuning anything, and it records every stream key a generation opens. Perturbing one step must leave every field
// the other steps own byte-identical, and no two generators may open the same stream key. Production code is untouched.
import { describe, expect, it, vi } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { canonicalJson } from '../../core/hash';
import type * as RngModule from '../../core/rng';
import type { KeyPart } from '../../core/rng';
import type { StreamName } from '../../core/streams';
import { generateWorld } from './generate';
import type { Claim, WorldSlice } from './types';

const spy = vi.hoisted(() => ({ salted: null as string | null, keys: null as string[] | null }));

vi.mock('../../core/rng', async (importOriginal) => {
  const mod = await importOriginal<typeof RngModule>();
  return {
    ...mod,
    rng: (seed: string, stream: StreamName, ...keys: KeyPart[]) => {
      spy.keys?.push(mod.encodeKey(seed, stream, keys));
      const perturbed = stream === 'world' && spy.salted !== null && keys[0] === spy.salted;
      return mod.rng(perturbed ? `${seed}#perturb` : seed, stream, ...keys);
    },
  };
});

const OPTS = { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] } as const;
const SEED = 'isolation-seed';

function world(salted: string | null): WorldSlice {
  spy.salted = salted;
  try {
    return generateWorld(SEED, OPTS, baseTuning);
  } finally {
    spy.salted = null;
  }
}

/** The world's fields, grouped by the generation step that owns them (§3.1). */
type Field =
  | 'truth'
  | 'status'
  | 'env'
  | 'waterPhysical'
  | 'waterRight'
  | 'priorDrill'
  | 'oldTimerRecord'
  | 'holderOf'
  | 'creekHistory'
  | 'holders'
  | 'heldBaseline';

function fields(w: WorldSlice): Record<Field, string> {
  const cs = w.claimIds.map((id) => w.claims[id] as Claim);
  return {
    truth: canonicalJson(cs.map((c) => [c.hidden.truthPack, c.hidden.truthHash])),
    status: canonicalJson(cs.map((c) => [c.status, c.titleKind, c.regime])),
    env: canonicalJson(cs.map((c) => c.env)),
    waterPhysical: canonicalJson(
      cs.map((c) => [c.water.sourceKind, c.water.baseGpm, c.water.benchLiftFt, c.water.nearestFillMi, c.water.hidden]),
    ),
    waterRight: canonicalJson(cs.map((c) => c.water.rightStub ?? null)),
    priorDrill: canonicalJson(cs.map((c) => c.hidden.publicRecord.priorDrill)),
    oldTimerRecord: canonicalJson(
      cs.map((c) => [
        c.hidden.oldTimerKind,
        c.hidden.oldTimerEra,
        c.hidden.trueHistory,
        c.hidden.permitStub,
        c.hidden.econClass,
        { ...c.hidden.publicRecord, priorDrill: null },
        c.visibleFeatures,
        c.visibleWorkings,
        c.improvementsUsd,
      ]),
    ),
    holderOf: canonicalJson(cs.map((c) => c.holderId)),
    creekHistory: canonicalJson(Object.values(w.creeks).map((c) => [c.id, c.hidden.history])),
    holders: canonicalJson(w.holders),
    heldBaseline: canonicalJson(w.districtIds.map((d) => w.districts[d]?.npcHeldBaseline)),
  };
}

/**
 * The steps (the first 'world' key part after the stream name) whose draws may change each field: its owner and the
 * steps upstream of it in §3.1's order. The old-timers step feeds nearly everything after it (decoded truth, the kind).
 */
const MAY_CHANGE: Record<Field, readonly string[]> = {
  truth: ['oldtimers'],
  status: ['status', 'oldtimers'],
  // Arid springs make the spring's block a wetland (§3.4.1); old workings set previouslyDisturbed.
  env: ['env', 'water', 'oldtimers'],
  waterPhysical: ['water'],
  waterRight: ['water', 'status', 'oldtimers'],
  priorDrill: ['drill', 'oldtimers'],
  oldTimerRecord: ['oldtimers'],
  holderOf: ['holders', 'status', 'oldtimers'],
  creekHistory: ['creekHist', 'oldtimers'],
  holders: ['holders', 'status', 'oldtimers'],
  heldBaseline: ['status', 'oldtimers'],
};

/** The field each perturbed step owns; it must change, or the perturbation proved nothing. */
const OWNS: Record<string, Field> = {
  oldtimers: 'truth',
  water: 'waterPhysical',
  status: 'status',
  env: 'env',
  drill: 'priorDrill',
  creekHist: 'creekHistory',
  holders: 'holders',
};

describe('world generation stream isolation (§2.3, §2.14)', () => {
  const base = fields(world(null));

  it.each(Object.keys(OWNS))(
    'perturbing the %s sub-stream changes only what it and its downstream steps own',
    (step) => {
      const perturbed = fields(world(step));
      expect(perturbed[OWNS[step] as Field]).not.toBe(base[OWNS[step] as Field]);
      for (const f of Object.keys(MAY_CHANGE) as Field[]) {
        if (MAY_CHANGE[f].includes(step)) continue;
        expect(perturbed[f], `${f} changed when '${step}' was perturbed`).toBe(base[f]);
      }
    },
  );

  it('opens every stream key once: no two generators share a stream', () => {
    spy.keys = [];
    try {
      generateWorld(SEED, OPTS, baseTuning);
      const keys = spy.keys;
      expect(keys.length).toBeGreaterThan(500);
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dupes).toEqual([]);
      // Every §3.1 step was seen, so the check covers them all.
      const steps = new Set(keys.map((k) => k.split('\u001f')[2]));
      for (const s of ['district', 'creeks', 'creek', 'layout', 'oldtimers', 'water', 'status', 'env', 'drill'])
        expect(steps.has(s)).toBe(true);
      for (const s of ['creekHist', 'holders', 'dst_000001', 'dst_000002']) expect(steps.has(s)).toBe(true);
    } finally {
      spy.keys = null;
    }
  });
});
