// §3's scrambler (DESIGN §3.1, §3.9, §3.10; §2.14 "Bots", D-2.58): the hidden world truth of a P0/P1 state. Every
// claim's `hidden` block (deposit type, old-timer kind and era, the packed block truth and its hash, true history, the
// public record until a records review reveals it, the permit stub, the yardstick class) and its `water.hidden` (well
// yield, depth to water), every creek's and district's `hidden` factors, and every holder's honesty and evidence.
// `scrambleWorldTruth` rewrites each of them to a different value and touches nothing else; packed truth is swapped
// between claims of the same block grid so the twin stays decodable.
import { compareIds, type GameState } from '../../../src/engine';
import { unit, type HiddenScrambler, type ScramblerDef, type StateJson } from './types';

type World = GameState['world'];
type Claim = World['claims'][keyof World['claims']];
type Creek = World['creeks'][keyof World['creeks']];
type District = World['districts'][keyof World['districts']];
type Holder = World['holders'][keyof World['holders']];
type ClaimHidden = Claim['hidden'];

/** A different member of `values` than `current` (a seeded non-zero rotation). */
function otherOf<T>(values: readonly T[], current: T, u: number): T {
  const i = Math.max(0, values.indexOf(current));
  const step = 1 + Math.floor(u * (values.length - 1));
  return values[(i + step) % values.length] as T;
}

/** A different non-negative number: x scaled up by 1.5–2.5 plus a positive offset. */
function otherNumber(x: number, u: number, offset = 1): number {
  return x * (1.5 + u) + offset;
}

// The enum values the twin rotates through (checked against the engine's types; a later value may be missing here).
const DEPOSIT_TYPES = [
  'creek',
  'bench',
  'deepMuck',
  'dredgedGround',
  'desertFan',
  'gulch',
] as const satisfies readonly ClaimHidden['depositType'][];
const OLD_TIMER_KINDS = [
  'none',
  'handCut',
  'drift',
  'dredge',
  'dryWash',
  'hydraulic',
  'recentCat',
] as const satisfies readonly ClaimHidden['oldTimerKind'][];
const ECON_CLASSES = [
  'uneconomic',
  'marginal',
  'good',
  'excellent',
] as const satisfies readonly ClaimHidden['econClass'][];
const PERMIT_STUBS = [
  'none',
  'noticeOnFile',
  'planApproved',
] as const satisfies readonly ClaimHidden['permitStub']['status'][];
const HONESTIES = [
  'accurate',
  'optimistic',
  'cherryPicked',
  'fraudulent',
] as const satisfies readonly Holder['honesty'][];

// --------------------------------------------------------------------------------------------- §3 world

/**
 * Each claim's packed truth (and its hash) comes from another claim of the same block grid, so the twin stays
 * decodable; a claim whose grid no other claim shares takes another claim's pack (a seeded rotation over all claims).
 */
function truthDonors(world: World, seed: string): Record<string, string> {
  const ids = [...world.claimIds].sort(compareIds) as string[];
  const byId: Record<string, Claim> = Object.fromEntries(Object.entries(world.claims));
  const claim = (id: string) => byId[id] as Claim;
  const groups: Record<string, string[]> = {};
  for (const id of ids) (groups[`${claim(id).nAlong}x${claim(id).nAcross}`] ??= []).push(id);
  const donor: Record<string, string> = {};
  for (const grid of Object.keys(groups).sort()) {
    const g = groups[grid] as string[];
    const pool = g.length > 1 ? g : ids;
    const shift = 1 + Math.floor(unit(seed, 'truthShift', grid) * (pool.length - 1));
    for (const id of g) donor[id] = pool[(pool.indexOf(id) + shift) % pool.length] as string;
  }
  return donor;
}

function scrambledClaimHidden(c: Claim, donor: Claim, seed: string): ClaimHidden {
  const h = c.hidden;
  const u = (field: string) => unit(seed, 'claim', c.id, field);
  const shift = 1 + Math.floor(u('era') * 20);
  const record = h.publicRecord;
  return {
    ...h,
    depositType: otherOf(DEPOSIT_TYPES, h.depositType, u('depositType')),
    oldTimerKind: otherOf(OLD_TIMER_KINDS, h.oldTimerKind, u('oldTimerKind')),
    oldTimerEra:
      h.oldTimerEra === null ? [1890 + shift, 1910 + shift] : [h.oldTimerEra[0] - shift, h.oldTimerEra[1] + shift],
    truthPack: donor.hidden.truthPack,
    truthHash: donor.hidden.truthHash,
    trueHistory:
      h.trueHistory.length === 0
        ? [{ year: 1990 + shift, bcy: 5_000 + 100 * shift, rawOz: 40 + shift, blockIdxs: [0] }]
        : h.trueHistory.map((s, i) => ({ ...s, rawOz: otherNumber(s.rawOz, unit(seed, 'claim', c.id, 'season', i)) })),
    publicRecord: {
      ...record,
      inheritedAcres: record.inheritedAcres + shift,
      filedSeasons: record.filedSeasons.map((s, i) => ({
        ...s,
        rawOz: otherNumber(s.rawOz, unit(seed, 'claim', c.id, 'filed', i)),
      })),
    },
    permitStub: {
      status: otherOf(PERMIT_STUBS, h.permitStub.status, u('permitStub')),
      bondPostedCents: (h.permitStub.bondPostedCents === null
        ? 100_000 * shift
        : h.permitStub.bondPostedCents + 100 * shift) as ClaimHidden['permitStub']['bondPostedCents'],
    },
    econClass: otherOf(ECON_CLASSES, h.econClass, u('econClass')),
  };
}

