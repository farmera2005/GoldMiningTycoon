// The balance matrix (BALANCE §6.4) for a phase: which blocks run, their cells, years and games per cell. Bots come
// from the catalog by the phase they arrive in; a block whose machinery the build lacks is listed as not runnable so
// the report says what was skipped. P0 runs only the world block, in world-only mode.
import type { Difficulty, EntityType, OwnerBackground } from '../../src/engine';
import { BOT_CATALOG, type BotEntry } from '../bots/catalog';
import type { BotId } from '../bots/types';
import { simConfig } from '../config';
import type { SimStart } from '../setup';

export type BlockId =
  'core' | 'named' | 'backgrounds' | 'entity' | 'difficulty' | 'world' | 'fixtures' | 'market' | 'events' | 'hardRock';

export interface MatrixCell {
  bot: BotId;
  start: SimStart;
  difficulty: Difficulty;
  background: OwnerBackground;
  entity: EntityType;
}

export interface MatrixBlock {
  id: BlockId;
  description: string;
  /** Bot cells (empty for the world, fixtures, market, events and hard-rock blocks). */
  cells: MatrixCell[];
  years: number;
  games: number;
  /** Whether the phase's targets gate on this block (difficulty: reported until P6). */
  gating: boolean;
  /** Null when runnable in this build; otherwise why not (the phase that ships it). */
  unavailable: string | null;
}

export interface MatrixOptions {
  quick: boolean;
  /** Games per cell in place of the §6.3 sizes: tests and debugging only, never sign-off. */
  games?: number;
  /** Phase exit adds the backgrounds and entity blocks (BALANCE §6.4 "phase exit"); default true. */
  phaseExit?: boolean;
}

const BOTH_STARTS: readonly SimStart[] = ['bootstrapper', 'backedEquity'];
const ALL_STARTS: readonly SimStart[] = ['bootstrapper', 'backedEquity', 'backedRoyalty', 'inheritor'];
const EDGE_BACKGROUNDS: readonly OwnerBackground[] = ['operator', 'mechanic', 'geologist', 'banker', 'landman'];

function cell(bot: BotId, start: SimStart, over: Partial<MatrixCell> = {}): MatrixCell {
  return { bot, start, difficulty: 'standard', background: 'none', entity: 'llc', ...over };
}

/** §4.5's named bots active in the phase: the catalog's test and option bots (the brief's four make the core block). */
function namedBots(phase: number): BotEntry[] {
  return BOT_CATALOG.filter((e) => e.kind !== 'brief' && e.phase <= phase);
}

function unavailableBefore(firstPhase: number, buildPhase: number, what: string): string | null {
  return buildPhase >= firstPhase ? null : `${what} available from P${firstPhase}`;
}

/**
 * The phase's blocks. `buildPhase` is what this build implements: a block that needs machinery of a later phase is
 * marked unavailable (and a bot that is registered but not implemented fails at run time, never silently).
 */
export function buildMatrix(phase: number, buildPhase: number, opts: MatrixOptions): MatrixBlock[] {
  const games = opts.games ?? (opts.quick ? simConfig['sim.quickGames'] : simConfig['sim.defaultGames']);
  const phaseExit = opts.phaseExit ?? true;
  const blocks: MatrixBlock[] = [];
  if (phase >= 1) {
    const core: MatrixCell[] = [];
    for (const bot of ['cautious', 'balanced', 'aggressive'] as BotId[])
      for (const s of ALL_STARTS) core.push(cell(bot, s));
    core.push(cell('undercap', 'bootstrapper'));
    blocks.push({
      id: 'core',
      description: 'core bots × starts',
      cells: core,
      years: 5,
      games,
      gating: true,
      unavailable: unavailableBefore(1, buildPhase, 'core bots'),
    });

    const named: MatrixCell[] = [];
    for (const e of namedBots(phase)) {
      // brandOnly(brandId) runs one cell per brand of §9's catalog, which ships with it in P3.
      if (e.takesParam) continue;
      const starts =
        e.starts === null ? BOTH_STARTS : BOTH_STARTS.filter((s) => (e.starts as readonly SimStart[]).includes(s));
      for (const s of starts) named.push(cell(e.id, s));
    }
    // G-05 reads abandoner at 3 years; the block's 5 years cover it.
    blocks.push({
      id: 'named',
      description: 'named bots × {Bootstrapper, Backed equity}',
      cells: named,
      years: 5,
      games,
      gating: true,
      unavailable: unavailableBefore(1, buildPhase, 'named bots'),
    });

    if (phaseExit) {
      const bg: MatrixCell[] = [];
      for (const b of EDGE_BACKGROUNDS) for (const s of BOTH_STARTS) bg.push(cell('cautious', s, { background: b }));
      blocks.push({
        id: 'backgrounds',
        description: 'cautious × 5 backgrounds × {Bootstrapper, Backed equity}',
        cells: bg,
        years: 2,
        games,
        gating: true,
        unavailable: unavailableBefore(1, buildPhase, 'backgrounds'),
      });
    }
    if (phaseExit && phase >= 4) {
      const ent: MatrixCell[] = (['soleProp', 'llc'] as EntityType[]).map((entity) =>
        cell('cautious', 'bootstrapper', { entity }),
      );
      blocks.push({
        id: 'entity',
        description: 'cautious × {sole proprietor, LLC} × Bootstrapper',
        cells: ent,
        years: 2,
        games,
        gating: true,
        unavailable: unavailableBefore(4, buildPhase, 'entity effects'),
      });
    }
    const diff: MatrixCell[] = [];
    for (const d of ['easy', 'hard'] as Difficulty[]) {
      for (const s of BOTH_STARTS) diff.push(cell('cautious', s, { difficulty: d }));
      diff.push(cell('undercap', 'bootstrapper', { difficulty: d }));
    }
    blocks.push({
      id: 'difficulty',
      description: '{cautious (Bootstrapper, Backed equity), undercap} × {easy, hard}',
      cells: diff,
      years: 5,
      games,
      gating: phase >= 6,
      unavailable: unavailableBefore(1, buildPhase, 'difficulty block'),
    });
  }
  blocks.push({
    id: 'world',
    description: `${games} worlds, no bots (world-only)`,
    cells: [],
    years: 0,
    games,
    gating: phase >= 1,
    unavailable: null,
  });
  if (phase >= 1) {
    blocks.push({
      id: 'fixtures',
      description: 'every BALANCE §2.1 fixture',
      cells: [],
      years: 2,
      games: 1,
      gating: true,
      unavailable: unavailableBefore(1, buildPhase, 'fixtures'),
    });
  }
  if (phase >= 3) {
    blocks.push({
      id: 'events',
      description: 'refSmallNorth with events, 5 years',
      cells: [],
      years: 5,
      games,
      gating: phase >= 5,
      unavailable: unavailableBefore(3, buildPhase, 'events-only'),
    });
  }
  if (phase >= 5) {
    blocks.push({
      id: 'market',
      description: 'market only, 2,000 × 10 years',
      cells: [],
      years: 10,
      games: 2000,
      gating: true,
      unavailable: unavailableBefore(5, buildPhase, 'market-only'),
    });
  }
  if (phase >= 6) {
    const hr: MatrixCell[] = BOTH_STARTS.map((s) => cell('hardrockSeeker', s));
    blocks.push({
      id: 'hardRock',
      description: 'hardrockSeeker × {Bootstrapper, Backed equity}, hard rock on',
      cells: hr,
      years: 10,
      games,
      gating: true,
      unavailable: unavailableBefore(6, buildPhase, 'hard-rock track'),
    });
  }
  return blocks;
}
