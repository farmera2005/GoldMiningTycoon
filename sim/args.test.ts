import { describe, expect, it } from 'vitest';
import { modeAvailableFrom, parseSimArgs, type SimArgErrorCode } from './args';
import { simConfig } from './config';

const ok = (argv: string[], build: 0 | 1 | 6 = 0) => {
  const r = parseSimArgs(argv, build);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.options;
};
const code = (argv: string[], build: 0 | 1 | 6 = 0): SimArgErrorCode | null => {
  const r = parseSimArgs(argv, build);
  return r.ok ? null : r.error.code;
};

describe('sim flags (CLAUDE.md "Commands")', () => {
  it('applies the documented defaults', () => {
    const o = ok(['--strategy', 'passive']);
    expect(o).toMatchObject({
      mode: 'bots',
      games: simConfig['sim.defaultGames'],
      years: simConfig['sim.defaultYears'],
      start: 'bootstrapper',
      difficulty: 'standard',
      background: 'none',
      entity: 'llc',
      seedBase: null,
      rulesPhase: 0,
      workers: simConfig['sim.workers'],
      out: null,
      tuningPath: null,
    });
    expect(o.strategy).toEqual({ id: 'passive', param: null });
  });

  it('parses every value flag, in both --flag value and --flag=value forms', () => {
    const o = ok(
      [
        '--games=12',
        '--strategy',
        'cautious',
        '--start',
        'backedRoyalty',
        '--years',
        '3',
        '--difficulty',
        'hard',
        '--background=geologist',
        '--entity',
        'soleProp',
        '--seed-base',
        '777',
        '--rules',
        'p1',
        '--tuning',
        'over.json',
        '--workers',
        '0',
        '--out',
        'tmp/out',
      ],
      1,
    );
    expect(o).toMatchObject({
      games: 12,
      years: 3,
      start: 'backedRoyalty',
      difficulty: 'hard',
      background: 'geologist',
      entity: 'soleProp',
      seedBase: 777,
      rulesPhase: 1,
      tuningPath: 'over.json',
      workers: 0,
      out: 'tmp/out',
    });
  });

  it('treats --seeds as an alias of --games, and rejects both together', () => {
    expect(ok(['--seeds', '9', '--strategy', 'passive']).games).toBe(9);
    expect(code(['--seeds', '9', '--games', '9', '--strategy', 'passive'])).toBe('DUPLICATE_FLAG');
  });

  it('selects the modes', () => {
    expect(ok(['--world-only']).mode).toBe('worldOnly');
    expect(ok(['--world-only', '--econ', 'refSmallNorth', '--calendar'])).toMatchObject({
      econ: 'refSmallNorth',
      calendar: true,
    });
    expect(ok(['--fixture', 'refSmallNorth', '--breakeven'])).toMatchObject({ mode: 'fixture', breakeven: true });
    expect(ok(['--market-only']).mode).toBe('marketOnly');
    expect(ok(['--events-only']).mode).toBe('eventsOnly');
    expect(ok(['--events-only', '--fixture', 'refSmallNorth']).mode).toBe('eventsOnly');
    expect(ok(['-h']).help).toBe(true);
  });

  const errors: [string[], SimArgErrorCode][] = [
    [['--strategy'], 'MISSING_VALUE'],
    [['--games', '--strategy', 'passive'], 'MISSING_VALUE'],
    [['--games', '0', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--games', '2.5', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--years', '-1', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--seed-base', 'abc', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--seed-base', '9007199254740990', '--games', '10', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--workers', '-2', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--start', 'backed', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--difficulty', 'brutal', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--background', 'pilot', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--entity', 'sCorp', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--strategy', 'wizard'], 'INVALID_VALUE'],
    [['--strategy', 'brandOnly'], 'INVALID_VALUE'],
    [['--rules', 'p7', '--strategy', 'passive'], 'INVALID_VALUE'],
    [['--rules', 'p1', '--strategy', 'passive'], 'RULES_ABOVE_BUILD'],
    [['--fixture', 'nowhere'], 'INVALID_VALUE'],
    [['--world-only', '--econ', 'nowhere'], 'INVALID_VALUE'],
    [['--frobnicate'], 'UNKNOWN_FLAG'],
    [['passive'], 'UNEXPECTED_ARGUMENT'],
    [['--strategy', 'passive', '--strategy', 'passive'], 'DUPLICATE_FLAG'],
    [['--world-only', '--world-only'], 'DUPLICATE_FLAG'],
    [['--world-only=yes'], 'INVALID_VALUE'],
    [['--world-only', '--market-only'], 'CONFLICTING_FLAGS'],
    [['--fixture', 'refSmallNorth', '--world-only'], 'CONFLICTING_FLAGS'],
    [['--world-only', '--strategy', 'passive'], 'CONFLICTING_FLAGS'],
    [['--breakeven', '--strategy', 'passive'], 'REQUIRES_FLAG'],
    [['--econ', 'refSmallNorth', '--strategy', 'passive'], 'REQUIRES_FLAG'],
    [['--calendar', '--strategy', 'passive'], 'REQUIRES_FLAG'],
    [['--games', '10'], 'MISSING_FLAG'],
  ];
  for (const [argv, expected] of errors) {
    it(`${argv.join(' ')} → ${expected}`, () => {
      expect(code(argv)).toBe(expected);
    });
  }

  it('allows --rules up to the build phase', () => {
    expect(ok(['--rules', 'p0', '--strategy', 'passive']).rulesPhase).toBe(0);
    expect(ok(['--rules', 'P6', '--strategy', 'passive'], 6).rulesPhase).toBe(6);
  });

  it('names the phase that ships each later mode', () => {
    expect(modeAvailableFrom(ok(['--fixture', 'starterNorth']))).toEqual({ what: '--fixture starterNorth', phase: 1 });
    expect(modeAvailableFrom(ok(['--market-only']))?.phase).toBe(5);
    expect(modeAvailableFrom(ok(['--events-only']))?.phase).toBe(3);
    expect(modeAvailableFrom(ok(['--world-only', '--econ', 'refSmallNorth']))?.phase).toBe(1);
    expect(modeAvailableFrom(ok(['--world-only', '--calendar']))?.phase).toBe(1);
    expect(modeAvailableFrom(ok(['--world-only']))).toBeNull();
    expect(modeAvailableFrom(ok(['--strategy', 'passive']))).toBeNull();
  });
});
