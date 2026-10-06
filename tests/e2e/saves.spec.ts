// T11 in the browser (DESIGN §13.27 T11, §13.16): a game saved to a slot is exported, the downloaded file imported,
// and the import exported again; both files carry the same bytes and the same state hash, read in Node through the
// engine bundle (the app exposes nothing extra for this). The imported slot then loads to the same date and cash.
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
