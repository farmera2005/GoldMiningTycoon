// Running one job, in any thread. The worker and the in-process pool both call this, so a game is the same code path
// whatever the worker count (D-2.12: output is identical for any worker count).
import { newGame, setEngineAutoFreeze } from '../src/engine';
import { playGame, seedFor, type Clock } from './game';
import type { Job, JobOutput } from './protocol';

let prepared = false;

/** Simulator mode for this thread: Immer auto-freeze off (CLAUDE.md "Reducers"; it never changes a result). */
export function prepareSimThread(): void {
  if (prepared) return;
  setEngineAutoFreeze(false);
  prepared = true;
}

export function runJob(job: Job, clock: Clock): JobOutput {
  prepareSimThread();
  switch (job.kind) {
    case 'game':
      return { kind: 'game', record: playGame(job.spec, job.index, clock) };
    case 'world': {
      const s = job.spec;
      const state = newGame(s.setup, seedFor(s.seedBase, job.index), s.overrides, { rulesPhase: s.rulesPhase });
      return { kind: 'world', state };
    }
  }
}
