// Pipeline stream isolation (DESIGN §2.3 item 1, §2.14): perturbing one registered stream changes no other system's
// outputs. The P0/frame pipeline draws on no stream, so perturbing any stream must leave whole weeks byte-identical;
// as owners add draws, this test (extended by the cross-cutting package) checks that only the perturbed owner's
// fields move. A positive control proves the seam is live: perturbing world generation changes the world.
import { describe, expect, it, vi } from 'vitest';
import { advanceWeek, defaultNewGameSetup, hashState, newGame, type GameState } from '../../src/engine';
import { STREAMS, type StreamName } from '../../src/engine/core/streams';
import { perturbation, withPerturbedStream } from './rngPerturbation';

vi.mock('../../src/engine/core/rng', async (importOriginal) => {
  const { perturbingRng } = await import('./rngPerturbation');
  return perturbingRng(await importOriginal());
});

vi.setConfig({ testTimeout: 120_000 });

const SETUP = defaultNewGameSetup({ companyName: 'Isolation Placers' });
const START = newGame(SETUP, 'isolation');

function hashesOver(state: GameState, weeks: number): string[] {
  const out: string[] = [];
  let s = state;
  for (let i = 0; i < weeks; i++) {
    s = advanceWeek(s, { explain: true }).state;
    out.push(hashState(s));
  }
  return out;
}

describe('pipeline stream isolation (§2.14)', () => {
  it('the seam is live: perturbing world generation changes the world', () => {
    const perturbed = withPerturbedStream('world', () => newGame(SETUP, 'isolation'));
    expect(perturbation.opened).toContain('world');
    expect(hashState(perturbed)).not.toBe(hashState(START));
  });

  it('perturbing any one stream leaves the frame pipeline’s weeks unchanged', () => {
    const plain = hashesOver(START, 4);
    for (const stream of Object.keys(STREAMS) as StreamName[]) {
      expect(
        withPerturbedStream(stream, () => hashesOver(START, 4)),
        stream,
      ).toEqual(plain);
    }
  });
});
