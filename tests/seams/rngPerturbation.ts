// Stream-perturbation seam for the pipeline stream-isolation property (DESIGN §2.3 item 1, §2.14 "stream isolation":
// perturbing one stream changes no other system's outputs). Production code is untouched: a test mocks core rng with
// this module's wrapper, which salts the seed of exactly one registered stream while `perturbation.stream` names it.
// Both entry points that build a stream are wrapped: `rng` (pipeline parts and generation) and `streamState` (the
// handler context's draws, D-2.22). Usage, in the test file itself (vi.mock is hoisted):
//
//   vi.mock('../../src/engine/core/rng', async (importOriginal) => {
//     const { perturbingRng } = await import('../seams/rngPerturbation');
//     return perturbingRng(await importOriginal());
//   });
//   ...
//   const perturbed = withPerturbedStream('staff-quit', () => advanceWeek(state));
import type * as RngModule from '../../src/engine/core/rng';
import type { KeyPart } from '../../src/engine/core/rng';
import type { StreamName } from '../../src/engine/core/streams';

export interface PerturbationControl {
  /** The stream whose draws change; null = no perturbation. */
  stream: StreamName | null;
  salt: string;
  /** Streams opened while a perturbation was active (a test can check the perturbed stream was drawn at all). */
  opened: StreamName[];
}

export const perturbation: PerturbationControl = { stream: null, salt: '#perturbed', opened: [] };

/** The core rng module with its stream constructors salting the perturbed stream's seed. */
export function perturbingRng(original: typeof RngModule): typeof RngModule {
  const salted = (seed: string, stream: StreamName): string => {
    if (perturbation.stream === null) return seed;
    perturbation.opened.push(stream);
    return stream === perturbation.stream ? `${seed}${perturbation.salt}` : seed;
  };
  return {
    ...original,
    rng: (seed: string, stream: StreamName, ...keys: KeyPart[]) => original.rng(salted(seed, stream), stream, ...keys),
    streamState: (seed: string, stream: StreamName, ...keys: KeyPart[]) =>
      original.streamState(salted(seed, stream), stream, ...keys),
  };
}

/** Runs `fn` with one stream perturbed; restores the control afterwards, even on a throw. */
export function withPerturbedStream<T>(stream: StreamName, fn: () => T): T {
  perturbation.stream = stream;
  perturbation.opened = [];
  try {
    return fn();
  } finally {
    perturbation.stream = null;
  }
}
