// T14's axe part (DESIGN §13.27 T14, §13.19 WCAG 2.2 AA): zero serious or critical axe-core violations on every P0
// route, the title screen, and an open explain popover and drawer, in both themes.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { startGame, topBarCash, usePrefs } from './helpers';

async function seriousViolations(page: Page): Promise<string[]> {
  // @axe-core/playwright is typed against its own playwright-core; the page object is the same at run time.
  const options = { page } as unknown as ConstructorParameters<typeof AxeBuilder>[0];
  const results = await new AxeBuilder(options)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const theme of ['daylight', 'lamplight'] as const) {
  test.describe(`${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await usePrefs(page, { theme });
    });

    test('the title screen has no serious or critical violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: 'Gold Mining Tycoon' })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('every P0 route with a game has none', async ({ page }) => {
      await startGame(page);
      await page.keyboard.press('Control+Enter');
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Saves' }).click();
      await page.getByRole('button', { name: 'Save to new slot' }).click();
      await expect(page.getByRole('rowheader', { name: 'E2E Placers', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(theme);

      for (const [hash, heading] of [
        ['#/', 'Dashboard'],
        ['#/saves', 'Saves'],
        ['#/settings', 'Settings'],
        ['#/new', 'New game'],
      ] as const) {
        // A hash change, not a reload: the game stays loaded.
        await page.evaluate((h) => {
          window.location.hash = h;
        }, hash);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        expect(await seriousViolations(page), hash).toEqual([]);
      }
    });

    test('an open popover and drawer have none', async ({ page }) => {
      await startGame(page);
      await topBarCash(page).click();
      await expect(page.getByRole('dialog', { name: 'Cash on hand' })).toBeVisible();
      expect(await seriousViolations(page), 'popover').toEqual([]);
      await page.getByRole('button', { name: 'Open breakdown' }).click();
      await expect(page.getByRole('dialog', { name: 'Cash on hand' })).toBeVisible();
      expect(await seriousViolations(page), 'drawer').toEqual([]);
      await page.getByRole('button', { name: 'Open ledger' }).click();
      await expect(page.locator('[data-ledger-view]')).toBeVisible();
      expect(await seriousViolations(page), 'ledger view').toEqual([]);
    });
  });
}
