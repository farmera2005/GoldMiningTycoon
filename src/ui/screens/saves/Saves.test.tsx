// The Saves screen on the real engine codec (DESIGN §13.16, 13.21 ui/save, ui/load, ui/deleteSlot, ui/export,
// ui/import): slots table columns from SaveFile.summary, save/load/rename/delete/export, and import by picker and by
// drag-and-drop with the typed errors and notices (SAVE_CORRUPT, SAVE_FORMAT, SAVE_TOO_NEW, SAVE_MIGRATED,
// TUNING_DIFFERS). A refused file changes nothing. Storage failures show their error and never leave the screen busy;
// keyboard focus follows Rename and Delete and never drops to <body> (13.19).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { createHarness, faultyKv, freshState, loadState, type Harness } from '../../testing/harness';

vi.setConfig({ testTimeout: 60_000 });

function renderSaves(h: Harness): void {
  window.location.hash = '#/saves';
  render(<App store={h.store} services={h.services} />);
}

function pick(file: File): void {
  fireEvent.change(screen.getByLabelText(/Import a save file/), { target: { files: [file] } });
}

const saveText = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    ...JSON.parse(
      serializeSaveFile(toSaveFile(freshState(), { slotName: 'From a friend', savedAt: '2026-10-01T09:30:00.000Z' })),
    ),
    ...over,
  });

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
    const cells = within(row)
      .getAllByRole('cell')
      .map((td) => td.textContent);
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
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain('Saved to “Old name”.'),
    );
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
    expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain(
      'Imported friend.gmt.json as “From a friend”.',
    );
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
    const tuned = newGame(defaultNewGameSetup({ companyName: 'Tuned Co' }), 'tuned', {
      'game.nw.partsResaleFactor': 0.5,
    });
    pick(new File([serializeSaveFile(toSaveFile(tuned, { slotName: 'Tuned', savedAt: 'x' }))], 'tuned.gmt.json'));
    await screen.findByRole('rowheader', { name: 'Tuned' });
    expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain(
      'This game keeps the tuning it was created with.',
    );
  });

  it('lists the migrations applied to an older file', async () => {
    const toV3: Migration = {
      from: 2,
      name: 'v2→v3 synthetic',
      migrate: (save) =>
        ({ ...save, schemaVersion: 3, state: { ...(save['state'] as object), schemaVersion: 3 } }) as VersionedSave,
    };
    const h = createHarness({ codec: createSaveCodec({ currentSchemaVersion: 3, migrations: [toV3] }) });
    renderSaves(h);
    pick(new File([saveText()], 'old.gmt.json'));
    await screen.findByRole('rowheader', { name: 'From a friend' });
    expect(screen.getByRole('status', { name: 'Notices' }).textContent).toContain(
      'Updated from save version 2 to 3 (v2→v3 synthetic).',
    );
  });
});

