// P0 exit gate (CLAUDE.md, DESIGN §2.3): a P0 game advances 52 weeks to a golden hash, identical in Node and
// Chromium. The engine is bundled once with esbuild; the same IIFE replays the recorded log in a blank Chromium page
// and in Node, and both per-week hash lists must equal tests/golden's recorded file (read at test time, so the
// integrator can regenerate the goldens without touching this test).
import { expect, test } from '@playwright/test';
import { engineBundle, engineInNode, readJson } from './helpers';

interface TurnHash {
  turn: number;
  hash: string;
}

test('the 52-week golden replay hashes identically in Chromium and in Node', async ({ page }) => {
  const log = readJson<unknown>('tests/golden/p0-passive-52w.log.json');
  const golden = readJson<{ weeks: number; hashes: TurnHash[] }>('tests/golden/p0-passive-52w.hashes.json');

  const started = Date.now();
  const node = (await engineInNode()).replayLog(log).hashes;
  const nodeMs = Date.now() - started;

  await page.setContent('<!doctype html><html><head><title>engine</title></head><body></body></html>');
  await page.addScriptTag({ content: await engineBundle() });
  const chromium = await page.evaluate((l) => {
    const engine = (globalThis as unknown as { GMTEngine: { replayLog(x: unknown): { hashes: TurnHash[] } } })
      .GMTEngine;
    const t0 = performance.now();
    const hashes = engine.replayLog(l).hashes;
    return { hashes, ms: performance.now() - t0 };
  }, log);

  test.info().annotations.push({ type: 'timing', description: `replay: Node ${nodeMs} ms, Chromium ${Math.round(chromium.ms)} ms` });
  expect(node).toHaveLength(golden.weeks + 1);
  expect(chromium.hashes).toEqual(node);
  expect(node).toEqual(golden.hashes);
});
