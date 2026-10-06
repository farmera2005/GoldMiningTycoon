// §3 world generation entry point (DESIGN §3.1, §3.14 Provides). newGame (src/engine/state) calls generateWorld; the
// signature is the contract. Everything is generated here, once: claims never spawn later (D-3.1) and true geology is
// immutable afterwards. Each step draws on its own 'world' sub-stream (§3.1 generation order), so adding draws to one
// step never changes another.
import type { TuningResolved } from '../../../data/tuning';
import { townServicesByTier } from '../../../data/regions';
import {
  compareIds,
  formatId,
  type BlockId,
  type ClaimId,
  type CreekId,
  type DistrictId,
  type HolderId,
  type IdPrefix,
} from '../../core/ids';
import { usdToCents, type Cents } from '../../core/money';
import { recordSize } from '../../core/iter';
import { rng } from '../../core/rng';
import { claimAccessClass } from './access';
import { BCY_PER_ACRE_FT, BLOCK_FT } from './constants';
import { VISIBLE_FEATURES } from './enums';
import { adjacentClaims, assignStatus, genEnv, historicAcresOf } from './env';
import type { GenClaim, GenCreek, GenDistrict } from './genTypes';
import { assignHolders } from './holders';
import { claimPlacement, layParcels, isProximal, sizeSettingOf } from './layout';
import { genCreekNetwork, genDistrict, round, ROW_MI } from './network';
import { applyOldTimers, type OldTimerResult } from './oldTimers';
import { decodeClaimTruth, packTruth, truthHashOf, unpackTruth } from './pack';
import { snapshotGenParams, templateOf } from './params';
import { listingSettingOf } from './priors';
import { genCreekProfile } from './profile';
import { genCreekHistory, genPriorDrill } from './records';
import { refEconomics } from './refEconomics';
import { fromBlockTruth, genClaimTruth, toBlockTruth, type ClaimTruthGen, type WorkBlock } from './truth';
import { genWater } from './water';
import type {
  BlockState,
  BlockTruth,
  Claim,
  ClaimEnv,
  ClaimTruth,
  ClaimWater,
  Creek,
  District,
  GeoGenParams,
  LandOverlay,
  PublicRecord,
  RegionTemplateId,
  SellerProfile,
  VisibleFeature,
  WorldSlice,
} from './types';

export interface WorldGenOptions {
  /** Number of districts; P0/P1 worlds use 2 (northernFederal + aridFederal). */
  readonly districtCount: number;
  /** Region template ids, one per district, in district order (§1 setup.world.districtTemplates). */
  readonly templateIds: readonly string[];
  /** Optional cap per district (§3 3.1). */
  readonly parcelsPerDistrict?: number;
}

interface Counters {
  dst: number;
  crk: number;
  clm: number;
  blk: number;
  hld: number;
}

/** decode(pack(T)) is canonical (D-3.1): round-trip freshly generated truth so later steps see stored values. */
function canonicalize(gen: ClaimTruthGen): { coarseMeanMg: number; blocks: WorkBlock[] } {
  const bts = gen.blocks.map((b) => toBlockTruth(b, gen.coarseMeanMg));
  const dec = unpackTruth(packTruth(bts, gen.coarseMeanMg));
  return {
    coarseMeanMg: dec.coarseMeanMg,
    blocks: dec.blocks.map((bt, idx) => {
      const w = gen.blocks[idx] as WorkBlock;
      return fromBlockTruth(bt, w.i, w.j, w.gStreak);
    }),
  };
}

/** payBcy of decoded truth, written once so block states and the yardstick compute it identically. */
function payBcyOfTruth(bt: BlockTruth): number {
  return (bt.payThicknessFt + bt.bedrockCleanupFt) * BCY_PER_ACRE_FT;
}

