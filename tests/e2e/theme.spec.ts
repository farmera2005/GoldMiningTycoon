// T28 Theme rules in Chromium (DESIGN §13.27 T28, §13.20, D-13.59, D-13.60), on every P0 screen in both themes: the
// display face never sets a number, table, control, chip, button or tooltip and never renders below
// ui.theme.displayMinPx; every [data-num] computes tabular figures; grain never sits behind a number, table, control
// or the top bar's status cluster, and is absent under forced colors, high contrast, print and headerGrain off;
// data-theme and color-scheme follow Prefs.theme and `system` follows the media query; the fonts come from the build
// within ui.fonts.maxKb; swapping the fallback faces in for the real ones changes no table row height.
import { expect, test, type Page } from '@playwright/test';
import { uiConfig } from '../../src/data/tuning/ui';
import { startGame, topBarCash, usePrefs } from './helpers';

const CONTROLS = 'input, select, textarea, button';
const FORBIDDEN_IN_DISPLAY = `[data-num], table, ${CONTROLS}, [data-chip], [data-status-chip], [role="tooltip"]`;
const FORBIDDEN_IN_GRAIN = `[data-num], table, ${CONTROLS}, [data-status-cluster], [role="grid"], [data-chip], [data-status-chip], [role="dialog"], canvas`;

interface RuleReport {
  readonly problems: string[];
  readonly grained: number;
  readonly displayed: number;
  readonly nums: number;
}

