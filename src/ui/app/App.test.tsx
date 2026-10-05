// The P0 shell end to end in jsdom (DESIGN §13.24 P0 row): navigation, top bar, Advance, Settings applying the theme,
// the new-game stub, the Saves screen on a memory store, and T28's DOM rules on every shell screen in both themes.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createMemoryKv, createSaveStore, type LoadedSave, type SaveStore } from '../../persistence';
import { fixtureCodec, fixtureSave } from '../../persistence/testFixtures';
import { createUiStore, type UiStore } from '../store/store';
import { App } from './App';
import type { DownloadableFile } from './files';
import type { NewGameInput, SavesController, ShellStatus } from './shellModel';
import { StubGameApp, stubCodec } from './stubGame';

const STATUS: ShellStatus = {
  company: { name: 'Hardrock Gulch Mining LLC', entityBadge: 'LLC' },
  date: { turn: 20, label: 'Y1 Wk 21 · May 21–27, 2027' },
  cash: { cents: 41_230_000, label: '$412,300' },
  save: { kind: 'saved', label: 'Saved Wk 21' },
  advance: { enabled: true, tooltip: 'Advance to Wk 22 · May 28–Jun 3' },
};

function go(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function memoryPrefs() {
  const data: Record<string, string> = {};
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}

interface Harness {
  uiStore: UiStore;
  saveStore: SaveStore;
  onAdvanceWeek: Mock<() => void>;
  onNewGame: Mock<(input: NewGameInput) => void>;
  onLoaded: Mock<(loaded: LoadedSave) => void>;
  download: Mock<(file: DownloadableFile) => void>;
}

function renderApp(status: ShellStatus | null = STATUS, current = fixtureSave({ turn: 20 })): Harness {
  const uiStore = createUiStore({ storage: memoryPrefs() });
  const saveStore = createSaveStore({ kv: createMemoryKv(), codec: fixtureCodec });
  const h: Harness = {
    uiStore,
    saveStore,
    onAdvanceWeek: vi.fn<() => void>(),
    onNewGame: vi.fn<(input: NewGameInput) => void>(),
    onLoaded: vi.fn<(loaded: LoadedSave) => void>(),
    download: vi.fn<(file: DownloadableFile) => void>(),
  };
  const saves: SavesController = {
    store: saveStore,
    ironman: false,
    currentSave: () => (status ? current : null),
    onLoaded: (l: LoadedSave) => h.onLoaded(l),
    download: (f) => h.download(f),
  };
  render(<App store={uiStore} status={status} onAdvanceWeek={h.onAdvanceWeek} onNewGame={h.onNewGame} saves={saves} />);
  return h;
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  const root = document.documentElement;
  for (const a of ['data-theme', 'data-density', 'data-grain']) root.removeAttribute(a);
  root.style.colorScheme = '';
});

