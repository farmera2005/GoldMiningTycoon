// effective() query builders and the hook base rule (S12-7, S12-14; P1 contract §1.9).
import { describe, expect, it } from 'vitest';
import type { HookDef } from '../../../data/events/hooks';
import { ContractStubError } from '../../core/assert';
import type { BlockId, ClaimId, DistrictId, EmployeeId, MachineId } from '../../core/ids';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import { EffectiveError, effective, hookBase } from './effective';
import { qBlock, qClaim, qCompany, qDistrict, qEmployee, qMachine } from './queries';

const STATE = newGame(defaultNewGameSetup({ companyName: 'Query Test' }), 'queries');
const claimId = STATE.world.claimIds[0] as ClaimId;
const claim = STATE.world.claims[claimId]!;

describe('query builders (S12-7)', () => {
  it('give every read its full context', () => {
    expect(qCompany()).toEqual({});
    expect(qDistrict('dst_000001' as DistrictId)).toEqual({ districtId: 'dst_000001' });
    expect(qClaim(STATE, claimId)).toEqual({ districtId: claim.districtId, claimId });
    const blockId = `blk_${String(claim.blockIdBase).padStart(6, '0')}` as BlockId;
    expect(qBlock(STATE, claimId, blockId)).toEqual({ districtId: claim.districtId, claimId, blockId });
  });

  it('throw on an unknown claim, inherited keys included', () => {
    expect(() => qClaim(STATE, 'clm_999999' as ClaimId)).toThrow(EffectiveError);
    expect(() => qClaim(STATE, 'constructor' as ClaimId)).toThrow(EffectiveError);
  });

  it('machine and employee reads wait for the §9 and §8 slices (creation-style stubs fail loudly)', () => {
    expect(() => qMachine(STATE, 'mch_000001' as MachineId)).toThrow(ContractStubError);
    expect(() => qEmployee(STATE, 'emp_owner' as EmployeeId)).toThrow(ContractStubError);
  });

  it('a claim query reads a tuning key as its base when no modifier acts', () => {
    expect(effective(STATE, 'market.openingSpotUsdPerFineOz', qClaim(STATE, claimId))).toBe(
      STATE.meta.tuning['market.openingSpotUsdPerFineOz'],
    );
  });
});

describe('the hook base (S12-14)', () => {
  const row = (over: Partial<HookDef>): HookDef => ({
    key: 'permits.noticeMaxAcresSet',
    ownerSection: 6,
    unit: 'acres',
    neutral: 0,
    ops: ['set'],
    scopeDims: ['district'],
    base: 'neutral',
    consumerPhase: 2,
    ...over,
  });
  const tuning = { 'permits.noticeMaxAcres': 5, 'ops.someMult': 1.2 };

  it('reads a tuning key, a baseKey, or the neutral value', () => {
    expect(hookBase(tuning, 'ops.someMult', undefined)).toBe(1.2);
    expect(
      hookBase(
        tuning,
        'permits.noticeMaxAcresSet',
        row({ base: 'tuning', baseKey: 'permits.noticeMaxAcres' as never }),
      ),
    ).toBe(5);
    expect(hookBase(tuning, 'permits.noticeMaxAcresSet', row({}))).toBe(0);
    expect(() => hookBase(tuning, 'nothing.here', undefined)).toThrow(EffectiveError);
    expect(() => hookBase({ 'x.y': 'text' }, 'x.y', undefined)).toThrow(/finite number/);
  });
});
