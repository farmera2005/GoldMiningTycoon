// Hash router (DESIGN §13.1 navigation map, D-13.1, D-13.99): every P1 route and parameter parses, builds its
// canonical hash back, and rejects tabs, ids and segments it does not know.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILD_RULES_PHASE } from '../../engine';
import { goTargets, NAV_MAP, visibleNav } from './nav';
import {
  hashQuery,
  isRouteId,
  parseRoute,
  routeHref,
  routeTab,
  routeWithTab,
  useRoute,
  useRouteQuery,
  type KnownRoute,
} from './router';
import { SCREENS, UI_PHASE } from './routes';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('parseRoute', () => {
  it.each([
    ['', { name: 'dashboard' }],
    ['#', { name: 'dashboard' }],
    ['#/', { name: 'dashboard' }],
    ['#/saves', { name: 'saves' }],
    ['#/saves/', { name: 'saves' }],
    ['#/settings', { name: 'settings' }],
    ['#/settings?tab=display', { name: 'settings' }],
    ['#/new', { name: 'newGame' }],
    ['saves', { name: 'saves' }],
    ['#/end', { name: 'end' }],
    ['#/inbox', { name: 'inbox', msgId: null }],
    ['#/inbox/msg_000031', { name: 'inbox', msgId: 'msg_000031' }],
    ['#/calendar', { name: 'calendar', tab: 'agenda' }],
    ['#/calendar/agenda', { name: 'calendar', tab: 'agenda' }],
    ['#/claims', { name: 'claims', tab: 'market' }],
    ['#/claims/owned', { name: 'claims', tab: 'owned' }],
    ['#/claims/watched', { name: 'claims', tab: 'watched' }],
    ['#/claims/clm_000123', { name: 'claim', claimId: 'clm_000123', tab: 'overview' }],
    ['#/claims/clm_000123/estimate', { name: 'claim', claimId: 'clm_000123', tab: 'estimate' }],
    ['#/claims/clm_000123/pnl', { name: 'claim', claimId: 'clm_000123', tab: 'pnl' }],
    ['#/claims/clm_1234567/offer', { name: 'claim', claimId: 'clm_1234567', tab: 'offer' }],
    ['#/map', { name: 'map', districtId: null }],
    ['#/map/dst_000002', { name: 'map', districtId: 'dst_000002' }],
    ['#/prospecting', { name: 'prospecting', tab: 'programs', programId: null }],
    ['#/prospecting/programs/prog_000004', { name: 'prospecting', tab: 'programs', programId: 'prog_000004' }],
    ['#/prospecting/samples', { name: 'prospecting', tab: 'samples', programId: null }],
    ['#/ops', { name: 'ops', claimId: null, tab: 'site', lineId: null }],
    ['#/ops/plan', { name: 'ops', claimId: null, tab: 'plan', lineId: null }],
    ['#/ops/clm_000012', { name: 'ops', claimId: 'clm_000012', tab: 'site', lineId: null }],
    ['#/ops/clm_000012/flow', { name: 'ops', claimId: 'clm_000012', tab: 'flow', lineId: null }],
    ['#/ops/clm_000012/flow/L1', { name: 'ops', claimId: 'clm_000012', tab: 'flow', lineId: 'L1' }],
    ['#/equipment', { name: 'equipment', tab: 'market', machineId: null }],
    ['#/equipment/fleet/mch_000007', { name: 'equipment', tab: 'fleet', machineId: 'mch_000007' }],
    ['#/staff', { name: 'staff', tab: 'roster', employeeId: null }],
    ['#/staff/roster/emp_owner', { name: 'staff', tab: 'roster', employeeId: 'emp_owner' }],
    ['#/staff/candidates/emp_000003', { name: 'staff', tab: 'candidates', employeeId: 'emp_000003' }],
    ['#/bank', { name: 'bank', tab: 'accounts' }],
    ['#/bank/ledger', { name: 'bank', tab: 'ledger' }],
    ['#/gold/sell', { name: 'gold', tab: 'sell' }],
    ['#/reports', { name: 'reports', report: 'is' }],
    ['#/reports/13-week', { name: 'reports', report: '13-week' }],
    ['#/company/owner', { name: 'company', tab: 'owner' }],
    ['#/help', { name: 'help', topic: 'glossary' }],
    ['#/help/shortcuts', { name: 'help', topic: 'shortcuts' }],
    ['#/inbox?from=12&to=14', { name: 'inbox', msgId: null }],
  ])('%s → %o', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it.each([
    // Unknown screens, tabs of later phases, ids of the wrong kind, extra segments, empty segments.
    '#/savesx',
    '#/news',
    '#/permits/authority',
    '#/claims/staking',
    '#/claims/auctions',
    '#/claims/clm_000123/risk',
    '#/claims/clm_000123/permits',
    '#/claims/clm_000123/estimate/extra',
    '#/claims/clm_12',
    '#/claims/owned/clm_000123',
    '#/inbox/clm_000123',
    '#/map/clm_000001',
    '#/ops/clm_000012/flow/L4',
    '#/ops/flow/L1',
    '#/ops/clm_000012/shop',
    '#/equipment/shop',
    '#/equipment/fleet/emp_000001',
    '#/staff/safety',
    '#/bank/covenants',
    '#/gold/forwards',
    '#/reports/bs',
    '#/company/scenario',
    '#/calendar/planner',
    '#/saves/extra',
    '#/claims//estimate',
  ])('%s is not found', (hash) => {
    expect(parseRoute(hash).name).toBe('notFound');
  });

  it('keeps the normalised path of an unknown route', () => {
    expect(parseRoute('#/savesx/')).toEqual({ name: 'notFound', path: '/savesx' });
  });

  const canonical: KnownRoute[] = [
    { name: 'dashboard' },
    { name: 'inbox', msgId: null },
    { name: 'inbox', msgId: 'msg_000031' as never },
    { name: 'calendar', tab: 'agenda' },
    { name: 'claims', tab: 'watched' },
    { name: 'claim', claimId: 'clm_000123' as never, tab: 'valuation' },
    { name: 'map', districtId: null },
    { name: 'map', districtId: 'dst_000001' as never },
    { name: 'prospecting', tab: 'records', programId: null },
    { name: 'prospecting', tab: 'programs', programId: 'prog_000009' as never },
    { name: 'ops', claimId: null, tab: 'site', lineId: null },
    { name: 'ops', claimId: 'clm_000012' as never, tab: 'cleanups', lineId: 'L1' },
    { name: 'equipment', tab: 'fleet', machineId: 'mch_000010' as never },
    { name: 'staff', tab: 'payroll', employeeId: null },
    { name: 'bank', tab: 'loans' },
    { name: 'gold', tab: 'history' },
    { name: 'reports', report: 'claim-pnl' },
    { name: 'company', tab: 'investor' },
    { name: 'saves' },
    { name: 'settings' },
    { name: 'help', topic: 'tuning' },
    { name: 'newGame' },
    { name: 'end' },
  ];

  it('round-trips every canonical route through its href', () => {
    for (const route of canonical) expect(parseRoute(routeHref(route))).toEqual(route);
    expect(routeHref({ name: 'dashboard' })).toBe('#/');
    expect(routeHref({ name: 'newGame' })).toBe('#/new');
    expect(routeHref({ name: 'claims', tab: 'market' })).toBe('#/claims/market');
    expect(routeHref({ name: 'claim', claimId: 'clm_000123' as never, tab: 'estimate' })).toBe(
      '#/claims/clm_000123/estimate',
    );
    expect(routeHref({ name: 'ops', claimId: 'clm_000012' as never, tab: 'flow', lineId: 'L1' })).toBe(
      '#/ops/clm_000012/flow/L1',
    );
  });

  it('carries a query in the href and hands it to screens, not to the route', () => {
    const href = routeHref({ name: 'inbox', msgId: null }, { from: '12', to: '14' });
    expect(href).toBe('#/inbox?from=12&to=14');
    expect(parseRoute(href)).toEqual({ name: 'inbox', msgId: null });
    expect(hashQuery(href)).toEqual({ from: '12', to: '14' });
    expect(hashQuery('#/inbox')).toEqual({});
  });

  it('matches registered ids by prefix (D-13.99), with emp_owner as an employee', () => {
    expect(isRouteId('clm_000001', 'clm')).toBe(true);
    expect(isRouteId('clm_00001', 'clm')).toBe(false);
    expect(isRouteId('clm_000001x', 'clm')).toBe(false);
    expect(isRouteId('emp_owner', 'emp')).toBe(true);
    expect(isRouteId('emp_owner', 'mch')).toBe(false);
  });
});

describe('route tabs', () => {
  it('every tabbed screen switches tabs keeping its subject and dropping a selected row', () => {
    expect(routeWithTab({ name: 'claim', claimId: 'clm_000002' as never, tab: 'overview' }, 'evidence')).toEqual({
      name: 'claim',
      claimId: 'clm_000002',
      tab: 'evidence',
    });
    expect(routeWithTab({ name: 'ops', claimId: 'clm_000002' as never, tab: 'site', lineId: 'L1' }, 'flow')).toEqual({
      name: 'ops',
      claimId: 'clm_000002',
      tab: 'flow',
      lineId: 'L1',
    });
    expect(routeWithTab({ name: 'staff', tab: 'roster', employeeId: 'emp_owner' as never }, 'payroll')).toEqual({
      name: 'staff',
      tab: 'payroll',
      employeeId: null,
    });
    expect(routeWithTab({ name: 'bank', tab: 'accounts' }, 'covenants')).toBeNull();
    expect(routeWithTab({ name: 'saves' }, 'x')).toBeNull();
  });

  it('every tab of every screen is reachable through routeWithTab and parses back', () => {
    const samples: Partial<Record<KnownRoute['name'], KnownRoute>> = {
      calendar: { name: 'calendar', tab: 'agenda' },
      claims: { name: 'claims', tab: 'market' },
      claim: { name: 'claim', claimId: 'clm_000001' as never, tab: 'overview' },
      prospecting: { name: 'prospecting', tab: 'programs', programId: null },
      ops: { name: 'ops', claimId: null, tab: 'site', lineId: null },
      equipment: { name: 'equipment', tab: 'market', machineId: null },
      staff: { name: 'staff', tab: 'roster', employeeId: null },
      bank: { name: 'bank', tab: 'accounts' },
      gold: { name: 'gold', tab: 'inventory' },
      reports: { name: 'reports', report: 'is' },
      company: { name: 'company', tab: 'profile' },
      help: { name: 'help', topic: 'glossary' },
    };
    for (const [name, def] of Object.entries(SCREENS)) {
      if (def.tabs.length === 0) continue;
      const base = samples[name as KnownRoute['name']];
      expect(base, name).toBeDefined();
      if (base === undefined) continue;
      for (const t of def.tabs) {
        const r = routeWithTab(base, t.slug);
        expect(r, `${name}/${t.slug}`).not.toBeNull();
        if (r === null) continue;
        expect(routeTab(r)).toBe(t.slug);
        expect(parseRoute(routeHref(r))).toEqual(r);
      }
    }
  });
});

describe('nav map (13.1)', () => {
  it('ships the P1 groups and hides nothing of P1, and the UI phase never trails the engine', () => {
    expect(UI_PHASE).toBeGreaterThanOrEqual(BUILD_RULES_PHASE);
    const groups = visibleNav(1);
    expect(groups.map((g) => g.label)).toEqual(['Overview', 'Ground', 'Operations', 'Money', 'System']);
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual([
      'Dashboard',
      'Inbox',
      'Calendar',
      'Claims',
      'District map',
      'Prospecting',
      'Operations',
      'Equipment',
      'Staff',
      'Bank & loans',
      'Gold sales',
      'Reports',
      'Company & owner',
      'Saves',
      'Settings',
      'Help',
    ]);
  });

  it('hides the items of later phases', () => {
    expect(visibleNav(0).flatMap((g) => g.items.map((i) => i.label))).toEqual(['Dashboard', 'Saves', 'Settings']);
  });

  it('gives every item a route whose screen ships no later than the item, and unique g keys', () => {
    const keys: string[] = [];
    for (const g of NAV_MAP) {
      for (const item of g.items) {
        expect(SCREENS[item.route.name].fromPhase).toBeLessThanOrEqual(item.fromPhase);
        expect(item.matches).toContain(item.route.name);
        if (item.goKey !== undefined) keys.push(item.goKey);
      }
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect([...goTargets(1).keys()].sort()).toEqual(['b', 'c', 'd', 'e', 'g', 'i', 'l', 'm', 'o', 'r', 's', 'u', 'x']);
  });
});

function ShowRoute() {
  const route = useRoute();
  const query = useRouteQuery();
  return (
    <p data-testid="route">
      {route.name}
      {query['from'] === undefined ? '' : ` from ${query['from']}`}
    </p>
  );
}

describe('useRoute', () => {
  it('follows hashchange, including back and forward, and exposes the query', () => {
    render(<ShowRoute />);
    expect(screen.getByTestId('route').textContent).toBe('dashboard');
    act(() => {
      window.location.hash = '#/saves';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('route').textContent).toBe('saves');
    act(() => {
      window.location.hash = '#/inbox?from=3';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('route').textContent).toBe('inbox from 3');
    act(() => {
      window.location.hash = '#/nowhere';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('route').textContent).toBe('notFound');
  });
});
