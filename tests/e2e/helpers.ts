// Shared steps for the P0 end-to-end tests (DESIGN §13.27): start a game through the wizard, move focus by Tab only,
// set a theme the way Settings stores it, and build the engine bundle that the determinism and save checks run in
// Chromium and in Node.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { build } from 'esbuild';

export const ROOT = resolve(import.meta.dirname, '../..');

/** World generation can take a while on a cold page (§3), so the first wait after Start is generous. */
export const START_TIMEOUT_MS = 60_000;

export type Theme = 'daylight' | 'lamplight' | 'system';

/** Stores prefs before the app boots, as Settings would (gmt.prefs.v1, DESIGN §13.18 Prefs). */
export async function usePrefs(page: Page, prefs: Record<string, unknown>): Promise<void> {
  await page.addInitScript((p) => {
    window.localStorage.setItem('gmt.prefs.v1', JSON.stringify(p));
  }, prefs);
}

export function topBar(page: Page): Locator {
  return page.getByRole('banner');
}

export function topBarDate(page: Page): Locator {
  return topBar(page).locator('[data-game-date]');
}

export function topBarCash(page: Page): Locator {
  return topBar(page).locator('[data-num]');
}

/** Starts a game through the wizard stub (name + seed) and waits for the dashboard. */
export async function startGame(page: Page, companyName = 'E2E Placers', seed = 'E2E-SEED-0001'): Promise<void> {
  await page.goto('/#/new');
  await page.getByRole('textbox', { name: 'Company name' }).fill(companyName);
  await page.getByRole('textbox', { name: 'World seed' }).fill(seed);
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(topBarDate(page)).toHaveText('Y1 Wk 1 · Jan 1–7, 2027', { timeout: START_TIMEOUT_MS });
  await expect(page).toHaveURL(/#\/$/);
}

/** Presses Tab until `target` has focus (a keyboard-only path); fails if it is not reachable. */
export async function tabTo(page: Page, target: Locator, maxPresses = 80): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`could not reach ${target.toString()} with Tab in ${maxPresses} presses`);
}

let iife: Promise<string> | null = null;

/** src/engine/index.ts bundled by esbuild into one IIFE that defines `GMTEngine` (DESIGN §2.2's public surface). */
export function engineBundle(): Promise<string> {
  iife ??= build({
    entryPoints: [resolve(ROOT, 'src/engine/index.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'GMTEngine',
    platform: 'neutral',
    target: 'es2022',
    // Immer reads process.env.NODE_ENV; define it as the app's production build does, so the browser (which has no
    // `process`) and Node run byte-identical code.
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    logLevel: 'silent',
  }).then((r) => {
    const out = r.outputFiles[0];
    if (out === undefined) throw new Error('esbuild produced no output');
    return out.text;
  });
  return iife;
}

/** The engine's public surface, as far as these tests use it. */
export interface EngineBundle {
  replayLog(log: unknown): { hashes: { turn: number; hash: string }[] };
  hashState(state: unknown): string;
  parseSaveFile(input: unknown): { ok: true; save: { state: unknown; ui?: unknown } } | { ok: false; error: unknown };
}

/** Evaluates the same IIFE in Node (no DOM, no Node APIs: the engine needs neither). */
export async function engineInNode(): Promise<EngineBundle> {
  const text = await engineBundle();
  return new Function(`${text}\nreturn GMTEngine;`)() as EngineBundle;
}

export function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, relative), 'utf8')) as T;
}
