// Hash router (DESIGN §13.1 navigation map, D-13.1).
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { parseRoute, routeHref, useRoute, type KnownRoute } from './router';

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
    ['#/claims/clm_000123', { name: 'notFound', path: '/claims/clm_000123' }],
    ['#/savesx', { name: 'notFound', path: '/savesx' }],
  ])('%s → %o', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it('round-trips every known route through its href', () => {
    const routes: KnownRoute[] = [{ name: 'dashboard' }, { name: 'saves' }, { name: 'settings' }, { name: 'newGame' }];
    for (const route of routes) expect(parseRoute(routeHref(route))).toEqual(route);
    expect(routeHref({ name: 'dashboard' })).toBe('#/');
    expect(routeHref({ name: 'newGame' })).toBe('#/new');
  });
});

function ShowRoute() {
  const route = useRoute();
  return <p data-testid="route">{route.name}</p>;
}

describe('useRoute', () => {
  it('follows hashchange, including back and forward', () => {
    render(<ShowRoute />);
    expect(screen.getByTestId('route').textContent).toBe('dashboard');
    act(() => {
      window.location.hash = '#/saves';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('route').textContent).toBe('saves');
    act(() => {
      window.location.hash = '#/nowhere';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('route').textContent).toBe('notFound');
  });
});
