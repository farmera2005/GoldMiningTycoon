import { describe, expect, it } from 'vitest';
import { STREAMS, isStreamName, type StreamName } from './streams';

const names = Object.keys(STREAMS) as StreamName[];

// The shorter historical names §2.3 registers "as they stand" (rule a); every other stream carries its section prefix.
const LEGACY = new Set([
  'season',
  'season-fc',
  'weather',
  'weather-init',
  'setup',
  'investor',
  'world',
  'seller',
  'seller-tells',
  'supply',
  'site',
  'prospect',
  'sample',
  'records',
  'contractors',
  'negotiation',
  'macro',
  'news',
  'analyst',
  'buyer',
  'assay',
  'events',
  'ai',
  'action',
]);
const SECTION_PREFIXES: Record<number, string[]> = {
  5: ['land-'],
  6: ['permits-'],
  7: ['ops-'],
  8: ['staff-'],
  9: ['fleet-'],
  10: ['gold-', 'market-'],
  11: ['finance-'],
  12: ['ai-'],
  14: ['hr-'],
};

describe('STREAMS registry (DESIGN §2.3)', () => {
  it('has lowercase hyphenated names, each with one owning section', () => {
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14]).toContain(STREAMS[name].owner);
    }
  });

  it('gives every non-legacy stream its section prefix (rule a)', () => {
    for (const name of names) {
      if (LEGACY.has(name)) continue;
      const prefixes = SECTION_PREFIXES[STREAMS[name].owner] ?? [];
      expect(
        prefixes.some((p) => name.startsWith(p)),
        `${name} (§${STREAMS[name].owner})`,
      ).toBe(true);
    }
  });

  it('registers the §2.3 table exactly, with the owners D-2.9 and D-2.30 settled', () => {
    expect(names).toHaveLength(87);
    const owners: Partial<Record<StreamName, number>> = {
      'finance-reorg': 11,
      'finance-lender': 11,
      'finance-royaltyco': 11,
      'finance-equity': 11,
      'finance-insurance': 11,
      'market-buyers': 10,
      negotiation: 5,
      sample: 4,
      world: 3,
      action: 2,
      'ops-skim': 7,
      'hr-capex': 14,
    };
    for (const [name, owner] of Object.entries(owners)) expect(STREAMS[name as StreamName].owner).toBe(owner);
    for (const absent of ['seller-data', 'royalty-co', 'equity-offer', 'gold-buyers'])
      expect(isStreamName(absent)).toBe(false);
  });

  it('isStreamName rejects inherited properties', () => {
    expect(isStreamName('world')).toBe(true);
    expect(isStreamName('toString')).toBe(false);
    expect(isStreamName('constructor')).toBe(false);
  });
});
