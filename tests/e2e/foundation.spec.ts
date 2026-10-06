// The P1 foundation in Chromium (DESIGN §13.1 navigation map and command palette, §13.15 shortcuts, §13.19 WCAG 2.2 AA,
// §13.20 / T28 theme rules): every P1 route renders with a game loaded and has no serious or critical axe violation
// in either theme, the theme rules hold on each, the palette and the shortcut sheet work by keyboard alone, and the
// nav reaches every P1 screen. Screen packages replace the placeholders; these checks keep running over the real
// screens (ui-gates extends them with the P1 fixtures).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { uiConfig } from '../../src/data/tuning/ui';
import { startGame, usePrefs } from './helpers';

const P1_ROUTES: readonly [string, string][] = [
  ['#/inbox', 'Inbox & Decisions'],
  ['#/calendar/agenda', 'Calendar'],
  ['#/claims/market', 'Claims'],
  ['#/claims/clm_000004/estimate', 'Claim clm_000004'],
  ['#/map', 'District map'],
  ['#/prospecting/programs', 'Prospecting'],
  ['#/ops/site', 'Operations'],
  ['#/equipment/market', 'Equipment'],
  ['#/staff/roster', 'Staff'],
  ['#/bank/ledger', 'Bank & loans'],
  ['#/gold/sell', 'Gold sales'],
  ['#/reports/is', 'Reports'],
  ['#/company/profile', 'Company & owner'],
  ['#/help/glossary', 'Help'],
  ['#/end', 'End of run'],
];

async function setHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

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

const CONTROLS = 'input, select, textarea, button';
const FORBIDDEN_IN_DISPLAY = `[data-num], table, ${CONTROLS}, [data-chip], [data-status-chip], [role="tooltip"]`;
const FORBIDDEN_IN_GRAIN = `[data-num], table, ${CONTROLS}, [data-status-cluster], [role="grid"], [data-chip], [data-status-chip], [role="dialog"], canvas`;

async function themeProblems(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ inDisplay, inGrain, minPx }) => {
      const problems: string[] = [];
      const describe = (el: Element): string =>
        `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        const family = (cs.fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim();
        if (family.startsWith('Besley')) {
          if (el.matches(inDisplay) || el.querySelector(inDisplay) !== null)
            problems.push(`display face around ${describe(el)}`);
          const ownText = [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
          );
          if (ownText && parseFloat(cs.fontSize) < minPx)
            problems.push(`display face at ${cs.fontSize}: ${describe(el)}`);
        }
        if (cs.backgroundImage.includes('data:image/svg+xml')) {
          if (el.matches(inGrain) || el.querySelector(inGrain) !== null) problems.push(`grain behind ${describe(el)}`);
        }
      }
      for (const el of document.querySelectorAll('[data-num]')) {
        if (!getComputedStyle(el).fontVariantNumeric.includes('tabular-nums'))
          problems.push(`proportional figures: ${describe(el)}`);
      }
      return problems;
    },
    { inDisplay: FORBIDDEN_IN_DISPLAY, inGrain: FORBIDDEN_IN_GRAIN, minPx: uiConfig['ui.theme.displayMinPx'] },
  );
}

for (const theme of ['daylight', 'lamplight'] as const) {
  test(`${theme}: every P1 route renders, passes axe and keeps the theme rules`, async ({ page }) => {
    await usePrefs(page, { theme });
    await startGame(page);
    for (const [hash, heading] of P1_ROUTES) {
      await setHash(page, hash);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(await seriousViolations(page), `${theme} ${hash}`).toEqual([]);
      expect(await themeProblems(page), `${theme} ${hash}`).toEqual([]);
    }
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    expect(await seriousViolations(page), `${theme} palette`).toEqual([]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    expect(await seriousViolations(page), `${theme} shortcut sheet`).toEqual([]);
    expect(await themeProblems(page), `${theme} shortcut sheet`).toEqual([]);
  });
}

test('the nav reaches every P1 screen and marks the current one', async ({ page }) => {
  await startGame(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [label, heading] of [
    ['Inbox', 'Inbox & Decisions'],
    ['Calendar', 'Calendar'],
    ['Claims', 'Claims'],
    ['District map', 'District map'],
    ['Prospecting', 'Prospecting'],
    ['Operations', 'Operations'],
    ['Equipment', 'Equipment'],
    ['Staff', 'Staff'],
    ['Bank & loans', 'Bank & loans'],
    ['Gold sales', 'Gold sales'],
    ['Reports', 'Reports'],
    ['Company & owner', 'Company & owner'],
    ['Help', 'Help'],
  ] as const) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }
});

test('keyboard only: the palette finds a verb and a screen, g sequences navigate, the sheet opens and closes', async ({
  page,
}) => {
  await startGame(page);
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Search screens, actions and items' });
  await expect(input).toBeFocused();
  await page.keyboard.type('sell gold');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/gold\/sell$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Gold sales' })).toBeVisible();

  await page.keyboard.press('/');
  await page.keyboard.type('ledger');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/bank\/ledger$/);

  await page.keyboard.press('g');
  await page.keyboard.press('l');
  await expect(page).toHaveURL(/#\/claims\/market$/);
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(page).toHaveURL(/#\/gold\/inventory$/);

  await page.keyboard.press('?');
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Command palette');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});