interface Built {
  readonly K: GenClaim;
  readonly creek: GenCreek;
  readonly name: string;
  readonly truthPack: string;
  readonly truth: ClaimTruth;
  readonly ot: OldTimerResult;
  readonly water: ClaimWater;
  readonly status: Claim['status'];
  readonly titleKind: Claim['titleKind'];
  readonly regime: Claim['regime'];
  readonly env: Omit<ClaimEnv, 'adjacentClaimIds'>;
  readonly states: readonly { idx: number; state: BlockState }[];
  readonly priorDrill: PublicRecord['priorDrill'];
  readonly econClass: Claim['hidden']['econClass'];
  readonly access: Claim['access'];
  readonly trailMi: number;
  readonly distanceToTownMi: number;
  readonly visibleFeatures: VisibleFeature[];
  readonly visibleWorkings: number[];
  readonly bondPostedCents: Cents | null;
  readonly inheritedAcres: number;
}

/** Pre-game Block.state of recent-operator workings (§3.6): mined blocks and pre-stripped paystreak blocks. */
function preGameStates(ot: OldTimerResult, truth: ClaimTruth, gp: GeoGenParams): { idx: number; state: BlockState }[] {
  const out: { idx: number; state: BlockState }[] = [];
  const origin = (year: number): BlockState['disturbanceOrigin'] =>
    year >= gp.oldTimer.liabilityEraYear ? 'inherited' : 'historic';
  for (const m of ot.mined) {
    const bt = truth.blocks[m.idx] as BlockTruth;
    out.push({
      idx: m.idx,
      state: {
        strippedBcy: bt.overburdenFt * BCY_PER_ACRE_FT,
        minedBcy: payBcyOfTruth(bt),
        sampledBcy: 0,
        oldTailingsTakenBcy: 0,
        disturbed: true,
        disturbanceOrigin: origin(m.year),
        reclaimed: m.reclaimed,
        thawProgress: 0,
      },
    });
  }
  for (const p of ot.preStripped) {
    const bt = truth.blocks[p.idx] as BlockTruth;
    out.push({
      idx: p.idx,
      state: {
        strippedBcy: bt.overburdenFt * BCY_PER_ACRE_FT,
        minedBcy: 0,
        sampledBcy: 0,
        oldTailingsTakenBcy: 0,
        disturbed: true,
        disturbanceOrigin: origin(p.year),
        reclaimed: false,
        thawProgress: round(p.thawFt, 2),
      },
    });
  }
  return out.sort((a, b) => a.idx - b.idx);
}

/** Aerial-visible features (§3.9): dredge tailings, piles, recent disturbance and ponds, pre-stripped, improvements. */
function visibleOf(ot: OldTimerResult, truth: ClaimTruth): { features: VisibleFeature[]; workings: number[] } {
  const f: VisibleFeature[] = [];
  const w: number[] = [];
  const add = (x: VisibleFeature): void => {
    if (!f.includes(x)) f.push(x);
  };
  if (ot.kind === 'dredge') {
    add('dredgeTailings');
    truth.blocks.forEach((b, i) => {
      if (b.minedOutFraction > 0) w.push(i);
    });
  }
  // Drift dumps are overgrown and invisible from the air (D-3.45); other piles show.
  if (ot.kind === 'handCut' || ot.kind === 'dryWash' || ot.kind === 'hydraulic' || ot.kind === 'recentCat') {
    truth.blocks.forEach((b, i) => {
      if (b.oldTailings !== undefined) {
        add('tailingsPiles');
        w.push(i);
      }
    });
  }
  if (ot.mined.length > 0) {
    add('recentDisturbance');
    add('ponds');
    for (const m of ot.mined) w.push(m.idx);
  }
  if (ot.preStripped.length > 0) {
    add('preStripped');
    for (const p of ot.preStripped) w.push(p.idx);
  }
  if (ot.improvementsUsd > 0) add('improvements');
  const features = VISIBLE_FEATURES.filter((x) => f.includes(x));
  const workings = w.filter((x, k) => w.indexOf(x) === k).sort((a, b) => a - b);
  return { features, workings };
}

/**
 * Claim names along each creek (no draws): "Mosquito Creek Discovery", "No. 2 Above Discovery", benches by side.
 */
