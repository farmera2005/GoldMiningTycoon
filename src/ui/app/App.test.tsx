// The P0 app end to end in jsdom on the real engine (DESIGN §13.24 P0 row): top bar, Advance (button and Ctrl+Enter)
// with its disabled reason, navigation, the title screen, the wizard stub, Settings, the dev reveal, and T28's DOM
// rules on every shell screen in both themes, popover and drawer open.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { asAction, registerTestActions } from '../../engine/actions/testActions';
import { select, type GameState } from '../../engine';
import { createMemoryKv, type KvStore } from '../../persistence';
import { createHarness, faultyKv, loadState, type Harness } from '../testing/harness';
import { App } from './App';

vi.setConfig({ testTimeout: 60_000 });

let unregister: () => void = () => undefined;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

function go(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function renderApp(withGame = true): Harness {
  const h = createHarness();
  if (withGame) loadState(h.client);
  render(<App store={h.store} services={h.services} />);
  return h;
}

const banner = (): HTMLElement => screen.getByRole('banner');
const advanceButton = (): HTMLButtonElement =>
  within(banner()).getByRole('button', { name: /Advance|Resolve/ }) as HTMLButtonElement;

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  const root = document.documentElement;
  for (const a of [
    'data-theme',
    'data-density',
    'data-grain',
    'data-font-scale',
    'data-reduced-motion',
    'data-texture',
  ])
    root.removeAttribute(a);
  root.style.colorScheme = '';
});

