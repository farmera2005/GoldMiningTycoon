// The P1 shell (DESIGN §13.1 navigation map and command palette, §13.15 shortcuts, §13.20 / T28 theme rules; S13-17,
// T24's palette part): every P1 route renders (a placeholder until its screen lands) with its route tabs, the nav marks
// the right item, `g` sequences reach every P1 screen, Ctrl+K and `/` open a palette that only navigates, and `?` opens
// the shortcut sheet; theme rules hold on every new screen in both themes.
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../engine';
import { createHarness, freshState } from '../testing/harness';
import { goTo, renderScreen } from '../testing/render';
import { NAV_MAP, visibleNav } from './nav';
import {
  entityItems,
  idItem,
  paletteEntities,
  PALETTE_VERBS,
  screenItems,
  searchPalette,
  verbItems,
  type PaletteEntity,
} from './palette';
import { parseRoute, routeHref, type KnownRoute } from './router';
import { SCREENS } from './routes';
import { shortcutsForPhase, SHORTCUTS } from './shortcuts';

vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  const root = document.documentElement;
  for (const a of ['data-theme', 'data-grain']) root.removeAttribute(a);
  root.style.colorScheme = '';
});

const P1_ROUTES: readonly [string, string][] = [
  ['#/inbox', 'Inbox & Decisions'],
  ['#/calendar/agenda', 'Calendar'],
  ['#/claims/market', 'Claims'],
  ['#/claims/clm_000004/estimate', 'Claim clm_000004'],
  ['#/map', 'District map'],
  ['#/prospecting/programs', 'Prospecting'],
  ['#/ops', 'Operations'],
  ['#/ops/clm_000004/flow/L1', 'Operations'],
  ['#/equipment/market', 'Equipment'],
  ['#/staff/roster/emp_owner', 'Staff'],
  ['#/bank/ledger', 'Bank & loans'],
  ['#/gold/sell', 'Gold sales'],
  ['#/reports/13-week', 'Reports'],
  ['#/company/owner', 'Company & owner'],
  ['#/help/glossary', 'Help'],
  ['#/end', 'End of run'],
];

