// Hash routing (DESIGN §13.1, D-13.1): every screen has a canonical `#/…` route, so links, explain references and
// browser back/forward all work without a server. P0 knows the shell's routes; later phases add theirs here.
import { useSyncExternalStore } from 'react';

export type Route =
  | { readonly name: 'dashboard' }
  | { readonly name: 'saves' }
  | { readonly name: 'settings' }
  | { readonly name: 'newGame' }
  | { readonly name: 'notFound'; readonly path: string };

export type RouteName = Route['name'];
export type KnownRoute = Exclude<Route, { name: 'notFound' }>;

const PATHS: Readonly<Record<KnownRoute['name'], string>> = {
  dashboard: '/',
  saves: '/saves',
  settings: '/settings',
  newGame: '/new',
};

/** Accepts `#/saves`, `#/saves/`, `/saves` or `` (the dashboard); a query string is ignored. */
export function parseRoute(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const pathOnly = raw.split('?')[0] ?? '';
  const trimmed = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, '') : pathOnly;
  const path = trimmed === '' ? '/' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  switch (path) {
    case PATHS.dashboard:
      return { name: 'dashboard' };
    case PATHS.saves:
      return { name: 'saves' };
    case PATHS.settings:
      return { name: 'settings' };
    case PATHS.newGame:
      return { name: 'newGame' };
    default:
      return { name: 'notFound', path };
  }
}

export function routeHref(route: KnownRoute): string {
  return `#${PATHS[route.name]}`;
}

export function navigate(route: KnownRoute): void {
  window.location.hash = routeHref(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function currentHash(): string {
  return window.location.hash;
}

/** The current route, re-rendering on `hashchange` (including back and forward). */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash, () => '');
  return parseRoute(hash);
}