describe('shell', () => {
  it('shows company, date, cash and save state in the top bar and advances through the injected callback', () => {
    const h = renderApp();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Hardrock Gulch Mining LLC')).toBeTruthy();
    expect(within(banner).getByText('LLC')).toBeTruthy();
    expect(within(banner).getByText(STATUS.date.label)).toBeTruthy();
    expect(within(banner).getByText('$412,300')).toBeTruthy();
    expect(within(banner).getByText('Saved Wk 21')).toBeTruthy();
    const advance = within(banner).getByRole('button', { name: /Advance/ });
    expect(advance.getAttribute('title')).toBe(STATUS.advance.tooltip);
    fireEvent.click(advance);
    expect(h.onAdvanceWeek).toHaveBeenCalledTimes(1);
  });

  it('disables Advance with its reason when the game cannot advance', () => {
    const h = renderApp({ ...STATUS, advance: { enabled: false, tooltip: '', disabledReason: 'Resolve 1 decision' } });
    const advance = screen.getByRole('button', { name: /Advance/ }) as HTMLButtonElement;
    expect(advance.disabled).toBe(true);
    expect(advance.title).toBe('Resolve 1 decision');
    fireEvent.click(advance);
    expect(h.onAdvanceWeek).not.toHaveBeenCalled();
  });

  it('routes between the P0 screens and marks the active nav item', () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
    go('#/saves');
    expect(screen.getByRole('heading', { level: 1, name: 'Saves' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Saves' }).getAttribute('aria-current')).toBe('page');
    go('#/settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    go('#/new');
    expect(screen.getByRole('heading', { level: 1, name: 'New game' })).toBeTruthy();
    go('#/missing');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('collapses the nav to the icon rail and keeps accessible names', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.style.width).toBe('56px');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand navigation' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the title screen with no game loaded', () => {
    renderApp(null);
    expect(screen.getByRole('heading', { level: 1, name: 'Gold Mining Tycoon' })).toBeTruthy();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'New game' }).getAttribute('href')).toBe('#/new');
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'New game' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Settings (ui/setPrefs)', () => {
  it('applies theme, density and grain to <html> as they change', () => {
    renderApp();
    go('#/settings');
    const root = document.documentElement;
    expect(root.hasAttribute('data-theme')).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Lamplight' }));
    expect(root.getAttribute('data-theme')).toBe('lamplight');
    expect(root.style.colorScheme).toBe('dark');
    fireEvent.click(screen.getByRole('radio', { name: 'Daylight' }));
    expect(root.getAttribute('data-theme')).toBe('daylight');
    expect(root.style.colorScheme).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.style.colorScheme).toBe('light dark');
    fireEvent.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(root.getAttribute('data-density')).toBe('compact');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Header grain' }));
    expect(root.getAttribute('data-grain')).toBe('off');
  });

  it('offers the dev reveal toggle in development builds', () => {
    const h = renderApp();
    go('#/settings');
    expect(import.meta.env.DEV).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Reveal hidden truth/ }));
    expect(h.uiStore.getState().devReveal).toBe(true);
    expect(within(screen.getByRole('banner')).getByText('Reveal on')).toBeTruthy();
  });
});

