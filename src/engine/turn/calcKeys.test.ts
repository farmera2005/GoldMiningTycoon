// Report calc keys (S13-6): `<systemFolder>/<metric>/<entityId>[/<lineId>]`, built and parsed one way everywhere.
import { describe, expect, it } from 'vitest';
import { CalcKeyError, SYSTEM_FOLDERS, parseReportCalcKey, reportCalcKey, type SystemFolder } from './calcKeys';

describe('report calc keys (S13-6)', () => {
  it('builds the documented example and parses it back', () => {
    const key = reportCalcKey('ops', 'directCostPerBcy', 'clm_000012', 'L1');
    expect(key).toBe('ops/directCostPerBcy/clm_000012/L1');
    expect(parseReportCalcKey(key)).toEqual({
      folder: 'ops',
      metric: 'directCostPerBcy',
      entityId: 'clm_000012',
      lineId: 'L1',
    });
    expect(parseReportCalcKey(reportCalcKey('finance', 'cashOnHand', 'company'))).toEqual({
      folder: 'finance',
      metric: 'cashOnHand',
      entityId: 'company',
      lineId: null,
    });
    expect(reportCalcKey('staff', 'payroll', 'emp_owner')).toBe('staff/payroll/emp_owner');
  });

  it('round-trips every system folder', () => {
    for (const folder of SYSTEM_FOLDERS) {
      expect(parseReportCalcKey(reportCalcKey(folder, 'value', 'company'))?.folder).toBe(folder);
    }
  });

  it('refuses malformed parts, and parses nothing it did not build', () => {
    expect(() => reportCalcKey('mining' as SystemFolder, 'x', 'company')).toThrow(CalcKeyError);
    expect(() => reportCalcKey('ops', 'Cost', 'company')).toThrow(/camelCase/);
    expect(() => reportCalcKey('ops', 'cost/bcy', 'company')).toThrow(/camelCase/);
    expect(() => reportCalcKey('ops', 'cost', 'claim 12')).toThrow(/entity id/);
    expect(() => reportCalcKey('ops', 'cost', 'clm_000012', 'L0')).toThrow(/line id/);
    expect(parseReportCalcKey('finance.cashOnHand')).toBeNull(); // P0's legacy key
    expect(parseReportCalcKey('ops/cost')).toBeNull();
    expect(parseReportCalcKey('ops/cost/clm_000001/L1/extra')).toBeNull();
    expect(parseReportCalcKey('nope/cost/company')).toBeNull();
  });
});
