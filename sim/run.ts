// Shared run plumbing for `npm run sim` and `npm run sim:balance`: tuning overrides, cell specs, playing and summarizing
// a cell, the world-only block. Both CLIs build their outputs from these, so a cell scores the same in either.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveTuning, TuningError, type NewGameSetup, type RulesPhase, type TuningOverrides } from '../src/engine';
import { botLabel, type BotSpec } from './bots/catalog';
import { simConfig } from './config';
import type { CellRunSpec } from './game';
import { aggregateCell } from './metrics/aggregate';
import { cellLabel, cellSummary, type CellSummary } from './report';
import { runCell, type CellRun, type SimPool } from './runner';
import { setupForCell, type CellSetup } from './setup';

/** A failure the CLIs report as a message and an exit code (2: usage or not available; 1: a run failed). */
export class CliExit extends Error {
  readonly exitCode: number;

  constructor(exitCode: number, message: string) {
    super(message);
    this.name = 'CliExit';
    this.exitCode = exitCode;
  }
}

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
  cwd: string;
}

export const processIo: CliIo = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  cwd: process.cwd(),
};

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/** `--tuning overrides.json`: an object of tuning keys to values, validated by the engine's resolver. */
export function loadOverrides(path: string | null, cwd: string): TuningOverrides {
  if (path === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolve(cwd, path), 'utf8'));
  } catch (e) {
    throw new CliExit(EXIT_USAGE, `--tuning ${path}: cannot read JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CliExit(EXIT_USAGE, `--tuning ${path}: expected an object of tuning keys to values`);
  }
  return parsed as TuningOverrides;
}

/** Resolves the tuning once up front so a bad key fails before any game runs. */
export function checkOverrides(setup: NewGameSetup, overrides: TuningOverrides, path: string | null): void {
  try {
    resolveTuning(setup, overrides);
  } catch (e) {
    if (e instanceof TuningError) throw new CliExit(EXIT_USAGE, `--tuning ${path ?? ''}: ${e.message}`);
    throw e;
  }
}

export interface CellRequest {
  cell: CellSetup;
  bot: BotSpec;
  rulesPhase: RulesPhase;
  overrides: TuningOverrides;
  years: number;
  seedBase: number;
  games: number;
}

export function cellRunSpec(req: CellRequest): CellRunSpec {
  return {
    cell: req.cell,
    setup: setupForCell(req.cell),
    bot: req.bot,
    botLabel: botLabel(req.bot),
    rulesPhase: req.rulesPhase,
    overrides: req.overrides,
    years: req.years,
    seedBase: req.seedBase,
    games: req.games,
    sampleGames: Math.min(req.games, simConfig['sim.weeklySampleSeeds']),
  };
}

export interface PlayedCell {
  run: CellRun;
  summary: CellSummary;
}

/** Plays a cell and aggregates it (BALANCE §6.6 metrics, seeded by the cell's label). */
export async function playCell(pool: SimPool, spec: CellRunSpec): Promise<PlayedCell> {
  const run = await runCell(pool, spec);
  const label = cellLabel({ bot: spec.botLabel, ...spec.cell, rules: spec.rulesPhase });
  const metrics = aggregateCell(run.results, spec.years, { cellKey: `${label}|${spec.seedBase}` });
  return { run, summary: cellSummary(run, metrics) };
}
