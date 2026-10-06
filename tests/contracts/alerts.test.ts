// Alert kinds in P1 (P1 contract §6, S12-12): ALERT_KINDS holds every P1 kind and the five new ones; every kind has one
// taxonomy row; the P1 rows carry §6's owner, severity and trigger and phase 1; nothing names `company.welcome`.
import { describe, expect, it } from 'vitest';
import { ALERT_KINDS, ALERT_TAXONOMY, alertKindsInPhase, type AlertKind } from '../../src/engine';

/** P1 contract §6: kind → [owner, severity ('rule' where the owner picks it), trigger]. */
const P1_KINDS: Readonly<Partial<Record<AlertKind, readonly [number, string, 'level' | 'edge']>>> = {
  'season.phaseChange': [1, 'info', 'edge'],
  'season.forecastUpdate': [1, 'info', 'edge'],
  'weather.severe': [1, 'rule', 'edge'],
  'listing.new': [3, 'info', 'edge'],
  'listing.priceChanged': [3, 'info', 'edge'],
  'siteVisit.report': [3, 'info', 'edge'],
  'prospect.resultsReady': [4, 'rule', 'edge'],
  'prospect.classChanged': [4, 'rule', 'edge'],
  'prospect.programPaused': [4, 'warning', 'edge'],
  'prospect.sellerContradicted': [4, 'info', 'edge'],
  'lease.anniversarySoon': [5, 'info', 'level'],
  'lease.defaultNotice': [5, 'critical', 'edge'],
  'lease.terminated': [5, 'warning', 'edge'],
  'lease.ended': [5, 'info', 'edge'],
  'land.quickSaleClosed': [5, 'info', 'edge'],
  'land.interestChanged': [5, 'info', 'edge'],
  'obligation.dueSoon': [6, 'rule', 'level'],
  'obligation.missed': [6, 'critical', 'edge'],
  'ops.plantIdleHigh': [7, 'warning', 'level'],
  'ops.stripCoverageLow': [7, 'warning', 'level'],
  'ops.waterLimited': [7, 'warning', 'level'],
  'ops.cleanupOverdue': [7, 'warning', 'level'],
  'ops.padFull': [7, 'warning', 'level'],
  'ops.freezeUpNotWinterized': [7, 'rule', 'level'],
  'ops.cleanupDone': [7, 'info', 'edge'],
  'crew.noForeman': [8, 'warning', 'level'],
  'employee.quit': [8, 'rule', 'edge'],
  'crew.moraleLow': [8, 'warning', 'level'],
  'crew.leadHand': [8, 'info', 'level'],
  'staff.layoffDecision': [8, 'warning', 'edge'],
  'staff.recallDecision': [8, 'warning', 'edge'],
  'delivery.arrived': [9, 'info', 'edge'],
  'transport.stalled': [9, 'warning', 'level'],
  'transport.windowClosing': [9, 'warning', 'level'],
  'cash.projectedNegative': [11, 'rule', 'level'],
  'payroll.missed': [11, 'critical', 'edge'],
  'loan.paymentMissed': [11, 'critical', 'edge'],
  'distress.stage': [11, 'critical', 'edge'],
};

describe('alert kinds in P1 (P1 contract §6)', () => {
  it('lists every P1 kind once and no welcome letter', () => {
    for (const kind of Object.keys(P1_KINDS)) expect(ALERT_KINDS, kind).toContain(kind);
    expect(new Set(ALERT_KINDS).size).toBe(ALERT_KINDS.length);
    expect(ALERT_KINDS as readonly string[]).not.toContain('company.welcome');
  });

  it('has one taxonomy row per kind, and §6’s owner, severity and trigger on the P1 rows', () => {
    expect(Object.keys(ALERT_TAXONOMY).sort()).toEqual([...ALERT_KINDS].sort());
    for (const [kind, expected] of Object.entries(P1_KINDS)) {
      const row = ALERT_TAXONOMY[kind as AlertKind];
      expect([row.owner, row.severity, row.trigger, row.phase], kind).toEqual([...(expected ?? []), 1]);
    }
  });

  it('emits under P1 rules exactly the P1 kinds', () => {
    expect(alertKindsInPhase(1).sort()).toEqual(Object.keys(P1_KINDS).sort());
    expect(alertKindsInPhase(0)).toEqual([]);
  });
});
