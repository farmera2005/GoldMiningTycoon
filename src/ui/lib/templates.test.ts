// Filling the text catalogs (DESIGN §13.10 templates, §13.19): placeholders format through ui/format exactly as the
// screens do, codes and enumerations print their catalog text, variants fall back to the kind, grouped obligation
// messages use the group title.
import { describe, expect, it } from 'vitest';
import {
  alertTemplate,
  alertText,
  codeReason,
  decisionOptionText,
  decisionTemplate,
  enumLabel,
  fillTemplate,
  fundingConsequence,
  isKnownSpec,
  placeholders,
} from './templates';

const ctx = { dateView: (turn: number) => ({ year: Math.floor(turn / 52) + 1, week: (turn % 52) + 1 }) };

describe('fillTemplate', () => {
  it('formats units, codes and labels, and leaves raw params as given', () => {
    expect(fillTemplate('{claim} asks {askCents:cents}', { claim: 'Caribou Fork #3', askCents: 12_345_678 })).toBe(
      'Caribou Fork #3 asks $123,457',
    );
    expect(fillTemplate('due {dueTurn:turn}', { dueTurn: 34 }, ctx)).toBe('due Y1 Wk 35');
    expect(fillTemplate('{oz:rawOz} and {f:fineOz}', { oz: 52.9014, f: 1234.5 })).toBe(
      '52.901 raw oz and 1,234.50 fine oz',
    );
    expect(fillTemplate('{p:pct}', { p: 0.294 })).toBe('29.4%');
    expect(fillTemplate('{w:weeks}', { w: 1 })).toBe('1 week');
    expect(fillTemplate('{r:code}', { r: 'ACCESS_CLOSED' })).toBe('The way in is closed this week.');
    expect(fillTemplate('{c:idleCause}', { c: 'starved' })).toBe('Starved');
    expect(fillTemplate('{c:payCategory}', { c: 'payroll.net' })).toBe('Payroll');
  });

  it('leaves a placeholder visible when its param is missing, and prints unknown values as given', () => {
    expect(fillTemplate('{claim}: {missing:cents}', { claim: 'A' })).toBe('A: {missing:cents}');
    expect(fillTemplate('{r:code}', { r: 'NO_SUCH_CODE' })).toBe('NO_SUCH_CODE');
    expect(fillTemplate('{c:idleCause}', { c: 'nope' })).toBe('nope');
    // A unit applied to a string param prints the string.
    expect(fillTemplate('{x:cents}', { x: 'n/a' })).toBe('n/a');
  });

  it('parses placeholders and knows its formats', () => {
    expect(placeholders('{a} {b:cents} {c:idleCause}')).toEqual([
      { name: 'a', spec: null },
      { name: 'b', spec: 'cents' },
      { name: 'c', spec: 'idleCause' },
    ]);
    expect(isKnownSpec('turn')).toBe(true);
    expect(isKnownSpec('code')).toBe(true);
    expect(isKnownSpec('seasonPhase')).toBe(true);
    expect(isKnownSpec('money')).toBe(false);
  });
});

describe('alert text (13.10)', () => {
  it('finds a variant, and falls back from an unknown variant to the kind', () => {
    expect(alertTemplate('season.phaseChange.breakup')?.title).toBe('{district}: breakup has begun');
    expect(alertTemplate('season.phaseChange.somethingNew')?.title).toBe('{district}: {phase:seasonPhase}');
    expect(alertTemplate('ops.cleanupDone')).not.toBeNull();
    expect(alertTemplate('no.suchKind')).toBeNull();
  });

  it('renders a message, and a grouped obligation message with its group title (13.10 escalation example)', () => {
    expect(
      alertText({ templateKey: 'season.phaseChange', params: { district: 'Caribou Fork', phase: 'operating' } }),
    ).toEqual({
      title: 'Caribou Fork: operating season',
      body: 'The season in Caribou Fork has moved to operating season. Check access windows and plans for the claims there.',
    });
    const grouped = alertText(
      {
        templateKey: 'obligation.dueSoon',
        params: { count: 12, category: 'land', dueTurn: 34, totalUsd: 2400, title: 'Fee', amountCents: 20_000 },
      },
      ctx,
    );
    expect(grouped.title).toBe('12 claim and land payments due Y1 Wk 35 · $2,400');
    const single = alertText(
      {
        templateKey: 'obligation.dueSoon',
        params: { count: 1, title: 'Advance minimum royalty: Caribou Fork', dueTurn: 34, amountCents: 1_500_000 },
      },
      ctx,
    );
    expect(single.title).toBe('Advance minimum royalty: Caribou Fork due Y1 Wk 35');
  });

  it('shows the template key for a kind without a template rather than a blank row', () => {
    expect(alertText({ templateKey: 'hr.tsfFull', params: {} })).toEqual({ title: 'hr.tsfFull', body: '' });
  });
});

describe('decisions, codes and labels', () => {
  it('resolves decision templates and option keys (decision.<kind>.<option>[.consequence])', () => {
    expect(decisionTemplate('staff.layoffDecision')?.options['keepAll']?.label).toBe('Keep everyone on');
    expect(decisionTemplate('nope')).toBeNull();
    expect(decisionOptionText('decision.staff.recallDecision.recallAll')).toBe('Recall the crew');
    expect(decisionOptionText('decision.staff.recallDecision.recallAll.consequence')).toMatch(/^Laid-off hands/);
    expect(decisionOptionText('decision.staff.recallDecision.nope')).toBe('decision.staff.recallDecision.nope');
    expect(decisionOptionText('plain')).toBe('plain');
  });

  it('prints code reasons, enum labels and funding consequences, falling back to the key', () => {
    expect(codeReason('INSUFFICIENT_FUNDS')).toBe('Not enough cash on hand to pay for this now.');
    expect(codeReason('SMALL_CREW_ENDS')).toMatch(/small crew/);
    expect(codeReason('XYZ')).toBe('XYZ');
    expect(enumLabel('role', 'plantOperator')).toBe('Plant operator');
    expect(enumLabel('role', 'astronaut')).toBe('astronaut');
    expect(fundingConsequence('funding.payroll.net')).toMatch(/^Missed payroll/);
    expect(fundingConsequence('funding.nope')).toBe('funding.nope');
  });
});