function claimNames(claims: readonly GenClaim[], creeks: readonly GenCreek[]): Record<ClaimId, string> {
  const out = {} as Record<ClaimId, string>;
  for (const c of creeks) {
    const valley = claims.filter((k) => k.creekIdx === c.idx && k.side === 0).sort((a, b) => a.rowStart - b.rowStart);
    const disc = Math.floor(valley.length / 2);
    valley.forEach((k, n) => {
      out[k.id] =
        n === disc
          ? `${c.name} Discovery`
          : n > disc
            ? `${c.name} No. ${n - disc} Above Discovery`
            : `${c.name} No. ${disc - n} Below Discovery`;
    });
    for (const side of [-1, 1] as const) {
      const bench = claims
        .filter((k) => k.creekIdx === c.idx && k.side === side)
        .sort((a, b) => a.rowStart - b.rowStart);
      bench.forEach((k, n) => {
        out[k.id] = `${c.name} ${side < 0 ? 'Left' : 'Right'} Bench No. ${n + 1}`;
      });
    }
  }
  return out;
}

function priorPermitsOf(ot: OldTimerResult): string[] {
  if (ot.lastSeason === null) return [];
  switch (ot.permitStatus) {
    case 'planApproved':
      return [`Plan of operations (${ot.lastSeason})`];
    case 'noticeOnFile':
      return [`Notice-level operation (${ot.lastSeason})`];
    case 'none':
      return [];
  }
}

function buildClaim(
  seed: string,
  K: GenClaim,
  d: GenDistrict,
  creek: GenCreek,
  profile: ReturnType<typeof genCreekProfile>,
  overlays: readonly LandOverlay[],
  name: string,
  gp: GeoGenParams,
): Built {
  const tpl = d.tpl;
  const gen = genClaimTruth(rng(seed, 'world', d.id, K.id), K, d, creek, profile, gp);
  const canon = canonicalize(gen);
  const ot = applyOldTimers(rng(seed, 'world', 'oldtimers', K.id), K, canon.blocks, tpl, gp);

  // Access (§3.3.3): trail distance along the network from the outlet to the claim's middle.
  const channelMi = creek.mouthMiFromOutlet + (K.rowStart + K.nAlong / 2) * ROW_MI;
  const trailMi = round(channelMi * gp.world.trailTortuosity, 3);
  const distanceToTownMi = round(d.townRoadMi + trailMi, 3);
  const access = claimAccessClass(
    d.roadClass,
    trailMi,
    creek.noTrail,
    tpl.valley.kind === 'wash',
    gp,
    tpl.trailDegradeMi ?? [gp.access.trailDegrade1Mi, gp.access.trailDegrade2Mi],
  );

  const water = genWater(rng(seed, 'world', 'water', K.id), K, d, creek, ot.kind, distanceToTownMi, gp);
  const pack = packTruth(
    canon.blocks.map((b) => toBlockTruth(b, canon.coarseMeanMg)),
    canon.coarseMeanMg,
  );
  const hash = truthHashOf(pack);
  const truth = decodeClaimTruth(K.id, pack, hash);
  const states = preGameStates(ot, truth, gp);

  const psGStreaks: number[] = [];
  truth.blocks.forEach((b, i) => {
    if (b.paystreakFraction >= gp.grade.pocketStreakMinF) psGStreaks.push((canon.blocks[i] as WorkBlock).gStreak);
  });
  const st = assignStatus(rng(seed, 'world', 'status', K.id), K, d, creek.id, overlays, ot.kind, psGStreaks, gp);
  // No recorded water right on unclaimed ground (§3.4).
  const waterFinal: ClaimWater =
    st.status === 'heldNpc' || water.rightStub === undefined
      ? water
      : {
          sourceKind: water.sourceKind,
          baseGpm: water.baseGpm,
          benchLiftFt: water.benchLiftFt,
          nearestFillMi: water.nearestFillMi,
          hidden: water.hidden,
        };
  const env = genEnv(
    rng(seed, 'world', 'env', K.id),
    K,
    creek,
    d,
    overlays,
    historicAcresOf(ot.kind, truth.blocks),
    water.sourceKind,
    states.length > 0,
    gp,
  );
  const priorDrill = genPriorDrill(rng(seed, 'world', 'drill', K.id), K, truth, env.surfaceCodes, tpl.climateBand, gp);
  const stateAt: (BlockState | undefined)[] = [];
  for (const s of states) stateAt[s.idx] = s.state;
  const econ = refEconomics(truth, (idx) => stateAt[idx], tpl.climateBand, gp.refEcon);
  const vis = visibleOf(ot, truth);
  const inheritedOpen = states.filter((s) => s.state.disturbanceOrigin === 'inherited' && !s.state.reclaimed).length;
  const bondPostedCents =
    ot.permitStatus === 'none' ? null : usdToCents(ot.bondFrac * gp.permitStub.rceStubUsdPerAcre * inheritedOpen);
  return {
    K,
    creek,
    name,
    truthPack: pack,
    truth,
    ot,
    water: waterFinal,
    status: st.status,
    titleKind: st.titleKind,
    regime: st.regime,
    env,
    states,
    priorDrill,
    econClass: econ.econClass,
    access,
    trailMi,
    distanceToTownMi,
    visibleFeatures: vis.features,
    visibleWorkings: vis.workings,
    bondPostedCents,
    inheritedAcres: states.filter((s) => s.state.disturbanceOrigin === 'inherited').length,
  };
}

