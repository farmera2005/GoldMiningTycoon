// T11 in the browser (DESIGN §13.27 T11, §13.16): a game saved to a slot is exported, the downloaded file imported,
// and the import exported again; both files carry the same bytes and the same state hash, read in Node through the
// engine bundle (the app exposes nothing extra for this). The imported slot then loads to the same date and cash.
// Also, in a real browser: Rename and Delete keep keyboard focus (13.19), and blocked IndexedDB surfaces every
// failure (13.16).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { engineInNode, startGame, topBarCash, topBarDate } from './helpers';

async function download(page: Page, exportButton: ReturnType<Page['getByRole']>): Promise<Buffer> {
  const [file] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  const path = await file.path();
  return readFileSync(path);
}

test('export → import → export round-trips the save byte for byte with the same state hash', async ({ page }) => {
  await startGame(page, 'Round Trip Mining', 'ROUND-TRIP-SEED');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Control+Enter');
  await expect(topBarDate(page)).toHaveText('Y1 Wk 3 · Jan 15–21, 2027');
  const cash = await topBarCash(page).textContent();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Saves' }).click();
  await page.getByRole('textbox', { name: 'Slot name' }).fill('Round trip');
  await page.getByRole('button', { name: 'Save to new slot' }).click();
  await expect(page.getByRole('rowheader', { name: 'Round trip', exact: true })).toHaveCount(1);

  const first = await download(page, page.getByRole('button', { name: 'Export Round trip', exact: true }));
  expect(first[0]).toBe(0x1f); // gzip by default (§2.9 save.exportGzip)

  await page.getByLabel(/Import a save file/).setInputFiles({
    name: 'round-trip.gmt.json.gz',
    mimeType: 'application/gzip',
    buffer: first,
  });
  await expect(page.getByRole('status', { name: 'Notices' })).toContainText('Imported round-trip.gmt.json.gz');
  await expect(page.getByRole('rowheader', { name: 'Round trip', exact: true })).toHaveCount(2);

  // Slots list newest first, so the first Export is the imported copy.
  const second = await download(page, page.getByRole('button', { name: 'Export Round trip', exact: true }).first());
  const a = gunzipSync(first).toString('utf8');
  const b = gunzipSync(second).toString('utf8');
  expect(b).toBe(a);

  const engine = await engineInNode();
  const pa = engine.parseSaveFile(a);
  const pb = engine.parseSaveFile(b);
  if (!pa.ok || !pb.ok) throw new Error('the exported files do not parse');
  expect(engine.hashState(pb.save.state)).toBe(engine.hashState(pa.save.state));
  expect(JSON.stringify(pb.save.ui)).toBe(JSON.stringify(pa.save.ui));

  // The imported copy loads to the same game.
  await page.keyboard.press('Control+Enter');
  await expect(topBarDate(page)).toHaveText('Y1 Wk 4 · Jan 22–28, 2027');
  await page.getByRole('button', { name: 'Load Round trip', exact: true }).first().click();
  await expect(topBarDate(page)).toHaveText('Y1 Wk 3 · Jan 15–21, 2027');
  await expect(topBarCash(page)).toHaveText(cash ?? '');
});

test('Rename and Delete keep keyboard focus off <body> (13.19)', async ({ page }) => {
  await startGame(page, 'Focus Placers', 'FOCUS-SEED');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Saves' }).click();
  for (const name of ['Older', 'Newer']) {
    await page.getByRole('textbox', { name: 'Slot name' }).fill(name);
    await page.getByRole('textbox', { name: 'Slot name' }).press('Enter');
    await expect(page.getByRole('rowheader', { name, exact: true })).toHaveCount(1);
  }
  const focusedLabel = (): Promise<string | null> =>
    page.evaluate(() =>
      document.activeElement === document.body
        ? '<body>'
        : (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? null),
    );

  await page.getByRole('button', { name: 'Rename Older', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'New name for Older' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Oldest');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('rowheader', { name: 'Oldest', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Rename Oldest', exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'Delete Newer', exact: true }).focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('group', { name: 'Delete Newer?' });
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Delete Newer', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab'); // from Cancel to the destructive Delete
  await expect(confirm.getByRole('button', { name: 'Delete', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await focusedLabel()).not.toBe('<body>');
  await expect(page.getByRole('rowheader', { name: 'Newer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load Oldest', exact: true })).toBeFocused();
});

test('blocked IndexedDB: autosave failure raises Export now, and Saves shows the error instead of hanging (13.16)', async ({
  page,
}) => {
  // As a browser with blocked or corrupted site storage does: every open request fails.
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function open(): IDBOpenDBRequest {
      const request = { error: new DOMException('Internal error opening backing store', 'UnknownError') } as {
        error: DOMException;
        onerror?: (() => void) | null;
      };
      setTimeout(() => request.onerror?.(), 0);
      return request as unknown as IDBOpenDBRequest;
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert', { name: 'Problems' })).toContainText('Autosaves could not be read');
  await startGame(page, 'Blocked Storage Placers', 'BLOCKED-SEED');
  const toasts = page.getByRole('list', { name: 'Critical notifications' });
  await expect(toasts).toContainText(/Autosave failed: .*UnknownError/);
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    toasts.getByRole('button', { name: 'Export now' }).first().click(),
  ]);
  expect(file.suggestedFilename()).toBe('blocked-storage-placers.gmt.json.gz');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Saves' }).click();
  await expect(page.getByRole('alert', { name: 'Problems' })).toContainText('Saved games could not be read');
  await expect(page.getByText('Reading saves…')).toHaveCount(0);
  const save = page.getByRole('button', { name: 'Save to new slot' });
  await save.click();
  await expect(page.getByRole('alert', { name: 'Problems' })).toContainText('The save could not be written');
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');
  await expect(save).toBeEnabled();
});

test('a corrupt file shows its error and changes nothing', async ({ page }) => {
  await page.goto('/#/saves');
  await page.getByLabel(/Import a save file/).setInputFiles({
    name: 'broken.gmt.json.gz',
    mimeType: 'application/gzip',
    buffer: Buffer.from([0x1f, 0x8b, 0x00, 0x13]),
  });
  await expect(page.getByRole('alert', { name: 'Problems' })).toContainText('could not be read');
  await expect(page.getByText('No saved games yet.')).toBeVisible();
});
