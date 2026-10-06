// P0 smoke and keyboard path (DESIGN §13.24 P0, §13.15, §13.19 "everything works by keyboard"): new game → advance
// three weeks → save to a slot → reload → load → same date and cash, every step by keyboard. Also: formatting stays
// en-US in a de-DE browser (T1, D-13.12), and the production build has no dev reveal (D-13.41).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { ROOT, START_TIMEOUT_MS, startGame, tabTo, topBarCash, topBarDate } from './helpers';

test('keyboard path: new game, advance 3 weeks, save, reload, load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Gold Mining Tycoon' })).toBeVisible();

  // Title screen → wizard.
  await tabTo(page, page.getByRole('main').getByRole('link', { name: 'New game' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'New game' })).toBeVisible();
  await tabTo(page, page.getByRole('textbox', { name: 'Company name' }));
  await page.keyboard.type('Keyboard Placers');
  await tabTo(page, page.getByRole('textbox', { name: 'World seed' }));
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('KEYBOARD-SEED');
  await page.keyboard.press('Enter'); // submits the form
  await expect(topBarDate(page)).toHaveText('Y1 Wk 1 · Jan 1–7, 2027', { timeout: START_TIMEOUT_MS });
  const cash = await topBarCash(page).textContent();
  expect(cash).toBe('$400,000');

  // Ctrl+Enter advances (13.15); focus is no longer in a text field once the wizard has gone.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+Enter');
  await expect(topBarDate(page)).toHaveText('Y1 Wk 4 · Jan 22–28, 2027');
  await expect(page.getByRole('status').filter({ hasText: 'Y1 Wk 4 complete' })).toHaveCount(1);

  // Explain by keyboard: E opens the popover on the focused number, Esc returns focus to it.
  await tabTo(page, topBarCash(page));
  await page.keyboard.press('e');
  const popover = page.getByRole('dialog', { name: 'Cash on hand' });
  await expect(popover).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(topBarCash(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(popover).toBeVisible();
  await page.keyboard.press('Escape');

  // Save to a slot from the Saves screen.
  await tabTo(page, page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Saves' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Saves' })).toBeVisible();
  await tabTo(page, page.getByRole('textbox', { name: 'Slot name' }));
  await page.keyboard.type('Keyboard camp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('rowheader', { name: 'Keyboard camp', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Saved Wk 4')).toBeVisible();

  // Reload: the game is gone from memory, the slot is in IndexedDB.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Saves' })).toBeVisible();
  await expect(topBarDate(page)).toHaveCount(0);
  await tabTo(page, page.getByRole('button', { name: 'Load Keyboard camp', exact: true }));
  await page.keyboard.press('Enter');
  await expect(topBarDate(page)).toHaveText('Y1 Wk 4 · Jan 22–28, 2027');
  await expect(topBarCash(page)).toHaveText(cash ?? '');
  await expect(page.getByRole('status', { name: 'Notices' })).toContainText('Loaded “Keyboard camp”.');
});

test.describe('a de-DE browser', () => {
  test.use({ locale: 'de-DE' });

  test('still formats en-US (D-13.12)', async ({ page }) => {
    await startGame(page);
    expect(await page.evaluate(() => [navigator.language, (1234.5).toLocaleString()])).toEqual(['de-DE', '1.234,5']);
    await expect(topBarCash(page)).toHaveText('$400,000');
    await expect(topBarDate(page)).toHaveText('Y1 Wk 1 · Jan 1–7, 2027');
    await expect(page.getByRole('region', { name: 'Position' })).toContainText('$520,000');
  });
});

test('the production build has no dev reveal (D-13.41)', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Developer' })).toHaveCount(0);
  await expect(page.getByText(/Reveal hidden truth/)).toHaveCount(0);
  const assets = resolve(ROOT, 'dist/assets');
  const scripts = readdirSync(assets).filter((f) => f.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const f of scripts) {
    const text = readFileSync(resolve(assets, f), 'utf8');
    expect(text, f).not.toContain('DEV TRUTH');
    expect(text, f).not.toContain('Reveal hidden truth');
  }
});
