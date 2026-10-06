import { describe, expect, it } from 'vitest';
import { syntheticResult, operating } from './metrics/testing';
import { csvField, fmtUsd, gameCsvRow, gamesCsvHeader, toCsv } from './report';

describe('CSV (RFC 4180)', () => {
  it('quotes fields with commas, quotes, CR or LF and doubles inner quotes', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    expect(csvField('cr\r')).toBe('"cr\r"');
    expect(csvField(null)).toBe('');
    expect(csvField(true)).toBe('1');
    expect(csvField(false)).toBe('0');
    expect(csvField(0.25)).toBe('0.25');
  });

  it('ends every record with CRLF', () => {
    expect(
      toCsv([
        ['a', 'b'],
        [1, null],
      ]),
    ).toBe('a,b\r\n1,\r\n');
  });
});

describe('games.csv columns (BALANCE §6.6)', () => {
  it("keeps BALANCE §6.6's column order", () => {
    const h = gamesCsvHeader(5);
    const order = [
      'seed',
      'bot',
      'start',
      'difficulty',
      'background',
      'entity',
      'district',
      'B1',
      'B5',
      'S1',
      'S5',
      'lostWeek',
      'lossCause',
      'liquidationCause',
      'reorgFiledWeek',
      'reorgStatus',
      'reorgConsensual',
      'netIncomeUsd1',
      'ownerNwUsd1',
      'washedBcy1',
      'fineOz1',
      'cashCostUsdPerOz1',
      'aiscUsdPerOz1',
      'claimsAcquired',
      'claimsProfitable',
      'explorationSpendUsd',
      'firstSeasonCommitmentUsd',
      'ownerInjectionUsd',
      'minCashUsd',
      'minCashWeek',
      'eventsMinor',
      'eventsCatastrophic',
      'maxPlantLines',
      'smallCrewClaimWeeks',
      'poolMechanicWeeks',
    ];
    const at = order.map((c) => h.indexOf(c));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(h.indexOf('rules')).toBe(h.indexOf('entity') + 1);
  });

  it('writes 1/0 survival flags, USD with cents and blanks for null', () => {
    const g = syntheticResult({ seed: '1007' }, 2, operating);
    const row = gameCsvRow(g, 3);
    const h = gamesCsvHeader(3);
    const col = (name: string) => row[h.indexOf(name)];
    expect(row).toHaveLength(h.length);
    expect(col('seed')).toBe('1007');
    expect(col('rules')).toBe('p1');
    expect(col('B1')).toBe(true);
    expect(col('S2')).toBe(true);
    expect(col('B3')).toBeNull(); // the game ran 2 years
    expect(col('ownerNwUsd1')).toBe('520000.00');
    expect(col('reorgStatus')).toBe('none');
    expect(col('cashCostUsdPerOz1')).toBeNull();
    expect(col('maxPlantLines')).toBe(0);
  });
});

describe('console money', () => {
  it('formats whole dollars with separators', () => {
    expect(fmtUsd(520000)).toBe('$520,000');
    expect(fmtUsd(-1234.5)).toBe('-$1,235');
    expect(fmtUsd(999)).toBe('$999');
    expect(fmtUsd(null)).toBe('n/a');
  });
});