describe('P1 routes and the nav (13.1)', () => {
  it('renders every P1 route as its screen (a placeholder until the screen package lands), with route tabs', () => {
    renderScreen('#/');
    for (const [hash, title] of P1_ROUTES) {
      goTo(hash);
      expect(screen.getByRole('heading', { level: 1, name: title }), hash).toBeTruthy();
    }
    goTo('#/bank/ledger');
    const tabs = screen.getByRole('navigation', { name: 'Bank & loans tabs' });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Accounts', 'Bills & payments', 'Ledger', 'Loans & leases']);
    expect(within(tabs).getByRole('link', { name: 'Ledger' }).getAttribute('aria-current')).toBe('page');
    expect(within(tabs).getByRole('link', { name: 'Loans & leases' }).getAttribute('href')).toBe('#/bank/loans');
    goTo('#/ops/clm_000004/flow/L1');
    const opsTabs = screen.getByRole('navigation', { name: 'Operations tabs' });
    expect(within(opsTabs).getByRole('link', { name: 'Cleanups' }).getAttribute('href')).toBe(
      '#/ops/clm_000004/cleanups/L1',
    );
    expect(document.querySelector('[data-placeholder-screen="ops"]')?.textContent).toContain('L1');
  });

  it('marks the item that owns the route, claim detail under Claims', () => {
    renderScreen('#/claims/clm_000004/overview');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Claims' }).getAttribute('aria-current')).toBe('page');
    goTo('#/gold/history');
    expect(within(nav).getByRole('link', { name: 'Gold sales' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Claims' }).hasAttribute('aria-current')).toBe(false);
    expect(within(nav).queryByRole('link', { name: /Permits|News/ })).toBeNull();
  });

  it('shows a page-not-found for routes of later phases', () => {
    renderScreen('#/permits/authority');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});

describe('g sequences (13.15)', () => {
  it('reach every P1 screen with a key, including g g for Gold, and ignore later phases', () => {
    renderScreen('#/');
    const expectations: [string, string][] = [
      ['i', '#/inbox'],
      ['c', '#/calendar/agenda'],
      ['l', '#/claims/market'],
      ['m', '#/map'],
      ['x', '#/prospecting/programs'],
      ['o', '#/ops/site'],
      ['e', '#/equipment/market'],
      ['s', '#/staff/roster'],
      ['b', '#/bank/accounts'],
      ['g', '#/gold/inventory'],
      ['r', '#/reports/is'],
      ['u', '#/company/profile'],
      ['d', '#/'],
    ];
    for (const [key, hash] of expectations) {
      fireEvent.keyDown(document.body, { key: 'g' });
      fireEvent.keyDown(document.body, { key });
      expect(window.location.hash || '#/', `g ${key}`).toBe(hash);
    }
    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'p' });
    expect(window.location.hash || '#/').toBe('#/');
  });
});

describe('command palette (13.1, S13-17, T24)', () => {
  it('opens on Ctrl+K, finds a verb, and navigates on Enter without dispatching anything', () => {
    const r = renderScreen('#/');
    const before = r.harness.store.getState().game.state;
    const advance = within(screen.getByRole('banner')).getByRole('button', { name: /Advance/ });
    act(() => advance.focus());
    fireEvent.keyDown(advance, { key: 'k', ctrlKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    const input = within(dialog).getByRole('combobox', { name: 'Search screens, actions and items' });
    expect(document.activeElement).toBe(input);
    // Global shortcuts are off while the palette is open (Ctrl+Enter is not Advance here).
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.change(input, { target: { value: 'sell gold' } });
    const first = within(dialog).getAllByRole('option')[0] as HTMLElement;
    expect(first.textContent).toContain('Sell gold');
    expect(input.getAttribute('aria-activedescendant')).toBe(first.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(window.location.hash).toBe('#/gold/sell');
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    expect(r.harness.store.getState().game.state).toBe(before);
    expect(r.harness.store.getState().game.actionLog).toEqual([]);
  });

  it('opens on /, moves with the arrows, resolves a typed id, and closes on Esc', () => {
    renderScreen('#/');
    fireEvent.keyDown(document.body, { key: '/' });
    const input = screen.getByRole('combobox', { name: 'Search screens, actions and items' });
    const options = (): HTMLElement[] => screen.getAllByRole('option');
    expect(options().length).toBeGreaterThan(10);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[1]?.id);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[options().length - 1]?.id);
    fireEvent.change(input, { target: { value: 'clm_000123' } });
    expect(options()[0]?.textContent).toContain('Claim');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(window.location.hash).toBe('#/claims/clm_000123/overview');
    fireEvent.keyDown(document.body, { key: '/' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
  });

  it('lists only routes that exist in this build, verbs included (T24: verbs only navigate)', () => {
    const items = [...screenItems(), ...verbItems()];
    for (const item of items) expect(parseRoute(routeHref(item.route)).name, item.label).not.toBe('notFound');
    expect(items.filter((i) => i.kind === 'verb')).toHaveLength(PALETTE_VERBS.length);
    const labels = screenItems().map((i) => `${i.detail} › ${i.label}`);
    expect(labels).toContain('Money › Bank & loans');
    expect(labels).toContain('Bank & loans › Ledger');
    expect(labels).not.toContain('Overview › News');
  });

  it('ranks matches, resolves ids, and takes entity names from screen providers', () => {
    const state: GameState = freshState();
    const provider = (): readonly PaletteEntity[] => [
      {
        id: 'clm_000004',
        name: 'Caribou Fork #3',
        kind: 'Claim',
        route: { name: 'claim', claimId: 'clm_000004' as never, tab: 'overview' },
      },
    ];
    const items = [...screenItems(), ...verbItems(), ...entityItems(paletteEntities(state, [provider]))];
    expect(searchPalette('caribou', items)[0]?.label).toBe('Caribou Fork #3');
    expect(searchPalette('clm_000004', items)[0]?.route).toEqual({
      name: 'claim',
      claimId: 'clm_000004',
      tab: 'overview',
    });
    expect(searchPalette('ledger', items)[0]?.label).toBe('Ledger');
    expect(searchPalette('zzzz', items)).toEqual([]);
    expect(searchPalette('', items).every((i) => i.kind === 'screen')).toBe(true);
    expect(idItem('emp_owner')?.route).toEqual({ name: 'staff', tab: 'roster', employeeId: 'emp_owner' });
    expect(idItem('nope')).toBeNull();
    expect(paletteEntities(null, [provider])).toEqual([]);
  });
});

describe('the shortcut sheet (13.15)', () => {
  it('opens on ?, lists this build’s shortcuts only, and returns focus on Esc', () => {
    renderScreen('#/');
    const advance = within(screen.getByRole('banner')).getByRole('button', { name: /Advance/ });
    act(() => advance.focus());
    fireEvent.keyDown(advance, { key: '?' });
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(sheet.textContent).toContain('Advance week');
    expect(sheet.textContent).toContain('Gold sales');
    expect(sheet.textContent).not.toContain('Permits & compliance');
    expect(sheet.textContent).not.toContain('plant line L1–L3');
    fireEvent.keyDown(within(sheet).getByRole('button', { name: 'Close' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(advance);
  });

  it('keeps every nav g key in the registry, phased like its screen', () => {
    for (const g of NAV_MAP) {
      for (const item of g.items) {
        if (item.goKey === undefined) continue;
        const def = SHORTCUTS.find((s) => s.keys.includes(`g ${item.goKey}`));
        expect(def?.fromPhase).toBe(item.fromPhase);
      }
    }
    expect(shortcutsForPhase(0).some((s) => s.keys.includes('Ctrl+K'))).toBe(false);
    expect(shortcutsForPhase(1).some((s) => s.keys.includes('Ctrl+K'))).toBe(true);
  });
});

describe('T28 theme rules on the P1 screens (both themes)', () => {
  const CONTROLS = 'input, select, textarea, button';
  const FORBIDDEN_IN_GRAIN = `[data-num], table, ${CONTROLS}, [data-status-cluster], [role="grid"], [role="dialog"], [data-chip], [data-status-chip]`;
  const FORBIDDEN_IN_DISPLAY = `[data-num], table, ${CONTROLS}, [role="tooltip"], [data-chip], [data-status-chip]`;

  function checkRules(where: string): void {
    const grained = document.querySelectorAll('.grain, .grain-chrome');
    expect(grained.length, where).toBeGreaterThan(0);
    for (const el of grained) {
      expect(
        el.querySelector(FORBIDDEN_IN_GRAIN),
        `${where}: grain zone ${el.getAttribute('data-grain-zone')}`,
      ).toBeNull();
      expect(el.matches('[data-status-cluster], table, button, input, [data-num]'), where).toBe(false);
    }
    for (const el of document.querySelectorAll('[class*="display-"]')) {
      expect(el.querySelector(FORBIDDEN_IN_DISPLAY), `${where}: display element ${el.textContent}`).toBeNull();
      expect(el.matches(`${CONTROLS}, [data-num], th, td`), where).toBe(false);
    }
  }

  it.each(['daylight', 'lamplight'] as const)('%s: placeholders, nav, palette and sheet keep the rules', (theme) => {
    const h = createHarness();
    act(() => h.store.getState().setPrefs({ theme }));
    renderScreen('#/', { harness: h });
    for (const [hash] of P1_ROUTES) {
      goTo(hash);
      checkRules(hash);
    }
    fireEvent.keyDown(document.body, { key: '/' });
    checkRules('palette');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: '?' });
    checkRules('shortcut sheet');
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });
});

describe('screen metadata', () => {
  it('names every known route and ships nothing later than its nav item', () => {
    const visible = visibleNav().flatMap((g) => g.items.map((i) => i.route.name));
    for (const name of visible) expect(SCREENS[name as KnownRoute['name']].fromPhase).toBeLessThanOrEqual(1);
  });
});
