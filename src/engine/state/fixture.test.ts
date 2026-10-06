// Fixture games (s02 #2; P1 contract §1.6): the setup and overrides are the frame's; the builders arrive with their
// owners, so until then a fixture game fails loudly with ContractStubError rather than building a wrong game.
import { describe, expect, it } from 'vitest';
import { ContractStubError } from '../core/assert';
import { fixtureOverrides, fixtureSetup, newFixtureGame, type FixtureSpec } from './fixture';
import { validateSetup } from './setup';

const SPEC: FixtureSpec = {
  id: 'refSmallNorth',
  template: 'northernFederal',
  start: { entity: 'llc', background: 'operator', companyCashUsd: 250_000, personalCashUsd: 50_000 },
  claim: {
    acres: 20,
    blocks: 40,
    gradeOzPerBcy: 0.012,
    payFt: 4,
    bedrockFt: 1,
    overburdenFt: 12,
    permafrost: 0.2,
    clay: 0.1,
    boulders: 0.1,
    cementation: 0,
    sizeMix: { coarse: 0.3, medium: 0.4, fine: 0.25, ultrafine: 0.05 },
    alloyFineness: 0.85,
    water: { kind: 'creek', gpm: 600 },
    access: 'highway',
    roadMi: 3,
  },
  tenure: { kind: 'ownedUnpatented', costBasisUsd: 0 },
  interests: [],
  fleet: [{ modelId: 'ex30', grade: 'B' }],
  crew: [{ role: 'operator', skill: 0.6 }],
  owner: { assignment: 'foreman' },
  loans: [],
  site: 'ready',
  stripAheadBlocks: 2,
  plan: 'default',
  tuningOverrides: { 'game.start.bootstrapper.personalCashUsd': 60_000 },
};

describe('fixture games (s02 #2)', () => {
  it('plays a valid Bootstrapper setup in the fixture’s district with its entity and background', () => {
    const setup = fixtureSetup(SPEC);
    expect(validateSetup(setup)).toEqual([]);
    expect(setup).toMatchObject({
      start: 'bootstrapper',
      entity: 'llc',
      background: 'operator',
      world: { districtTemplates: ['northernFederal'] },
    });
  });

  it('passes the cash as start-cash overrides, with the spec’s own overrides last', () => {
    expect(fixtureOverrides(SPEC)).toEqual({
      'game.start.bootstrapper.companyCashUsd': 250_000,
      'game.start.bootstrapper.personalCashUsd': 60_000,
    });
  });

  it('fails loudly until the owners’ builders land', () => {
    expect(() => newFixtureGame(SPEC, '7')).toThrow(ContractStubError);
  });
});
