// Messages between the runner and its workers (sim/runner.ts, sim/worker.ts). Everything is structured-clone safe.
import type { GameState, NewGameSetup, RulesPhase, TuningOverrides } from '../src/engine';
import type { CellRunSpec, GameRecord } from './game';

/** World-only jobs (DESIGN §2.12 `--world-only`): newGame for a seed, no weeks advance. */
export interface WorldRunSpec {
  readonly setup: NewGameSetup;
  readonly rulesPhase: RulesPhase;
  readonly overrides: TuningOverrides;
  readonly seedBase: number;
  readonly games: number;
}

export type Job =
  | { readonly kind: 'game'; readonly spec: CellRunSpec; readonly index: number }
  | { readonly kind: 'world'; readonly spec: WorldRunSpec; readonly index: number };

export type JobOutput =
  { readonly kind: 'game'; readonly record: GameRecord } | { readonly kind: 'world'; readonly state: GameState };

/** `runId` numbers each pool run, so a late reply from an abandoned run can never land in the next one. */
export type ToWorker =
  | { readonly type: 'job'; readonly runId: number; readonly jobId: number; readonly job: Job }
  | { readonly type: 'stop' };

export type FromWorker =
  | { readonly type: 'done'; readonly runId: number; readonly jobId: number; readonly output: JobOutput }
  | {
      readonly type: 'failed';
      readonly runId: number;
      readonly jobId: number;
      readonly message: string;
      readonly stack: string;
    };
