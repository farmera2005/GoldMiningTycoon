// Rendering helpers for UI tests (imported by *.test.tsx only; nothing in the app imports this folder, so it never
// reaches a bundle). `renderWithStore` mounts a component inside the real store and services; `renderScreen` mounts the
// whole app at a route, the way screen packages test their screens (DESIGN §13.27 T8/T9 use the same path).
import { act, render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { GameState } from '../../engine';
import { App } from '../app/App';
import { routeHref, type KnownRoute } from '../app/router';
import { ServicesProvider } from '../app/services';
import { UiStoreProvider } from '../store/store';
import { createHarness, loadState, type Harness } from './harness';

export interface RenderOptions {
  /** An existing harness (store, client, saves); a fresh one otherwise. */
  readonly harness?: Harness;
  /** Load this state as the current game (default: none for renderWithStore, a fresh game for renderScreen). */
  readonly state?: GameState | null;
}

export type Rendered = RenderResult & { readonly harness: Harness };

/** Renders `ui` inside the UI store and the app services, as the app would. */
export function renderWithStore(ui: ReactElement, options: RenderOptions = {}): Rendered {
  const harness = options.harness ?? createHarness();
  if (options.state !== undefined && options.state !== null) loadState(harness.client, options.state);
  const result = render(
    <UiStoreProvider store={harness.store}>
      <ServicesProvider services={harness.services}>{ui}</ServicesProvider>
    </UiStoreProvider>,
  );
  return Object.assign(result, { harness });
}

/** Moves the app to `route` (or a raw `#/…` hash) and lets React render the change. */
export function goTo(route: KnownRoute | string): void {
  act(() => {
    window.location.hash = typeof route === 'string' ? route : routeHref(route);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

/**
 * The whole app at `route` with a game loaded (a fresh game by default; `state: null` for the title screen). Reset
 * `window.location.hash` in `afterEach`.
 */
export function renderScreen(route: KnownRoute | string, options: RenderOptions = {}): Rendered {
  const harness = options.harness ?? createHarness();
  if (options.state !== null) loadState(harness.client, options.state ?? undefined);
  window.location.hash = typeof route === 'string' ? route : routeHref(route);
  const result = render(<App store={harness.store} services={harness.services} />);
  return Object.assign(result, { harness });
}