async function themeRules(page: Page): Promise<RuleReport> {
  return page.evaluate(
    ({ inDisplay, inGrain, minPx }) => {
      const problems: string[] = [];
      const describe = (el: Element): string =>
        `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${[...el.classList].slice(0, 3).join('.')} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      const ownText = (el: Element): boolean =>
        [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      let grained = 0;
      let displayed = 0;
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        const family = (cs.fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim();
        if (family.startsWith('Besley')) {
          displayed += 1;
          if (el.matches(inDisplay) || el.querySelector(inDisplay) !== null) problems.push(`display face on/around ${describe(el)}`);
          if (ownText(el) && parseFloat(cs.fontSize) < minPx) problems.push(`display face at ${cs.fontSize}: ${describe(el)}`);
        }
        if (cs.backgroundImage.includes('data:image/svg+xml')) {
          grained += 1;
          if (el.matches(inGrain) || el.querySelector(inGrain) !== null) problems.push(`grain behind ${describe(el)}`);
        }
      }
      const nums = document.querySelectorAll('[data-num]');
      for (const el of nums) {
        if (!getComputedStyle(el).fontVariantNumeric.includes('tabular-nums')) problems.push(`proportional figures: ${describe(el)}`);
      }
      return { problems, grained, displayed, nums: nums.length };
    },
    { inDisplay: FORBIDDEN_IN_DISPLAY, inGrain: FORBIDDEN_IN_GRAIN, minPx: uiConfig['ui.theme.displayMinPx'] },
  );
}

async function setHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

/** Every P0 screen with a game loaded (plus the open popover and drawer), checked by `check`. */
async function eachScreen(page: Page, check: (where: string) => Promise<void>): Promise<void> {
  for (const [hash, heading] of [
    ['#/', 'Dashboard'],
    ['#/saves', 'Saves'],
    ['#/settings', 'Settings'],
    ['#/new', 'New game'],
  ] as const) {
    await setHash(page, hash);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await check(hash);
  }
  await setHash(page, '#/');
  await topBarCash(page).click();
  await expect(page.getByRole('dialog', { name: 'Cash on hand' })).toBeVisible();
  await check('popover');
  await page.getByRole('button', { name: 'Open breakdown' }).click();
  await expect(page.locator('[data-explain-drawer]')).toBeVisible();
  await check('drawer');
  await page.keyboard.press('Escape');
}

async function withSavedGame(page: Page): Promise<void> {
  await startGame(page);
  await page.keyboard.press('Control+Enter');
  await setHash(page, '#/saves');
  await page.getByRole('button', { name: 'Save to new slot' }).click();
  await expect(page.getByRole('rowheader', { name: 'E2E Placers', exact: true })).toBeVisible();
}

for (const theme of ['daylight', 'lamplight'] as const) {
  test(`${theme}: display face, tabular figures and grain placement on every screen`, async ({ page }) => {
    await usePrefs(page, { theme });
    await page.goto('/');
    const title = await themeRules(page);
    expect(title.problems, 'title screen').toEqual([]);
    expect(title.grained).toBeGreaterThan(0);

    await withSavedGame(page);
    await eachScreen(page, async (where) => {
      const r = await themeRules(page);
      expect(r.problems, where).toEqual([]);
      expect(r.grained, where).toBeGreaterThan(0);
      expect(r.displayed, where).toBeGreaterThan(0);
      expect(r.nums, where).toBeGreaterThan(0);
    });
    const root = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      scheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    expect(root).toEqual({ theme, scheme: theme === 'lamplight' ? 'dark' : 'light' });
  });
}

test('grain is absent under forced colors, high contrast, print and headerGrain off', async ({ page }) => {
  await withSavedGame(page);
  await setHash(page, '#/');
  expect((await themeRules(page)).grained).toBeGreaterThan(0);
  await page.emulateMedia({ forcedColors: 'active' });
  expect((await themeRules(page)).grained, 'forced-colors').toBe(0);
  await page.emulateMedia({ forcedColors: 'none', contrast: 'more' });
  expect((await themeRules(page)).grained, 'prefers-contrast: more').toBe(0);
  await page.emulateMedia({ contrast: 'no-preference', media: 'print' });
  expect((await themeRules(page)).grained, 'print').toBe(0);
  await page.emulateMedia({ media: 'screen' });
  expect((await themeRules(page)).grained).toBeGreaterThan(0);
  await setHash(page, '#/settings');
  await page.getByRole('checkbox', { name: 'Header grain' }).click();
  await eachScreen(page, async (where) => {
    expect((await themeRules(page)).grained, `headerGrain off: ${where}`).toBe(0);
  });
});

test('data-theme and color-scheme follow Prefs.theme, and System follows the media query', async ({ page }) => {
  const surface0 = (): Promise<string> =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim());
  const scheme = (): Promise<string> => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  const dataTheme = (): Promise<string | null> => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/settings');
  expect(await dataTheme()).toBeNull();
  expect(await scheme()).toBe('light dark');
  expect(await surface0()).toBe('#14110d');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await surface0()).toBe('#f1ebdf');

  await page.getByRole('radio', { name: 'Lamplight' }).check();
  expect([await dataTheme(), await scheme(), await surface0()]).toEqual(['lamplight', 'dark', '#14110d']);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('radio', { name: 'Daylight' }).check();
  // An explicit choice beats the OS setting.
  expect([await dataTheme(), await scheme(), await surface0()]).toEqual(['daylight', 'light', '#f1ebdf']);
  await page.reload();
  expect(await dataTheme()).toBe('daylight');
});

test('fonts come from the build within ui.fonts.maxKb; the fallback faces keep every table row height', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
  const foreign: string[] = [];
  const fonts: { url: string; bytes: number }[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('data:') && new URL(url).origin !== origin) foreign.push(url);
  });
  page.on('response', async (r) => {
    if (r.request().resourceType() === 'font') fonts.push({ url: r.url(), bytes: (await r.body()).length });
  });

  await withSavedGame(page);
  await eachScreen(page, async () => undefined);
  await setHash(page, '#/saves');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.evaluate(() => document.fonts.check('600 16px Besley') && document.fonts.check('14px Inter'))).toBe(
    true,
  );

  expect(foreign).toEqual([]);
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) expect(new URL(f.url).origin).toBe(origin);
  const totalBytes = fonts.reduce((sum, f) => sum + f.bytes, 0);
  expect(totalBytes).toBeLessThanOrEqual(uiConfig['ui.fonts.maxKb'] * 1000);
  test.info().annotations.push({ type: 'fonts', description: `${fonts.length} files, ${totalBytes} bytes` });

  const rowHeights = (): Promise<number[]> =>
    page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((tr) => tr.getBoundingClientRect().height));
  const real = await rowHeights();
  expect(real.length).toBeGreaterThan(0);
  await page.addStyleTag({
    content: `:root { --font-sans: 'Inter Fallback', sans-serif; --font-display: 'Besley Fallback', serif; }
      * { font-family: 'Inter Fallback', sans-serif !important; }
      .display-title, .display-section, .display-panel, .display-title-screen { font-family: 'Besley Fallback', serif !important; }`,
  });
  expect(await rowHeights()).toEqual(real);
});