describe('top bar and Advance (13.1, 13.9, 13.15)', () => {
  it('shows company, entity badge, date, cash and save state from the engine selectors', () => {
    renderApp();
    const b = banner();
    expect(within(b).getByText('Ruby Creek Placers')).toBeTruthy();
    expect(within(b).getByText('LLC')).toBeTruthy();
    expect(within(b).getByText('Y1 Wk 1 · Jan 1–7, 2027')).toBeTruthy();
    expect(within(b).getByRole('button', { name: '$400,000' }).hasAttribute('data-num')).toBe(true);
    expect(within(b).getByText('Saved Wk 1')).toBeTruthy();
    expect(advanceButton().title).toBe('Advance to Wk 2 · Jan 8–14');
  });

  it('advances a week by button and by Ctrl+Enter, updating the date and marking unsaved changes', async () => {
    const h = renderApp();
    fireEvent.click(advanceButton());
    expect(within(banner()).getByText('Y1 Wk 2 · Jan 8–14, 2027')).toBeTruthy();
    expect(within(banner()).getByText('Unsaved changes')).toBeTruthy();
    expect(within(banner()).getByRole('button', { name: '$400,000' })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
    expect(within(banner()).getByText('Y1 Wk 3 · Jan 15–21, 2027')).toBeTruthy();
    expect(screen.getByText('Y1 Wk 3 complete: cash $0.00; 0 new alerts')).toBeTruthy();
    // The autosave runs when idle and then the dot gives way to `Saved Wk 3`.
    act(() => h.idle.flush());
    await act(() => h.client.settled());
    expect(within(banner()).getByText('Saved Wk 3')).toBeTruthy();
  });

  it('advances one week per press: holding Ctrl+Enter (key auto-repeat) does not skip weeks', () => {
    const h = renderApp();
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
    for (let i = 0; i < 10; i++) fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true, repeat: true });
    expect((h.store.getState().game.state as GameState).clock.turn).toBe(1);
    expect(within(banner()).getByText('Y1 Wk 2 · Jan 8–14, 2027')).toBeTruthy();
    // The next deliberate press advances again.
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
    expect((h.store.getState().game.state as GameState).clock.turn).toBe(2);
  });

  it('ignores Ctrl+Enter while typing in a text field', () => {
    renderApp();
    go('#/saves');
    const input = screen.getByRole('textbox', { name: 'Slot name' });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(within(banner()).getByText('Y1 Wk 1 · Jan 1–7, 2027')).toBeTruthy();
  });

  it('turns Advance into `Resolve 1 decision`, disabled with its reason, while a blocking decision is open', () => {
    const h = renderApp();
    act(() => {
      h.client.apply(asAction({ type: 'test/decide', blocking: true, deadlineInWeeks: 2, cents: 100 }));
    });
    const button = advanceButton();
    expect(button.textContent).toContain('Resolve 1 decision');
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Answer the open decision before the week can advance.');
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
    expect((h.store.getState().game.state as GameState).clock.turn).toBe(0);
  });

  it('disables Advance once the run has ended (GAME_OVER)', () => {
    const h = renderApp();
    act(() => {
      h.client.apply(asAction({ type: 'test/liquidate' }));
      h.client.advance();
    });
    expect(advanceButton().disabled).toBe(true);
    expect(advanceButton().title).toBe('The run has ended; this save is read-only.');
  });

  it('undoes the last undoable action with Ctrl+Z (D-13.11)', () => {
    const h = renderApp();
    const before = h.store.getState().game.state;
    act(() => {
      h.client.apply(asAction({ type: 'test/transfer', cents: 100_00 }));
    });
    expect(h.store.getState().game.state).not.toBe(before);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(h.store.getState().game.state).toEqual(before);
    expect(h.store.getState().game.actionLog).toEqual([]);
  });

  it('raises a critical toast with Export now when an autosave fails (13.16)', async () => {
    const memory = createMemoryKv();
    const kv: KvStore = {
      get: (k) => memory.get(k),
      keys: () => memory.keys(),
      delMany: (k) => memory.delMany(k),
      setMany: () => Promise.reject(new Error('QuotaExceededError')),
    };
    const h = createHarness({ kv });
    loadState(h.client);
    render(<App store={h.store} services={h.services} />);
    fireEvent.click(advanceButton());
    act(() => h.idle.flush());
    await act(() => h.client.settled());
    const toasts = screen.getByRole('list', { name: 'Critical notifications' });
    expect(within(toasts).getByText('Critical')).toBeTruthy();
    expect(within(toasts).getByText(/Autosave failed: .*QuotaExceededError/)).toBeTruthy();
    fireEvent.click(within(toasts).getByRole('button', { name: 'Export now' }));
    expect(h.downloads.map((d) => d.fileName)).toEqual(['ruby-creek-placers.gmt.json.gz']);
    fireEvent.click(within(toasts).getByRole('button', { name: 'Dismiss' }));
    expect(within(toasts).queryByText('Critical')).toBeNull();
  });

  it('reports a failed Ctrl+S with the critical toast and stays put, instead of opening Saves', async () => {
    const f = faultyKv();
    const h = createHarness({ kv: f.kv });
    loadState(h.client);
    await h.client.saveToSlot({ slotName: 'Camp' });
    render(<App store={h.store} services={h.services} />);
    f.broken.setMany = true;
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    const toasts = screen.getByRole('list', { name: 'Critical notifications' });
    await waitFor(() => expect(within(toasts).getByText(/^Quick save failed: .*UnknownError/)).toBeTruthy());
    expect(within(toasts).getByRole('button', { name: 'Export now' })).toBeTruthy();
    expect(window.location.hash).toBe('');
    // A held chord writes once.
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true, repeat: true });
    await act(() => h.client.settled());
    expect(h.store.getState().toasts).toHaveLength(1);
  });

  it('quick-saves with Ctrl+S, or opens Saves when the game has no slot yet', async () => {
    const h = renderApp();
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    await waitFor(() => expect(window.location.hash).toBe('#/saves'));
    await act(async () => {
      await h.client.saveToSlot({ slotName: 'Camp' });
    });
    act(() => h.client.advance());
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    await waitFor(() => expect(within(banner()).getByText('Saved Wk 2')).toBeTruthy());
  });
});

