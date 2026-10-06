// `npm run sim` flags (CLAUDE.md "Commands" simulator block; DESIGN §2.12). Parsing is pure and returns typed errors;
// sim/cli.ts turns them into the usage message and exit code 2. Whether this build can run a valid option (a later
// phase's bot, start or mode) is decided after parsing, in sim/cli.ts.
import type { Difficulty, EntityType, OwnerBackground, RulesPhase } from '../src/engine';
import { parseBotSpec, type BotSpec } from './bots/catalog';
import { simConfig } from './config';
import { BACKGROUNDS, DIFFICULTIES, ENTITIES, SIM_STARTS, type SimStart } from './setup';

export type SimMode = 'bots' | 'worldOnly' | 'fixture' | 'marketOnly' | 'eventsOnly';

export interface SimOptions {
  mode: SimMode;
  games: number;
  years: number;
  /** Required in bots mode. */
  strategy: BotSpec | null;
  start: SimStart;
  difficulty: Difficulty;
  background: OwnerBackground;
  entity: EntityType;
  /** null: the rules phase's base from src/data/balance/seeds.json. */
  seedBase: number | null;
  rulesPhase: RulesPhase;
  tuningPath: string | null;
  /** 0: one worker per CPU core (`sim.workers`). */
  workers: number;
  out: string | null;
  fixture: string | null;
  breakeven: boolean;
  econ: string | null;
  calendar: boolean;
  help: boolean;
}

export type SimArgErrorCode =
  | 'UNKNOWN_FLAG'
  | 'MISSING_VALUE'
  | 'INVALID_VALUE'
  | 'DUPLICATE_FLAG'
  | 'UNEXPECTED_ARGUMENT'
  | 'CONFLICTING_FLAGS'
  | 'REQUIRES_FLAG'
  | 'MISSING_FLAG'
  | 'RULES_ABOVE_BUILD';

export interface SimArgError {
  code: SimArgErrorCode;
  flag: string;
  message: string;
}

export type ParseResult = { ok: true; options: SimOptions } | { ok: false; error: SimArgError };

/** BALANCE §2.1 fixture ids (CLAUDE.md: `starterNorth`, `refSmallNorth`, … and variants). */
export const FIXTURE_IDS: readonly string[] = [
  'starterNorth',
  'refSmallNorth',
  'refSmallNorthRoyalty',
  'refSmallNorthDebt',
  'matureNorth',
  'starterArid',
  'starterAridWellOnly',
  'starterAridWell300',
  'inheritorNorth',
];

type ValueFlag =
  | 'games'
  | 'strategy'
  | 'start'
  | 'years'
  | 'difficulty'
  | 'background'
  | 'entity'
  | 'seed-base'
  | 'rules'
  | 'tuning'
  | 'workers'
  | 'out'
  | 'fixture'
  | 'econ';
type BoolFlag = 'breakeven' | 'world-only' | 'calendar' | 'market-only' | 'events-only' | 'help';

const VALUE_FLAGS: readonly ValueFlag[] = [
  'games',
  'strategy',
  'start',
  'years',
  'difficulty',
  'background',
  'entity',
  'seed-base',
  'rules',
  'tuning',
  'workers',
  'out',
  'fixture',
  'econ',
];
const BOOL_FLAGS: readonly BoolFlag[] = ['breakeven', 'world-only', 'calendar', 'market-only', 'events-only', 'help'];
/** `--seeds N` (DESIGN §10.21) is an alias of `--games N`. */
const ALIASES: Readonly<Record<string, ValueFlag | BoolFlag>> = { seeds: 'games', h: 'help' };

export const USAGE = `usage: npm run sim -- --strategy <botId> [options]
       npm run sim -- --world-only [--econ <fixtureId>] [--calendar] [options]
       npm run sim -- --fixture <id> [--breakeven] | --market-only | --events-only

  --games N, --seeds N   games per cell (default ${simConfig['sim.defaultGames']})
  --strategy <botId>     bot from sim/bots/catalog.ts (brandOnly(<brandId>) takes a brand)
  --start <s>            bootstrapper | backedEquity | backedRoyalty | inheritor (default bootstrapper)
  --years Y              years per game (default ${simConfig['sim.defaultYears']})
  --difficulty <d>       easy | standard | hard (default standard)
  --background <b>       none | operator | mechanic | geologist | banker | landman (default none)
  --entity <e>           soleProp | llc | corp (default llc)
  --seed-base S          game i uses seed S + i (default: src/data/balance/seeds.json for the rules phase)
  --rules pN             phase rules p0..p6, at most the build's phase (default: the build's phase)
  --tuning <file.json>   tuning overrides { "key": value }
  --workers N            worker processes, 0 = CPU cores (default ${simConfig['sim.workers']}); never changes results
  --out <dir>            write summary.json, games.csv, weekly-sample.csv (and timing.json)
  --fixture <id>         run a scripted BALANCE §2.1 fixture [--breakeven]
  --world-only           newGame for N seeds, no weeks advance [--econ <fixtureId>] [--calendar]
  --market-only          §10's price and macro model only
  --events-only          a fixture with §12's events on
  -h, --help             this message`;