function scrambledClaim(c: Claim, donor: Claim, seed: string): Claim {
  const u = (field: string) => unit(seed, 'water', c.id, field);
  return {
    ...c,
    water: {
      ...c.water,
      hidden: {
        wellYieldGpm: otherNumber(c.water.hidden.wellYieldGpm, u('well'), 7),
        depthToWaterFt: otherNumber(c.water.hidden.depthToWaterFt, u('depth'), 3),
      },
    },
    hidden: scrambledClaimHidden(c, donor, seed),
  };
}

function scrambledCreek(c: Creek, seed: string): Creek {
  const u = (field: string) => unit(seed, 'creek', c.id, field);
  const h = c.hidden;
  return {
    ...c,
    hidden: {
      goldBearing: !h.goldBearing,
      gradeFactor: otherNumber(h.gradeFactor, u('grade'), 0.1),
      obFactor: otherNumber(h.obFactor, u('ob'), 0.1),
      payFactor: otherNumber(h.payFactor, u('pay'), 0.1),
      history:
        h.history === null
          ? { histOz: 500 + Math.floor(u('hist') * 500), histBcy: 50_000, era: [1900, 1920] }
          : { ...h.history, histOz: otherNumber(h.history.histOz, u('hist')) },
    },
  };
}

function scrambledDistrict(d: District, seed: string): District {
  const u = (field: string) => unit(seed, 'district', d.id, field);
  const h = d.hidden;
  return {
    ...d,
    hidden: {
      gradeFactor: otherNumber(h.gradeFactor, u('grade'), 0.1),
      obFactor: otherNumber(h.obFactor, u('ob'), 0.1),
      // Alloy fineness stays plausible (0.72–0.92) and moves to the other side of 0.8.
      finenessMean: (h.finenessMean > 0.8 ? 0.72 : 0.87) + 0.05 * u('fineness'),
    },
  };
}

function scrambledHolder(h: Holder, seed: string): Holder {
  const evidence: Record<string, Holder['evidence'][keyof Holder['evidence']]> = {};
  for (const [claimId, e] of entriesById(h.evidence)) {
    evidence[claimId] = {
      ...e,
      kMult: otherNumber(e.kMult, unit(seed, 'holder', h.id, claimId, 'k')),
      beliefRawOz: otherNumber(e.beliefRawOz, unit(seed, 'holder', h.id, claimId, 'belief')),
      permitStatementTrue: !e.permitStatementTrue,
    };
  }
  return {
    ...h,
    honesty: otherOf(HONESTIES, h.honesty, unit(seed, 'holder', h.id, 'honesty')),
    evidence: evidence as Holder['evidence'],
  };
}

/** A Record's entries in id order (the sim's iteration never depends on insertion order). */
function entriesById<V>(rec: Readonly<Record<string, V>>): [string, V][] {
  return Object.entries(rec).sort(([a], [b]) => compareIds(a, b));
}

/** §3's hidden world truth, every field rewritten to a different value. */
export const scrambleWorldTruth: HiddenScrambler = (state, seed) => {
  const w = state.world;
  const donors = truthDonors(w, seed);
  const byId: Record<string, Claim> = Object.fromEntries(entriesById<Claim>(w.claims));
  const claims: Record<string, Claim> = {};
  for (const [id, c] of entriesById<Claim>(w.claims)) claims[id] = scrambledClaim(c, byId[donors[id] ?? id] ?? c, seed);
  const creeks: Record<string, Creek> = {};
  for (const [id, c] of entriesById<Creek>(w.creeks)) creeks[id] = scrambledCreek(c, seed);
  const districts: Record<string, District> = {};
  for (const [id, d] of entriesById<District>(w.districts)) districts[id] = scrambledDistrict(d, seed);
  const holders: Record<string, Holder> = {};
  for (const [id, h] of entriesById<Holder>(w.holders)) holders[id] = scrambledHolder(h, seed);
  return {
    ...state,
    world: {
      ...w,
      claims: claims as World['claims'],
      creeks: creeks as World['creeks'],
      districts: districts as World['districts'],
      holders: holders as World['holders'],
    },
  };
};

/** Deletes §3's hidden fields from a JSON copy of the state. */
function stripWorldTruth(json: StateJson): void {
  const world = json['world'] as Record<string, Record<string, Record<string, unknown>>>;
  const strip = (rec: Record<string, Record<string, unknown>> | undefined, fields: readonly string[]) => {
    for (const id of Object.keys(rec ?? {})) for (const f of fields) delete rec?.[id]?.[f];
  };
  strip(world['claims'], ['hidden']);
  for (const c of Object.values(world['claims'] ?? {})) delete (c['water'] as Record<string, unknown>)['hidden'];
  strip(world['creeks'], ['hidden']);
  strip(world['districts'], ['hidden']);
  strip(world['holders'], ['honesty', 'evidence']);
}

export const s03: ScramblerDef = {
  id: 's03',
  section: 3,
  covers: [
    'claim.hidden (deposit type, old-timer kind and era, packed truth and hash, true history, public record, permit stub, yardstick class)',
    'claim.water.hidden (well yield, depth to water)',
    'creek.hidden and district.hidden factors',
    'holder honesty and evidence',
  ],
  scramble: scrambleWorldTruth,
  strip: stripWorldTruth,
};
