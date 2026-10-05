import { describe, expect, it } from 'vitest';
import { defaultNewGameSetup, validateSetup, type NewGameSetup, type SetupErrorCode } from './setup';

const base = (over: Partial<NewGameSetup> = {}): NewGameSetup =>
  defaultNewGameSetup({ companyName: 'Fortymile Placers', ...over });
const codes = (s: NewGameSetup): SetupErrorCode[] => validateSetup(s).map((i) => i.code);

describe('NewGameSetup (DESIGN §1 1.6)', () => {
  it('fills the P0 defaults: Bootstrapper LLC, no-edge owner, standard, sandbox, the two P1 districts, 2027', () => {
    const s = base();
    expect(s).toMatchObject({
      start: 'bootstrapper',
      entity: 'llc',
      background: 'none',
      difficulty: 'standard',
      mode: 'sandbox',
      backedTerms: null,
      scenarioId: null,
      tutorial: false,
    });
    expect(s.world).toEqual({
      startCalendarYear: 2027,
      districtTemplates: ['northernFederal', 'aridFederal'],
      openingSpotUsdPerFineOz: null,
    });
    expect(codes(s)).toEqual([]);
  });

  it('checks names: empty after trimming, and longer than 40 characters', () => {
    expect(codes(base({ companyName: '   ' }))).toEqual(['NAME_EMPTY']);
    expect(codes(base({ ownerName: '' }))).toEqual(['NAME_EMPTY']);
    expect(codes(base({ companyName: 'x'.repeat(40) }))).toEqual([]);
    expect(codes(base({ companyName: 'x'.repeat(41) }))).toEqual(['NAME_TOO_LONG']);
  });

  it('requires backed terms exactly when the start is backed, and refuses a sole prop with equity investors', () => {
    expect(codes(base({ start: 'backed' }))).toContain('BACKED_TERMS_REQUIRED');
    expect(codes(base({ backedTerms: 'royalty' }))).toContain('BACKED_TERMS_UNEXPECTED');
    expect(codes(base({ start: 'backed', backedTerms: 'equity', entity: 'soleProp' }))).toContain('ENTITY_NOT_ALLOWED');
    expect(codes(base({ start: 'backed', backedTerms: 'royalty', entity: 'soleProp' }))).not.toContain(
      'ENTITY_NOT_ALLOWED',
    );
  });

  it('refuses unknown scenarios and a scenario id in sandbox mode', () => {
    expect(codes(base({ mode: 'scenario', scenarioId: 'goldRush' }))).toEqual(['SCENARIO_UNKNOWN']);
    expect(codes(base({ scenarioId: 'goldRush' }))).toEqual(['SCENARIO_UNKNOWN']);
  });

  it('allows only the P1 district templates and needs a northern district for the Inheritor', () => {
    expect(codes(base({ world: { ...base().world, districtTemplates: ['yukon'] } }))).toContain(
      'DISTRICT_TEMPLATE_NOT_IN_PHASE',
    );
    expect(codes(base({ world: { ...base().world, districtTemplates: [] } }))).toContain(
      'DISTRICT_TEMPLATE_NOT_IN_PHASE',
    );
    const arid = { ...base().world, districtTemplates: ['aridFederal' as const] };
    expect(codes(base({ start: 'inheritor', world: arid }))).toContain('INHERITOR_NEEDS_NORTHERN');
  });

  it('accepts only the Bootstrapper start in a P0 build', () => {
    expect(codes(base({ start: 'inheritor' }))).toEqual(['START_NOT_IN_PHASE']);
    expect(codes(base({ start: 'backed', backedTerms: 'equity' }))).toEqual(['START_NOT_IN_PHASE']);
  });

  it('checks the start year and the opening spot override', () => {
    expect(codes(base({ world: { ...base().world, startCalendarYear: 2027.5 } }))).toEqual(['START_YEAR_INVALID']);
    expect(codes(base({ world: { ...base().world, openingSpotUsdPerFineOz: 0 } }))).toEqual(['OPENING_SPOT_INVALID']);
    expect(codes(base({ world: { ...base().world, openingSpotUsdPerFineOz: 3150 } }))).toEqual([]);
  });
});