function err(code: SimArgErrorCode, flag: string, message: string): { ok: false; error: SimArgError } {
  return { ok: false, error: { code, flag, message } };
}

function positiveInt(text: string, max: number): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 1 && n <= max ? n : null;
}

function oneOf<T extends string>(text: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(text) ? (text as T) : null;
}

/** Parses argv (without the node and script entries). `buildPhase` bounds `--rules`. */
export function parseSimArgs(argv: readonly string[], buildPhase: RulesPhase): ParseResult {
  const values: Partial<Record<ValueFlag, string>> = {};
  const bools: Partial<Record<BoolFlag, true>> = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i] as string;
    if (!raw.startsWith('-')) return err('UNEXPECTED_ARGUMENT', raw, `unexpected argument '${raw}'`);
    const body = raw.replace(/^--?/, '');
    const eq = body.indexOf('=');
    const name0 = eq >= 0 ? body.slice(0, eq) : body;
    const name = ALIASES[name0] ?? name0;
    if ((VALUE_FLAGS as readonly string[]).includes(name)) {
      const flag = name as ValueFlag;
      let value: string | undefined;
      if (eq >= 0) value = body.slice(eq + 1);
      else {
        value = argv[i + 1];
        if (value !== undefined && value.startsWith('--')) value = undefined;
        else i++;
      }
      if (value === undefined || value === '') return err('MISSING_VALUE', `--${flag}`, `--${flag} needs a value`);
      if (values[flag] !== undefined) return err('DUPLICATE_FLAG', `--${flag}`, `--${flag} given twice`);
      values[flag] = value;
    } else if ((BOOL_FLAGS as readonly string[]).includes(name)) {
      const flag = name as BoolFlag;
      if (eq >= 0) return err('INVALID_VALUE', `--${flag}`, `--${flag} takes no value`);
      if (bools[flag] === true) return err('DUPLICATE_FLAG', `--${flag}`, `--${flag} given twice`);
      bools[flag] = true;
    } else {
      return err('UNKNOWN_FLAG', raw, `unknown option '${raw}'`);
    }
  }

  const opts: SimOptions = {
    mode: 'bots',
    games: simConfig['sim.defaultGames'],
    years: simConfig['sim.defaultYears'],
    strategy: null,
    start: 'bootstrapper',
    difficulty: 'standard',
    background: 'none',
    entity: 'llc',
    seedBase: null,
    rulesPhase: buildPhase,
    tuningPath: null,
    workers: simConfig['sim.workers'],
    out: null,
    fixture: null,
    breakeven: bools.breakeven === true,
    econ: null,
    calendar: bools.calendar === true,
    help: bools.help === true,
  };
  if (opts.help) return { ok: true, options: opts };

  if (values.games !== undefined) {
    const n = positiveInt(values.games, 1_000_000);
    if (n === null)
      return err(
        'INVALID_VALUE',
        '--games',
        `--games must be a whole number from 1 to 1,000,000, got '${values.games}'`,
      );
    opts.games = n;
  }
  if (values.years !== undefined) {
    const n = positiveInt(values.years, 100);
    if (n === null)
      return err('INVALID_VALUE', '--years', `--years must be a whole number from 1 to 100, got '${values.years}'`);
    opts.years = n;
  }
  if (values['seed-base'] !== undefined) {
    const t = values['seed-base'];
    const n = Number(t);
    if (!/^\d+$/.test(t) || !Number.isSafeInteger(n)) {
      return err('INVALID_VALUE', '--seed-base', `--seed-base must be a non-negative whole number, got '${t}'`);
    }
    opts.seedBase = n;
  }
  if (opts.seedBase !== null && !Number.isSafeInteger(opts.seedBase + opts.games)) {
    return err('INVALID_VALUE', '--seed-base', '--seed-base + --games exceeds the safe integer range');
  }
  if (values.workers !== undefined) {
    const t = values.workers;
    const n = /^\d+$/.test(t) ? Number(t) : Number.NaN;
    if (!(Number.isInteger(n) && n >= 0 && n <= 256)) {
      return err(
        'INVALID_VALUE',
        '--workers',
        `--workers must be a whole number from 0 (CPU cores) to 256, got '${t}'`,
      );
    }
    opts.workers = n;
  }
  if (values.rules !== undefined) {
    const m = /^[pP]([0-6])$/.exec(values.rules);
    if (m === null) return err('INVALID_VALUE', '--rules', `--rules must be p0…p6, got '${values.rules}'`);
    const phase = Number(m[1]) as RulesPhase;
    if (phase > buildPhase) {
      return err(
        'RULES_ABOVE_BUILD',
        '--rules',
        `--rules p${phase}: this is a P${buildPhase} build; phase-${phase} rules are available from P${phase}`,
      );
    }
    opts.rulesPhase = phase;
  }
  if (values.start !== undefined) {
    const s = oneOf(values.start, SIM_STARTS);
    if (s === null) return err('INVALID_VALUE', '--start', `--start must be one of ${SIM_STARTS.join(', ')}`);
    opts.start = s;
  }
  if (values.difficulty !== undefined) {
    const d = oneOf(values.difficulty, DIFFICULTIES);
    if (d === null)
      return err('INVALID_VALUE', '--difficulty', `--difficulty must be one of ${DIFFICULTIES.join(', ')}`);
    opts.difficulty = d;
  }
  if (values.background !== undefined) {
    const b = oneOf(values.background, BACKGROUNDS);
    if (b === null)
      return err('INVALID_VALUE', '--background', `--background must be one of ${BACKGROUNDS.join(', ')}`);
    opts.background = b;
  }
  if (values.entity !== undefined) {
    const e = oneOf(values.entity, ENTITIES);
    if (e === null) return err('INVALID_VALUE', '--entity', `--entity must be one of ${ENTITIES.join(', ')}`);
    opts.entity = e;
  }
  if (values.strategy !== undefined) {
    const r = parseBotSpec(values.strategy);
    if (!r.ok) {
      const why =
        r.error.code === 'BOT_UNKNOWN'
          ? `unknown bot '${values.strategy}' (see sim/bots/catalog.ts)`
          : r.error.code === 'BOT_PARAM_REQUIRED'
            ? `${r.error.id} needs a parameter: ${r.error.id}(<brandId>)`
            : `${r.error.id} takes no parameter`;
      return err('INVALID_VALUE', '--strategy', `--strategy: ${why}`);
    }
    opts.strategy = r.spec;
  }
  if (values.fixture !== undefined) {
    if (!FIXTURE_IDS.includes(values.fixture)) {
      return err('INVALID_VALUE', '--fixture', `--fixture must be one of ${FIXTURE_IDS.join(', ')}`);
    }
    opts.fixture = values.fixture;
  }
  if (values.econ !== undefined) {
    if (!FIXTURE_IDS.includes(values.econ)) {
      return err('INVALID_VALUE', '--econ', `--econ must be a fixture id: ${FIXTURE_IDS.join(', ')}`);
    }
    opts.econ = values.econ;
  }
  if (values.tuning !== undefined) opts.tuningPath = values.tuning;
  if (values.out !== undefined) opts.out = values.out;

  const exclusive = (['world-only', 'market-only', 'events-only'] as BoolFlag[]).filter((f) => bools[f] === true);
  if (exclusive.length > 1) {
    return err('CONFLICTING_FLAGS', `--${exclusive[1]}`, `--${exclusive.join(' and --')} cannot be combined`);
  }
  if (opts.fixture !== null && (bools['world-only'] === true || bools['market-only'] === true)) {
    return err('CONFLICTING_FLAGS', '--fixture', `--fixture cannot be combined with --${exclusive[0]}`);
  }
  if (opts.breakeven && opts.fixture === null)
    return err('REQUIRES_FLAG', '--breakeven', '--breakeven needs --fixture <id>');
  if (opts.econ !== null && bools['world-only'] !== true)
    return err('REQUIRES_FLAG', '--econ', '--econ needs --world-only');
  if (opts.calendar && bools['world-only'] !== true)
    return err('REQUIRES_FLAG', '--calendar', '--calendar needs --world-only');

  opts.mode =
    bools['world-only'] === true
      ? 'worldOnly'
      : bools['market-only'] === true
        ? 'marketOnly'
        : bools['events-only'] === true
          ? 'eventsOnly'
          : opts.fixture !== null
            ? 'fixture'
            : 'bots';
  if (opts.mode === 'bots' && opts.strategy === null) {
    return err('MISSING_FLAG', '--strategy', '--strategy <botId> is required for a bot run');
  }
  if (opts.mode !== 'bots' && opts.strategy !== null) {
    return err('CONFLICTING_FLAGS', '--strategy', `--strategy does not apply to a ${opts.mode} run`);
  }
  return { ok: true, options: opts };
}

/** Modes and mode options a later phase ships (CLAUDE.md phase plan): the phase, or null when this build has them. */
export function modeAvailableFrom(opts: SimOptions): { what: string; phase: number } | null {
  switch (opts.mode) {
    case 'fixture':
      return { what: `--fixture ${opts.fixture ?? ''}`.trim(), phase: 1 };
    case 'marketOnly':
      return { what: '--market-only', phase: 5 };
    case 'eventsOnly':
      return { what: '--events-only', phase: 3 };
    case 'worldOnly':
      if (opts.econ !== null) return { what: `--econ ${opts.econ}`, phase: 1 };
      if (opts.calendar) return { what: '--calendar', phase: 1 };
      return null;
    case 'bots':
      return null;
  }
}