describe('navigation (13.1)', () => {
  it('routes between the P0 screens and marks the active nav item; g d goes to the dashboard', () => {
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
    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'd' });
    expect(window.location.hash).toBe('#/');
  });

  it('collapses the nav to the icon rail and keeps accessible names', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.style.width).toBe('56px');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand navigation' }).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('dashboard (13.24 P0)', () => {
  it('shows cash and owner net worth as explainable numbers, and last week once a week has run', () => {
    const h = renderApp();
    const position = screen.getByRole('region', { name: 'Position' });
    expect(within(position).getByRole('button', { name: '$400,000' })).toBeTruthy();
    expect(within(position).getByRole('button', { name: '$520,000' })).toBeTruthy();
    expect(screen.getByText(/No week has been played yet/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Operations arrive in Phase 1' })).toBeTruthy();
    act(() => h.client.advance());
    const last = screen.getByRole('region', { name: 'Last week' });
    expect(within(last).getByText('Cash at the end of Y1 Wk 2')).toBeTruthy();
    expect(within(last).getByRole('button', { name: '$400,000' })).toBeTruthy();
    fireEvent.click(within(last).getByRole('button', { name: '$0.00' }));
    expect(
      screen.getByRole('dialog', { name: 'Company ledger · cash.operating, cash.reserve · Y1 Wk 2' }),
    ).toBeTruthy();
  });

  it('says so on the title screen when saved games cannot be read, instead of waiting forever', async () => {
    const f = faultyKv();
    f.breakAll();
    const h = createHarness({ kv: f.kv });
    render(<App store={h.store} services={h.services} />);
    await waitFor(() =>
      expect(screen.getByRole('alert', { name: 'Problems' }).textContent).toMatch(
        /Autosaves could not be read.*UnknownError/,
      ),
    );
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('is the title screen with no game: Continue loads the latest autosave', async () => {
    const h = createHarness();
    loadState(h.client);
    h.client.advance();
    h.idle.flush();
    await h.client.settled();
    const fresh = createHarness({ kv: h.kv });
    render(<App store={fresh.store} services={fresh.services} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Gold Mining Tycoon' })).toBeTruthy();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'New game' }).getAttribute('href')).toBe('#/new');
    const cont = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    await waitFor(() => expect(cont.disabled).toBe(false));
    fireEvent.click(cont);
    await waitFor(() => expect(within(banner()).getByText('Y1 Wk 2 · Jan 8–14, 2027')).toBeTruthy());
  });
});

describe('new game wizard stub (13.14, 13.24 P0)', () => {
  it('shows the engine codes inline, offers a 26-char seed with Copy and New seed, then starts the game', async () => {
    const h = renderApp(false);
    go('#/new');
    const name = screen.getByRole('textbox', { name: 'Company name' });
    const seed = screen.getByRole('textbox', { name: 'World seed' }) as HTMLInputElement;
    expect(seed.value).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    const first = seed.value;
    fireEvent.click(screen.getByRole('button', { name: 'New seed' }));
    expect(seed.value).not.toBe(first);

    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await screen.findByText('Seed copied.');
    expect(writeText).toHaveBeenCalledWith(seed.value);

    fireEvent.change(seed, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(screen.getByText('Enter a company name.')).toBeTruthy();
    expect(screen.getByText(/Enter a world seed/)).toBeTruthy();
    fireEvent.change(name, { target: { value: 'x'.repeat(41) } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(screen.getByText('Keep the name to 40 characters or fewer.')).toBeTruthy();
    expect(name.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(name, { target: { value: '  Hardrock Gulch Mining  ' } });
    fireEvent.change(seed, { target: { value: 'GOLDEN-SEED-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    const state = h.store.getState().game.state as GameState;
    expect(state.company.name).toBe('Hardrock Gulch Mining');
    expect(state.meta.seed).toBe('GOLDEN-SEED-1');
    await h.client.settled();
    const latest = await h.saves.latestAutosave();
    expect(latest.ok && latest.value?.summary).toMatchObject({ company: 'Hardrock Gulch Mining', week: 1 });
    expect(select.cashOnHand(state)).toBe(40_000_000);
  });
});

describe('Settings (13.21 ui/setPrefs)', () => {
  it('applies theme, density, grain and the accessibility prefs to <html>', () => {
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Texture patterns' }));
    expect(root.getAttribute('data-texture')).toBe('on');
    fireEvent.click(screen.getByRole('radio', { name: 'Reduce motion' }));
    expect(root.getAttribute('data-reduced-motion')).toBe('on');
    fireEvent.click(screen.getByRole('radio', { name: '125%' }));
    expect(root.getAttribute('data-font-scale')).toBe('1.25');
  });

  it('lists the persisted stop rules read-only, with the default deadline notice of 2 weeks', () => {
    renderApp();
    go('#/settings');
    const table = within(screen.getByRole('region', { name: 'Stop rules' })).getByRole('table');
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent);
    expect(rows[0]).toBe('A blocking decision is createdAlways stops');
    expect(rows).toContain('A deadline within 2 weeksOn');
    expect(rows).toContain('Cash falls below $0.00Off');
    expect(rows).toContain('Gold moves from the run start by 5.0%Off');
    expect(within(table).queryAllByRole('checkbox')).toEqual([]);
  });

  it('offers the dev reveal in development builds: a DEV TRUTH banner and the raw state view', () => {
    const h = renderApp();
    go('#/settings');
    expect(import.meta.env.DEV).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Reveal hidden truth/ }));
    expect(h.store.getState().devReveal).toBe(true);
    expect(screen.getAllByText('DEV TRUTH').length).toBeGreaterThan(0);
    go('#/');
    const panel = screen.getByRole('region', { name: 'Dev truth' });
    expect(within(panel).getByText('state.world')).toBeTruthy();
    expect(within(panel).getByText('last WeekReport')).toBeTruthy();
  });
});

describe('T28 theme rules on the shell (both themes)', () => {
  const CONTROLS = 'input, select, textarea, button';
  const FORBIDDEN_IN_GRAIN = `[data-num], table, ${CONTROLS}, [data-status-cluster], [role="grid"], [role="dialog"], [data-chip]`;
  const FORBIDDEN_IN_DISPLAY = `[data-num], table, ${CONTROLS}, [role="tooltip"], [data-chip], [data-status-chip]`;

  function checkRules(): void {
    const grained = document.querySelectorAll('.grain, .grain-chrome');
    expect(grained.length).toBeGreaterThan(0);
    for (const el of grained) {
      expect(el.querySelector(FORBIDDEN_IN_GRAIN), `grain zone ${el.getAttribute('data-grain-zone')}`).toBeNull();
      expect(el.matches('[data-status-cluster], table, button, input, [data-num]')).toBe(false);
      expect(el.closest('[role="dialog"]')).toBeNull();
    }
    for (const el of document.querySelectorAll('[class*="display-"]')) {
      expect(el.querySelector(FORBIDDEN_IN_DISPLAY), `display element ${el.textContent}`).toBeNull();
      expect(el.matches(`${CONTROLS}, [data-num], th, td`)).toBe(false);
    }
    const cluster = document.querySelector('[data-status-cluster]');
    expect(cluster?.closest('.grain, .grain-chrome') ?? null).toBeNull();
  }

  it.each(['daylight', 'lamplight'] as const)(
    '%s: no grain or display face around numbers, controls, chips or dialogs',
    async (theme) => {
      const h = renderApp();
      act(() => h.store.getState().setPrefs({ theme }));
      await act(async () => {
        await h.client.saveToSlot({ slotName: 'Slot A' });
      });
      for (const hash of ['#/', '#/settings', '#/new']) {
        go(hash);
        checkRules();
      }
      go('#/saves');
      await screen.findByRole('rowheader', { name: 'Slot A' });
      checkRules();
      go('#/');
      fireEvent.click(within(banner()).getByRole('button', { name: '$400,000' }));
      checkRules();
      fireEvent.click(screen.getByRole('button', { name: 'Open breakdown' }));
      checkRules();
      expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
      expect(document.querySelectorAll('[data-num]').length).toBeGreaterThan(2);
    },
  );

  it('title screen keeps its controls outside the grained band', () => {
    renderApp(false);
    checkRules();
  });
});