describe('storage failures (13.16): the error shows and the screen never stays busy', () => {
  const problems = (): string => screen.getByRole('alert', { name: 'Problems' }).textContent ?? '';
  const isInert = (b: HTMLElement): boolean =>
    (b as HTMLButtonElement).disabled || b.getAttribute('aria-disabled') === 'true';

  it('shows a read failure instead of “Reading saves…” forever', async () => {
    const f = faultyKv();
    f.breakAll();
    const h = createHarness({ kv: f.kv });
    renderSaves(h);
    await waitFor(() =>
      expect(problems()).toMatch(/^Saved games could not be read \(UnknownError: .*\)\. The browser may be blocking/),
    );
    expect(screen.queryByText('Reading saves…')).toBeNull();
    expect(screen.getByText('Saved games could not be read.')).toBeTruthy();
    expect(screen.getByText('Autosaves could not be read.')).toBeTruthy();
  });

  it('reports failed save, load and import operations and re-enables the controls; recovers with storage', async () => {
    const f = faultyKv();
    const h = createHarness({ kv: f.kv });
    loadState(h.client);
    await h.client.saveToSlot({ slotName: 'Camp' });
    renderSaves(h);
    await screen.findByRole('rowheader', { name: 'Camp' });
    const before = f.memory.snapshot();
    f.breakAll();

    const save = screen.getByRole('button', { name: 'Save to new slot' });
    fireEvent.click(save);
    await waitFor(() => expect(problems()).toMatch(/The save could not be written \(UnknownError/));
    await waitFor(() => expect(isInert(save)).toBe(false));

    const load = screen.getByRole('button', { name: 'Load Camp' });
    fireEvent.click(load);
    await waitFor(() => expect(problems()).toMatch(/The save could not be read \(UnknownError/));
    await waitFor(() => expect(isInert(load)).toBe(false));

    pick(new File([saveText()], 'friend.gmt.json'));
    await waitFor(() => expect(problems()).toMatch(/The file could not be stored \(UnknownError/));
    expect(f.memory.snapshot()).toEqual(before);
    expect(h.store.getState().game.state?.company.name).toBe('Ruby Creek Placers');

    f.breakAll(false);
    fireEvent.click(save);
    await screen.findByText('Saved to “Ruby Creek Placers”.');
    expect(problems()).toBe('');
  });

  it('keeps the typed error of a failed load: a missing slot and a save from a newer build', async () => {
    const kv = createMemoryKv();
    const h = createHarness({ kv });
    loadState(h.client);
    const gone = await h.client.saveToSlot({ slotName: 'Gone' });
    const newer = await h.client.saveToSlot({ slotName: 'Newer' });
    if (!gone.ok || !newer.ok) throw new Error('save failed');
    const key = `slot/${newer.value.slotId}/text`;
    const text = (await kv.get(key)) as string;
    await kv.setMany([[key, JSON.stringify({ ...JSON.parse(text), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })]]);
    renderSaves(h);
    await screen.findByRole('rowheader', { name: 'Gone' });
    await kv.delMany([`slot/${gone.value.slotId}/text`]);
    act(() => {
      h.client.advance();
    });
    const state = h.store.getState().game.state;

    fireEvent.click(screen.getByRole('button', { name: 'Load Gone' }));
    await waitFor(() => expect(problems()).toBe('That save slot no longer exists.'));
    fireEvent.click(screen.getByRole('button', { name: 'Load Newer' }));
    await waitFor(() =>
      expect(problems()).toMatch(
        /^This save was made by a newer version of the game .* Update the game to load it\. Nothing was changed\.$/,
      ),
    );
    expect(problems()).not.toMatch(/could not be read/);
    expect(h.store.getState().game.state).toBe(state);
  });
});

describe('keyboard focus (13.19): never dropped to <body>', () => {
  async function twoSlots(): Promise<Harness> {
    const h = createHarness();
    loadState(h.client);
    await h.client.saveToSlot({ slotName: 'Older' });
    await h.client.saveToSlot({ slotName: 'Newer' });
    renderSaves(h);
    await screen.findByRole('rowheader', { name: 'Older' });
    return h;
  }

  it('moves focus into Rename and back to its trigger after Cancel, Esc or a rename', async () => {
    await twoSlots();
    const trigger = (name: string): HTMLElement => screen.getByRole('button', { name: `Rename ${name}` });
    trigger('Older').focus();
    fireEvent.click(trigger('Older'));
    const input = screen.getByRole('textbox', { name: 'New name for Older' });
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(trigger('Older'));

    fireEvent.click(trigger('Older'));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New name for Older' }), { key: 'Escape' });
    expect(document.activeElement).toBe(trigger('Older'));

    fireEvent.click(trigger('Older'));
    fireEvent.change(screen.getByRole('textbox', { name: 'New name for Older' }), { target: { value: 'Oldest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    // While the rename is written the trigger keeps focus (inert, not disabled).
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Rename Older');
    await screen.findByRole('rowheader', { name: 'Oldest' });
    expect(document.activeElement).toBe(trigger('Oldest'));
  });

  it('moves focus into the delete confirmation, back on Cancel, and to the next row after a delete', async () => {
    await twoSlots();
    const del = (name: string): HTMLElement => screen.getByRole('button', { name: `Delete ${name}` });
    const confirm = (name: string): HTMLElement =>
      within(screen.getByRole('group', { name: `Delete ${name}?` })).getByRole('button', { name: 'Delete' });
    del('Newer').focus();
    fireEvent.click(del('Newer'));
    const cancel = within(screen.getByRole('group', { name: 'Delete Newer?' })).getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: 'Escape' });
    expect(document.activeElement).toBe(del('Newer'));

    // Newer is listed first; once it is gone, focus lands on the row that took its place.
    fireEvent.click(del('Newer'));
    fireEvent.click(confirm('Newer'));
    expect(document.activeElement).not.toBe(document.body);
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Newer' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Load Older' })));

    fireEvent.click(del('Older'));
    fireEvent.click(confirm('Older'));
    await screen.findByText('No saved games yet.');
    expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Saved games list' }));
  });

  it('offers Delete on autosaves too, so an abandoned game’s autosaves can be cleared', async () => {
    const h = createHarness();
    loadState(h.client);
    h.client.advance();
    h.idle.flush();
    await h.client.settled();
    renderSaves(h);
    await screen.findByRole('rowheader', { name: /Autosave · Ruby Creek Placers/ });
    const autosaves = screen.getByRole('region', { name: 'Autosaves table' });
    fireEvent.click(within(autosaves).getByRole('button', { name: 'Delete Ruby Creek Placers' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete Ruby Creek Placers?' })).getByRole('button', { name: 'Delete' }),
    );
    await screen.findByText('Autosaves appear after the first week is played.');
    const listed = await h.saves.list();
    expect(listed.ok && listed.value).toEqual([]);
  });
});
