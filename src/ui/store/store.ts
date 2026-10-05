// The UI store (DESIGN §13.18). P0 holds the global prefs and shell presentation state; the game, run, persisted and
// explain slices of 13.18 join it when the engine client is wired in. One store per app instance (created by the
// caller, shared through context) so tests can build isolated stores.
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { loadPrefs, mergePrefs, savePrefs, type Prefs, type PrefsStorage } from './prefs';

export interface UiState {
  readonly prefs: Prefs;
  /** False after a failed localStorage write; prefs still apply for this session. */
  readonly prefsPersisted: boolean;
  /** `ui/setPrefs` (13.21). */
  setPrefs(patch: Partial<Prefs>): void;
  /** Left nav as the 56 px icon rail instead of the 224 px list (13.1). */
  readonly navCollapsed: boolean;
  setNavCollapsed(collapsed: boolean): void;
  /** Dev-only reveal of hidden truth; the toggle is compiled out of production builds (13.24 P0, D-13.41). */
  readonly devReveal: boolean;
  setDevReveal(on: boolean): void;
}

export interface UiStoreOptions {
  readonly storage: PrefsStorage | null;
  readonly navCollapsed?: boolean;
}

export type UiStore = StoreApi<UiState>;

export function createUiStore({ storage, navCollapsed = false }: UiStoreOptions): UiStore {
  return createStore<UiState>()((set, get) => ({
    prefs: loadPrefs(storage),
    prefsPersisted: true,
    setPrefs(patch) {
      const prefs = mergePrefs(get().prefs, patch);
      set({ prefs, prefsPersisted: savePrefs(storage, prefs) });
    },
    navCollapsed,
    setNavCollapsed(collapsed) {
      set({ navCollapsed: collapsed });
    },
    devReveal: false,
    setDevReveal(on) {
      set({ devReveal: on });
    },
  }));
}

const UiStoreContext = createContext<UiStore | null>(null);

export function UiStoreProvider({ store, children }: { store: UiStore; children: ReactNode }) {
  return createElement(UiStoreContext.Provider, { value: store }, children);
}

export function useUi<T>(selector: (state: UiState) => T): T {
  const store = useContext(UiStoreContext);
  if (!store) throw new Error('useUi must be used inside <UiStoreProvider>');
  return useStore(store, selector);
}
