import { describe, expect, it } from 'vitest';
import { simConfig } from '../config';
import { buildMatrix } from './matrix';

describe('balance matrix (BALANCE §6.4)', () => {
  it('P0 runs only the world block, in world-only mode', () => {
    const m = buildMatrix(0, 0, { quick: true });
    expect(m.map((b) => b.id)).toEqual(['world']);
    expect(m[0]).toMatchObject({ games: simConfig['sim.quickGames'], cells: [], unavailable: null, gating: false });
    expect(buildMatrix(0, 0, { quick: false })[0]?.games).toBe(simConfig['sim.defaultGames']);
  });

  it('P1 has the 13 core cells, the P1 named bots on two starts, 10 background cells and the difficulty block', () => {
    const m = buildMatrix(1, 1, { quick: false });
    const by = Object.fromEntries(m.map((b) => [b.id, b]));
    expect(by['core']?.cells).toHaveLength(13);
    expect(by['core']?.cells.filter((c) => c.bot === 'undercap')).toEqual([
      { bot: 'undercap', start: 'bootstrapper', difficulty: 'standard', background: 'none', entity: 'llc' },
    ]);
    const named = new Set(by['named']?.cells.map((c) => c.bot));
    expect(named).toEqual(
      new Set([
        'noTest',
        'heavyProspector',
        'leaseOnly',
        'buyOnly',
        'gradeDFleet',
        'gradeAFleet',
        'maxHours',
        'noStripAhead',
        'passive',
        'smallCrewNoForeman',
      ]),
    );
    expect(by['named']?.cells).toHaveLength(20);
    expect(by['backgrounds']?.cells).toHaveLength(10);
    expect(by['backgrounds']?.years).toBe(2);
    expect(by['difficulty']?.cells).toHaveLength(6);
    expect(by['difficulty']?.gating).toBe(false);
    expect(by['entity']).toBeUndefined();
    expect(by['fixtures']).toBeDefined();
  });

  it('marks blocks a P0 build cannot run as unavailable, naming the phase', () => {
    const m = buildMatrix(1, 0, { quick: true });
    expect(m.find((b) => b.id === 'core')?.unavailable).toBe('core bots available from P1');
    expect(m.find((b) => b.id === 'world')?.unavailable).toBeNull();
  });

  it('adds the entity block at P4, events at P3, market at P5 and hard rock with a gating difficulty block at P6', () => {
    expect(buildMatrix(3, 3, { quick: true }).map((b) => b.id)).toContain('events');
    const p4 = buildMatrix(4, 4, { quick: true });
    expect(p4.find((b) => b.id === 'entity')?.cells.map((c) => c.entity)).toEqual(['soleProp', 'llc']);
    expect(buildMatrix(5, 5, { quick: true }).find((b) => b.id === 'market')?.games).toBe(2000);
    const p6 = buildMatrix(6, 6, { quick: true });
    expect(p6.find((b) => b.id === 'difficulty')?.gating).toBe(true);
    expect(p6.find((b) => b.id === 'hardRock')?.cells.map((c) => c.bot)).toEqual(['hardrockSeeker', 'hardrockSeeker']);
    expect(buildMatrix(4, 4, { quick: true, phaseExit: false }).map((b) => b.id)).not.toContain('backgrounds');
  });
});