describe('new game stub', () => {
  it('validates name and seed, then calls the injected callback and returns to the dashboard', () => {
    const h = renderApp(null);
    go('#/new');
    const name = screen.getByRole('textbox', { name: 'Company name' });
    const seed = screen.getByRole('textbox', { name: 'World seed' });
    fireEvent.change(seed, { target: { value: '12x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(screen.getByText('Enter a company name.')).toBeTruthy();
    expect(screen.getByText(/The seed must be a whole number/)).toBeTruthy();
    expect(h.onNewGame).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: '  Ruby Creek Placers  ' } });
    fireEvent.change(seed, { target: { value: '20261005' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(h.onNewGame).toHaveBeenCalledWith({ companyName: 'Ruby Creek Placers', seed: 20261005 });
    expect(window.location.hash).toBe('#/');
  });
});

describe('Saves screen', () => {
  it('saves the current game, loads it back and exports it', async () => {
    const h = renderApp();
    go('#/saves');
    fireEvent.change(screen.getByRole('textbox', { name: 'Slot name' }), { target: { value: 'Spring camp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to new slot' }));
    await screen.findByRole('rowheader', { name: 'Spring camp' });
    expect(screen.getByRole('status').textContent).toContain('Saved to “Spring camp”.');

    fireEvent.click(screen.getByRole('button', { name: 'Load Spring camp' }));
    await waitFor(() => expect(h.onLoaded).toHaveBeenCalledTimes(1));
    expect(h.onLoaded.mock.calls[0]?.[0].save.state).toEqual(fixtureSave({ turn: 20 }).state);

    fireEvent.click(screen.getByRole('button', { name: 'Export Spring camp' }));
    await waitFor(() => expect(h.download).toHaveBeenCalledTimes(1));
    expect(h.download.mock.calls[0]?.[0]).toMatchObject({ fileName: 'spring-camp.gmt.json.gz' });
  });

  it('renames and deletes with confirmation', async () => {
    const h = renderApp();
    await h.saveStore.save(fixtureSave(), { slotName: 'Old name' });
    go('#/saves');
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Old name' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New name for Old name' }), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    await screen.findByRole('rowheader', { name: 'New name' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete New name' }));
    expect(screen.getByText('Delete “New name”?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('No saved games yet.');
  });

  it('shows an import error and changes nothing for a corrupt file', async () => {
    const h = renderApp();
    await h.saveStore.save(fixtureSave(), { slotName: 'Keep me' });
    const before = await h.saveStore.list();
    go('#/saves');
    await screen.findByRole('rowheader', { name: 'Keep me' });
    const input = screen.getByLabelText(/Import a save file/) as HTMLInputElement;
    const file = new File([new Uint8Array([0x1f, 0x8b, 0x00, 0x13])], 'broken.gmt.json.gz');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be read'));
    expect(await h.saveStore.list()).toEqual(before);
  });

  it('imports a valid file into a new slot', async () => {
    renderApp();
    go('#/saves');
    const text = JSON.stringify({ ...fixtureSave({ turn: 60 }), slotName: 'From a friend' });
    fireEvent.change(screen.getByLabelText(/Import a save file/), {
      target: { files: [new File([text], 'friend.gmt.json')] },
    });
    await screen.findByRole('rowheader', { name: 'From a friend' });
    expect(screen.getByRole('status').textContent).toContain('Imported friend.gmt.json');
  });

  it('explains why saving is unavailable without a game', () => {
    renderApp(null);
    go('#/saves');
    expect((screen.getByRole('button', { name: 'Save to new slot' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Start or load a game first.')).toBeTruthy();
  });
});

describe('placeholder game (stub until the engine client)', () => {
  it('starts a game, advances a week and autosaves it', async () => {
    const uiStore = createUiStore({ storage: memoryPrefs() });
    const saveStore = createSaveStore({ kv: createMemoryKv(), codec: stubCodec });
    render(<StubGameApp uiStore={uiStore} saveStore={saveStore} />);
    go('#/new');
    fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), { target: { value: 'Ruby Creek' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'World seed' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Y1 Wk 1')).toBeTruthy();
    fireEvent.click(within(banner).getByRole('button', { name: /Advance/ }));
    expect(within(banner).getByText('Y1 Wk 2')).toBeTruthy();
    await within(banner).findByText('Saved Wk 2');
    expect((await saveStore.latestAutosave())?.summary).toMatchObject({ company: 'Ruby Creek', year: 1, week: 2 });
  });
});

describe('T28 theme rules on the shell (both themes)', () => {
  const CONTROLS = 'input, select, textarea, button';
  const FORBIDDEN_IN_GRAIN = `[data-num], table, ${CONTROLS}, [data-status-cluster], [role="grid"], [role="dialog"]`;
  const FORBIDDEN_IN_DISPLAY = `[data-num], table, ${CONTROLS}, [role="tooltip"]`;

  function checkRules(): void {
    const grained = document.querySelectorAll('.grain, .grain-chrome');
    expect(grained.length).toBeGreaterThan(0);
    for (const el of grained) {
      expect(el.querySelector(FORBIDDEN_IN_GRAIN), `grain zone ${el.getAttribute('data-grain-zone')}`).toBeNull();
      expect(el.matches('[data-status-cluster], table, button, input')).toBe(false);
    }
    for (const el of document.querySelectorAll('[class*="display-"]')) {
      expect(el.querySelector(FORBIDDEN_IN_DISPLAY), `display element ${el.textContent}`).toBeNull();
      expect(el.matches(`${CONTROLS}, [data-num], th, td`)).toBe(false);
    }
    const cluster = document.querySelector('[data-status-cluster]');
    expect(cluster?.closest('.grain, .grain-chrome') ?? null).toBeNull();
  }

  it.each(['daylight', 'lamplight'] as const)(
    '%s: no grain or display face around numbers or controls',
    async (theme) => {
      const h = renderApp();
      h.uiStore.getState().setPrefs({ theme });
      await h.saveStore.save(fixtureSave(), { slotName: 'Slot A' });
      await h.saveStore.autosave(fixtureSave({ turn: 52 }));
      for (const hash of ['#/', '#/settings', '#/new']) {
        go(hash);
        checkRules();
      }
      go('#/saves');
      await screen.findByRole('rowheader', { name: 'Slot A' });
      checkRules();
      expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
      // Numbers are marked so the tabular-figure rule in base.css applies to every one of them.
      expect(document.querySelectorAll('[data-num]').length).toBeGreaterThan(5);
    },
  );

  it('title screen keeps its controls outside the grained band', () => {
    renderApp(null);
    checkRules();
  });
});