function claimRecord(b: Built, d: GenDistrict, adjacent: readonly ClaimId[], holderId: HolderId | null): Claim {
  const K = b.K;
  const ot = b.ot;
  const workedForRecord =
    ot.kind === 'recentCat'
      ? ot.mined.map((m) => m.idx).sort((x, y) => x - y)
      : b.truth.blocks.flatMap((bt, i) => (bt.minedOutFraction > 0 ? [i] : []));
  const publicRecord: PublicRecord = {
    oldTimer:
      ot.footprintOnRecord && ot.era !== null ? { kind: ot.kind, era: ot.era, workedBlockIdxs: workedForRecord } : null,
    filedSeasons: ot.filedSeasons,
    priorPermits: priorPermitsOf(ot),
    inheritedAcres: b.inheritedAcres,
    lapses: [],
    priorDrill: b.priorDrill,
  };
  return {
    id: K.id,
    districtId: d.id,
    creekId: b.creek.id,
    name: b.name,
    acres: K.acres,
    nAlong: K.nAlong,
    nAcross: K.nAcross,
    blockIdBase: K.blockIdBase,
    geometry: {
      rowStart: K.rowStart,
      axisOffsetFt: K.axisOffsetFt,
      centerMi: K.centerMi,
      headingDeg: K.headingDeg,
      lengthFt: K.nAlong * BLOCK_FT,
      widthFt: K.nAcross * BLOCK_FT,
    },
    setting: listingSettingOf(K.depositType),
    sizeSetting: K.sizeSetting,
    titleKind: b.titleKind,
    regime: b.regime,
    status: b.status,
    holderId,
    access: b.access,
    trailMi: b.trailMi,
    distanceToTownMi: b.distanceToTownMi,
    visibleFeatures: b.visibleFeatures,
    visibleWorkings: b.visibleWorkings,
    improvementsUsd: ot.improvementsUsd,
    env: { ...b.env, adjacentClaimIds: adjacent },
    water: b.water,
    hidden: {
      depositType: K.depositType,
      oldTimerKind: ot.kind,
      oldTimerEra: ot.era,
      truthPack: b.truthPack,
      truthHash: b.truth.truthHash,
      trueHistory: ot.history,
      publicRecord,
      permitStub: { status: ot.permitStatus, bondPostedCents: b.bondPostedCents },
      econClass: b.econClass,
    },
    listingSeq: 0,
    cooldownUntilTurn: null,
  };
}

