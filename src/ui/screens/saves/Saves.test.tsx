// The Saves screen on the real engine codec (DESIGN §13.16, 13.21 ui/save, ui/load, ui/deleteSlot, ui/export,
// ui/import): slots table columns from SaveFile.summary, save/load/rename/delete/export, and import by picker and by
// drag-and-drop with the typed errors and notices (SAVE_CORRUPT, SAVE_FORMAT, SAVE_TOO_NEW, SAVE_MIGRATED,
// TUNING_DIFFERS). A refused file changes nothing.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  createSaveCodec,
  defaultNewGameSetup,
  newGame,
  serializeSaveFile,
  toSaveFile,
  type Migration,
  type VersionedSave,
} from '../../../engine';
import { createMemoryKv } from '../../../persistence';
import { App } from '../../app/App';
import { createHarness, freshState, loadState, type Harness } from '../../testing/harness';

vi.setConfig({ testTimeout: 60_000 });

function renderSaves(h: Harness): void {
  window.location.hash = '#/saves';
  render(<App store={h.store} services={h.services} />);
}

function pick(file: File): void {
  fireEvent.change(screen.getByLabelText(/Import a save file/), { target: { files: [file] } });
}

const saveText = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ ...JSON.parse(serializeSaveFile(toSaveFile(freshState(), { slotName: 'From a friend', savedAt: '2026-10-01T09:30:00.000Z' }))), ...over });

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('slots', () => {
  it('saves the current game, lists it with the 13.16 columns, loads it and exports it', async () => {
    const h = createHarness();
    loadState(h.client);
    h.client.advance();
    renderSaves(h);
    fireEvent.change(screen.getByRole('textbox', { name: 'Slot name' }), { target: { value: 'Spring camp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to new slot' }));
    const row = (await screen.findByRole('rowheader', { name: 'Spring camp' })).closest('tr') as HTMLElement;
    expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain('Saved to “Spring camp”.');
    const headers = within(row.closest('table') as HTMLElement)
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(headers).toEqual([
      'Slot',
      'Company',
      'In-game date',
      'Cash (USD)',
      'Net worth (USD)',
      'Saved at',
      'Rules',
      'Size',
      'Status',
      'Actions',
    ]);
    const cells = within(row).getAllByRole('cell').map((td) => td.textContent);
    expect(cells.slice(0, 4)).toEqual(['Ruby Creek Placers', 'Y1 Wk 2', '$400,000', '$520,000']);
    expect(cells[4]).toMatch(/^Oct 6, 2026, \d+:00 (AM|PM)$/);
    expect(cells[7]).toBe('Active');
    // Summary figures are exempt numbers: they belong to a save that may not be loaded.
    expect(row.querySelectorAll('[data-num-exempt="saveSummary"]')).toHaveLength(2);

    h.client.advance();
    fireEvent.click(screen.getByRole('button', { name: 'Load Spring camp' }));
    await waitFor(() => expect(h.store.getState().game.state?.clock.turn).toBe(1));
    expect(h.store.getState().game.slotId).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Export Spring camp' }));
    await waitFor(() => expect(h.downloads).toHaveLength(1));
    expect(h.downloads[0]).toMatchObject({ fileName: 'spring-camp.gmt.json.gz', mimeType: 'application/gzip' });
  });

  it('saves over a slot, renames it and deletes it after confirmation', async () => {
    const h = createHarness();
    loadState(h.client);
    await h.client.saveToSlot({ slotName: 'Old name' });
    h.client.advance();
    renderSaves(h);
    fireEvent.click(await screen.findByRole('button', { name: 'Save here: Old name' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain('Saved to “Old name”.'));
    fireEvent.click(screen.getByRole('button', { name: 'Rename Old name' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New name for Old name' }), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    await screen.findByRole('rowheader', { name: 'New name' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete New name' }));
    expect(screen.getByText('Delete “New name”?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('No saved games yet.');
  });

  it('lists autosaves and explains why saving is unavailable without a game or in Ironman', async () => {
    const h = createHarness();
    renderSaves(h);
    expect((screen.getByRole('button', { name: 'Save to new slot' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Start or load a game first.')).toBeTruthy();
    cleanup();

    const h2 = createHarness();
    loadState(h2.client);
    h2.store.getState().setPersisted({ ...h2.store.getState().persisted, ironman: true });
    h2.client.advance();
    h2.idle.flush();
    await h2.client.settled();
    renderSaves(h2);
    expect(screen.getByText('Ironman games have no manual slots.')).toBeTruthy();
    expect(await screen.findByRole('rowheader', { name: /Autosave · Ruby Creek Placers/ })).toBeTruthy();
  });
});

describe('import (13.16 validation order)', () => {
  it('imports a valid file into a new slot', async () => {
    const h = createHarness();
    renderSaves(h);
    pick(new File([saveText()], 'friend.gmt.json'));
    await screen.findByRole('rowheader', { name: 'From a friend' });
    expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain('Imported friend.gmt.json as “From a friend”.');
  });

  it('imports by drag and drop', async () => {
    const h = createHarness();
    renderSaves(h);
    const zone = screen.getByLabelText(/Import a save file/).closest('div') as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [new File([saveText()], 'dropped.gmt.json')] } });
    await screen.findByRole('rowheader', { name: 'From a friend' });
  });

  it.each([
    ['a corrupt gzip file', new Uint8Array([0x1f, 0x8b, 0x00, 0x13]), /could not be read.*Nothing was changed/],
    ['unreadable JSON', '{not json', /not valid save data.*Nothing was changed/],
    ['another program’s JSON', '{"format":"other"}', /not a Gold Mining Tycoon save file.*Nothing was changed/],
    [
      'a newer schema',
      JSON.stringify({ format: 'gmt-save', schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
      /newer version of the game.*Update the game to load it/,
    ],
  ])('shows the error for %s and changes nothing', async (_name, content, message) => {
    const kv = createMemoryKv();
    const h = createHarness({ kv });
    loadState(h.client);
    await h.client.saveToSlot({ slotName: 'Keep me' });
    const before = kv.snapshot();
    renderSaves(h);
    await screen.findByRole('rowheader', { name: 'Keep me' });
    pick(new File([content], 'bad.gmt.json'));
    await waitFor(() => expect(screen.getByRole('alert', { name: 'Problems' }).textContent).toMatch(message));
    expect(kv.snapshot()).toEqual(before);
    expect(h.store.getState().game.state?.company.name).toBe('Ruby Creek Placers');
  });

  it('notes TUNING_DIFFERS when the file keeps tuning this build would not resolve', async () => {
    const h = createHarness();
    renderSaves(h);
    const tuned = newGame(defaultNewGameSetup({ companyName: 'Tuned Co' }), 'tuned', { 'game.nw.partsResaleFactor': 0.5 });
    pick(new File([serializeSaveFile(toSaveFile(tuned, { slotName: 'Tuned', savedAt: 'x' }))], 'tuned.gmt.json'));
    await screen.findByRole('rowheader', { name: 'Tuned' });
    expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain('This game keeps the tuning it was created with.');
  });

  it('lists the migrations applied to an older file', async () => {
    const toV2: Migration = {
      from: 1,
      name: 'v1→v2 synthetic',
      migrate: (save) =>
        ({ ...save, schemaVersion: 2, state: { ...(save['state'] as object), schemaVersion: 2 } }) as VersionedSave,
    };
    const h = createHarness({ codec: createSaveCodec({ currentSchemaVersion: 2, migrations: [toV2] }) });
    renderSaves(h);
    pick(new File([saveText()], 'old.gmt.json'));
    await screen.findByRole('rowheader', { name: 'From a friend' });
    expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain('Updated from save version 1 to 2 (v1→v2 synthetic).');
  });
});
