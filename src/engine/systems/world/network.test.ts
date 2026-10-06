// genCreekNetwork's fixed draw order (DESIGN §3.3.1, §2.3 stream rule e): retuning the branch probability or the
// tributary count moves no later draw, so the main stem, its overlays and every creek that exists in both networks keep
// their attributes and names.
import { describe, expect, it } from 'vitest';
import { baseTuning, type TuningResolved } from '../../../data/tuning';
import { formatId } from '../../core/ids';
import { rng } from '../../core/rng';
import type { GenCreek, GenNetwork } from './genTypes';
import { genCreekNetwork, genDistrict } from './network';
import { snapshotGenParams, templateOf } from './params';
import type { RegionTemplateId } from './types';

interface NetRun {
  readonly net: GenNetwork;
  readonly draws: number;
}

function network(seed: string, templateId: RegionTemplateId, overrides: Partial<TuningResolved> = {}): NetRun {
  const gp = snapshotGenParams({ ...baseTuning, ...overrides } as TuningResolved, [templateId]);
  const tpl = templateOf(gp, templateId);
  const d = genDistrict(rng(seed, 'world', 'district', 0), tpl, gp, {
    id: formatId('dst', 1),
    index: 0,
    districtCount: 1,
    parcelsCap: undefined,
    usedDistrictNames: [],
    reserveFamilyRun: false,
  });
  let n = 0;
  const r = rng(seed, 'world', 'creeks', d.id);
  const net = genCreekNetwork(r, d, gp, () => formatId('crk', ++n));
  return { net, draws: r.drawCount };
}

/** What a creek's own slot draws decide (not its id, row count or upstream miles, which depend on the network). */
function slotFacts(c: GenCreek): unknown {
  return {
    name: c.name,
    halfWidthFt: c.halfWidthFt,
    goldBearing: c.goldBearing,
    gradeFactor: c.gradeFactor,
    noTrail: c.noTrail,
    fishBearing: c.fishBearing,
    anadromous: c.anadromous,
  };
}

const main = (r: NetRun): GenCreek => r.net.creeks[0] as GenCreek;
const tribs = (r: NetRun): GenCreek[] => r.net.creeks.filter((c) => c.order === 2);
const branches = (r: NetRun): GenCreek[] => r.net.creeks.filter((c) => c.order === 3);
const overlaysOn = (r: NetRun, c: GenCreek): unknown[] =>
  r.net.overlays.filter((o) => o.creekId === c.id).map((o) => [o.kind, o.rowFrom, o.rowTo]);

/** The branch of each tributary, keyed by the tributary's name (names are unique across slots). */
function branchByParent(r: NetRun): Map<string, GenCreek> {
  const out = new Map<string, GenCreek>();
  for (const b of branches(r)) {
    const parent = r.net.creeks[b.parentIdx ?? -1];
    if (parent !== undefined) out.set(parent.name, b);
  }
  return out;
}

const SEEDS = Array.from({ length: 60 }, (_, i) => `net-${i}`);

describe('creek network draw order (§3.3.1)', () => {
  it.each([
    ['northernFederal', 0.5, 0.3],
    ['northernFederal', 0, 1],
    ['aridFederal', 0.5, 0.3],
  ] as const)('a %s branchP retune %f → %f moves no other draw', (templateId, pA, pB) => {
    let branchCountChanged = 0;
    for (const seed of SEEDS) {
      const a = network(seed, templateId, { 'geology.world.branchP': pA });
      const b = network(seed, templateId, { 'geology.world.branchP': pB });
      expect(b.draws).toBe(a.draws);
      if (branches(a).length !== branches(b).length) branchCountChanged++;
      // The main stem: its slot draws, geometry and overlays.
      expect(slotFacts(main(b))).toEqual(slotFacts(main(a)));
      expect(main(b).points).toEqual(main(a).points);
      expect(overlaysOn(b, main(b))).toEqual(overlaysOn(a, main(a)));
      // Every tributary: same geometry and slot draws, and the special-status stretch on the same tributary.
      expect(tribs(b).map(slotFacts)).toEqual(tribs(a).map(slotFacts));
      expect(tribs(b).map((c) => overlaysOn(b, c))).toEqual(tribs(a).map((c) => overlaysOn(a, c)));
      // A branch present in both networks keeps its slot's attributes and name.
      const bb = branchByParent(b);
      for (const [parent, branch] of branchByParent(a)) {
        const other = bb.get(parent);
        if (other !== undefined) expect(slotFacts(other)).toEqual(slotFacts(branch));
      }
    }
    expect(branchCountChanged).toBeGreaterThan(SEEDS.length / 4);
  });

  it('a tributary-count retune leaves the main stem, its withdrawal and the surviving tributaries unchanged', () => {
    let countChanged = 0;
    for (const seed of SEEDS) {
      const a = network(seed, 'northernFederal', { 'geology.world.nTrib': [5, 8] });
      const b = network(seed, 'northernFederal', { 'geology.world.nTrib': [7, 8] });
      expect(b.draws).toBe(a.draws);
      if (tribs(a).length !== tribs(b).length) countChanged++;
      expect(slotFacts(main(b))).toEqual(slotFacts(main(a)));
      const withdrawn = (r: NetRun): unknown[] =>
        r.net.overlays.filter((o) => o.kind === 'withdrawn').map((o) => [o.creekId, o.rowFrom, o.rowTo]);
      expect(withdrawn(b)).toEqual(withdrawn(a));
      // Every tributary of the smaller network exists in the larger one with the same slot draws.
      const names = new Map(tribs(b).map((c) => [c.name, slotFacts(c)]));
      for (const c of tribs(a)) if (names.has(c.name)) expect(names.get(c.name)).toEqual(slotFacts(c));
      const shared = tribs(a).filter((c) => names.has(c.name)).length;
      expect(shared).toBe(Math.min(tribs(a).length, tribs(b).length));
    }
    expect(countChanged).toBeGreaterThan(SEEDS.length / 4);
  });

  it('names every creek of a district uniquely', () => {
    for (const seed of SEEDS) {
      for (const templateId of ['northernFederal', 'aridFederal'] as const) {
        const names = network(seed, templateId).net.creeks.map((c) => c.name);
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });
});