export function generateWorld(seed: string, opts: WorldGenOptions, tuning: TuningResolved): WorldSlice {
  if (!Number.isSafeInteger(opts.districtCount) || opts.districtCount < 1) {
    throw new RangeError(`generateWorld: districtCount must be a positive integer, got ${opts.districtCount}`);
  }
  if (opts.templateIds.length !== opts.districtCount) {
    throw new RangeError('generateWorld: templateIds must name one template per district');
  }
  const gp = snapshotGenParams(tuning, opts.templateIds);
  const n: Counters = { dst: 0, crk: 0, clm: 0, blk: 0, hld: 0 };
  const districts = {} as Record<DistrictId, District>;
  const creeks = {} as Record<CreekId, Creek>;
  const claims = {} as Record<ClaimId, Claim>;
  const blockStates = {} as Record<BlockId, BlockState>;
  const holders = {} as Record<HolderId, SellerProfile>;
  const familyRun: ClaimId[] = [];
  const usedDistrictNames: string[] = [];
  const familyDistrict = opts.templateIds.indexOf('northernFederal');

  for (let di = 0; di < opts.districtCount; di++) {
    const tpl = templateOf(gp, opts.templateIds[di] as RegionTemplateId);
    const dId = formatId('dst', ++n.dst);
    const D = genDistrict(rng(seed, 'world', 'district', di), tpl, gp, {
      id: dId,
      index: di,
      districtCount: opts.districtCount,
      parcelsCap: opts.parcelsPerDistrict,
      usedDistrictNames,
      reserveFamilyRun: di === familyDistrict,
    });
    usedDistrictNames.push(D.name);
    const net = genCreekNetwork(rng(seed, 'world', 'creeks', D.id), D, gp, () => formatId('crk', ++n.crk));
    const profiles = net.creeks.map((c) => genCreekProfile(rng(seed, 'world', 'creek', c.id), c, D, net.creeks, gp));
    const parcels = layParcels(rng(seed, 'world', 'layout', D.id), D, net, gp);
    const gclaims: GenClaim[] = parcels.map((p) => {
      const c = net.creeks[p.creekIdx] as GenCreek;
      const id = formatId('clm', ++n.clm);
      const blockIdBase = n.blk + 1;
      n.blk += p.nAlong * p.nAcross;
      const place = claimPlacement(p, c, gp);
      return {
        ...p,
        id,
        blockIdBase,
        sizeSetting: sizeSettingOf(p, c, D, gp),
        proximal: isProximal(p, c, gp),
        northness: place.northness,
        centerMi: place.centerMi,
        headingDeg: place.headingDeg,
        midRow: Math.min(c.rows - 1, p.rowStart + Math.floor(p.nAlong / 2)),
      };
    });
    const names = claimNames(gclaims, net.creeks);
    const built = gclaims.map((K) =>
      buildClaim(
        seed,
        K,
        D,
        net.creeks[K.creekIdx] as GenCreek,
        profiles[K.creekIdx] as ReturnType<typeof genCreekProfile>,
        net.overlays,
        names[K.id] as string,
        gp,
      ),
    );
    const adjacency = adjacentClaims(gclaims);

    // Creek histories after every claim of the district (D-3.39).
    const histories = net.creeks.map((c) =>
      genCreekHistory(
        rng(seed, 'world', 'creekHist', c.id),
        c,
        D,
        built.filter((b) => b.K.creekIdx === c.idx).map((b) => ({ kind: b.ot.kind, era: b.ot.era, truth: b.truth })),
        gp,
      ),
    );

    // Holders of NPC-held parcels (§3.10).
    const held = built.filter((b) => b.status === 'heldNpc').map((b) => b.K);
    const hs = assignHolders(rng(seed, 'world', 'holders', D.id), held, gp, () => formatId('hld', ++n.hld));
    const holderOf = {} as Record<ClaimId, HolderId>;
    for (const h of hs) {
      holders[h.id] = h;
      for (const cid of h.claimIds) holderOf[cid] = h.id;
    }

    for (const b of built) {
      claims[b.K.id] = claimRecord(b, D, (adjacency[b.K.id] ?? []).slice().sort(compareIds), holderOf[b.K.id] ?? null);
      for (const s of b.states) blockStates[formatId('blk', b.K.blockIdBase + s.idx)] = s.state;
      if (b.K.familyRun) familyRun.push(b.K.id);
    }

    net.creeks.forEach((c, i) => {
      creeks[c.id] = {
        id: c.id,
        districtId: D.id,
        name: c.name,
        order: c.order,
        parentId: c.parentIdx === null ? null : (net.creeks[c.parentIdx] as GenCreek).id,
        junctionRow: c.junctionRow,
        polylineMi: c.points,
        lengthMi: c.lengthMi,
        rows: c.rows,
        valleyHalfWidthFt: c.halfWidthFt,
        upstreamMiAtRow: c.upstreamMiAtRow,
        mouthMiFromOutlet: c.mouthMiFromOutlet,
        noTrail: c.noTrail,
        fishBearing: c.fishBearing,
        anadromous: c.anadromous,
        hidden: {
          goldBearing: c.goldBearing,
          gradeFactor: c.gradeFactor,
          obFactor: (profiles[i] as ReturnType<typeof genCreekProfile>).obFactor,
          payFactor: (profiles[i] as ReturnType<typeof genCreekProfile>).payFactor,
          history: histories[i] ?? null,
        },
      };
    });

    const district: District = {
      id: D.id,
      name: D.name,
      templateId: tpl.id,
      regime: tpl.regime,
      climateTemplateId: tpl.climateTemplateId,
      fireRestrictionRegime: tpl.fireRestrictionRegime,
      stateOverlayId: tpl.stateOverlayId,
      jurisdictionId: tpl.jurisdictionId,
      wageRegion: tpl.wageRegion,
      recordsQuality: tpl.recordsQuality,
      mapMi: { w: gp.world.mapMi[0], h: gp.world.mapMi[1] },
      outletMi: D.outlet,
      roadClass: D.roadClass,
      roadWinterMaintained: D.roadWinterMaintained,
      town: {
        name: D.townName,
        tier: D.townTier,
        positionMi: D.townPos,
        roadMiFromOutlet: D.townRoadMi,
        services: townServicesByTier[D.townTier],
      },
      hub: { name: D.hubName, roadMiFromTown: D.hubRoadMi },
      ...(tpl.aquifer !== undefined ? { aquifer: tpl.aquifer } : {}),
      overlays: net.overlays,
      npcHeldBaseline: built.filter((b) => b.status === 'heldNpc').length,
      hidden: { gradeFactor: D.gradeFactor, obFactor: D.obFactor, finenessMean: D.finenessMean },
      creekIds: net.creeks.map((c) => c.id),
      claimIds: gclaims.map((k) => k.id),
    };
    districts[D.id] = district;
  }

  return {
    genParams: gp,
    districts,
    districtIds: Array.from({ length: n.dst }, (_, i) => formatId('dst', i + 1)),
    creeks,
    claims,
    claimIds: Array.from({ length: n.clm }, (_, i) => formatId('clm', i + 1)),
    blockStates,
    holders,
    siteVisits: {},
    watch: { districtIds: [], claimIds: [] },
    supplyQueue: [],
    familyRunClaimIds: familyRun,
    foundTells: {},
  };
}

/** The id prefixes §3's generator mints (§2.4 registry). */
export type WorldIdPrefix = Extract<IdPrefix, 'dst' | 'crk' | 'clm' | 'blk' | 'hld'>;

/**
 * The id counters a freshly generated world has used (prefixes dst, crk, clm, blk, hld; ids start at 1 and are
 * contiguous). Blocks are numbered implicitly (blockIdBase + idx), so only this count, not a scan of the slice's id
 * strings, covers every block id. newGame merges these into state.ids so later ids continue after the world's (D-2.38).
 */
export function worldIdCounters(world: WorldSlice): Record<WorldIdPrefix, number> {
  let blocks = 0;
  for (const id of world.claimIds) {
    const c = world.claims[id];
    if (c !== undefined) blocks = Math.max(blocks, c.blockIdBase - 1 + c.nAlong * c.nAcross);
  }
  let creeks = 0;
  for (const id of world.districtIds) {
    const d = world.districts[id];
    if (d !== undefined) creeks += d.creekIds.length;
  }
  return {
    dst: world.districtIds.length,
    crk: creeks,
    clm: world.claimIds.length,
    blk: blocks,
    hld: recordSize(world.holders),
  };
}
