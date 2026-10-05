// Golden replay runner (DESIGN §2.14): every recorded log must reproduce its per-week state hashes exactly.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RULES_VERSION } from '../../src/engine';
import { computeGolden, goldenLogFiles, goldenName, hashesFileFor, readHashes, readLog } from './goldens';

const files = goldenLogFiles();

describe('golden replays', () => {
  it('has at least the P0 52-week golden', () => {
    expect(files.map(goldenName)).toContain('p0-passive-52w');
  });

  for (const file of files) {
    const name = goldenName(file);
    it(`${name} reproduces its recorded per-week state hashes`, () => {
      const hashesFile = hashesFileFor(file);
      expect(existsSync(hashesFile), `${name}: no hashes file; run npm run goldens:update`).toBe(true);
      const recorded = readHashes(hashesFile);
      const actual = computeGolden(readLog(file), name);
      const firstDiff = actual.hashes.findIndex((h, i) => recorded.hashes[i]?.hash !== h.hash);
      const where = firstDiff < 0 ? 'none' : `turn ${actual.hashes[firstDiff]?.turn}`;
      expect(
        { weeks: actual.weeks, count: actual.hashes.length, firstDiff: where },
        `${name}: replay diverged (rules ${RULES_VERSION}; tuning ${actual.tuningHash} vs recorded ${recorded.tuningHash}). ` +
          'Regenerate with npm run goldens:update only for an intentional rule change.',
      ).toEqual({ weeks: recorded.weeks, count: recorded.hashes.length, firstDiff: 'none' });
    });
  }
});
