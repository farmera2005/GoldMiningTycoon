// The UI store (DESIGN §13.18): one Zustand store with the prefs, game, run, explain and persisted slices plus the
// shell's presentation state (nav rail, dev reveal, toasts, live-region text). The engine client writes the game and
// persisted slices; components read through selectors and never compute game math. One store per app instance
// (created by the caller and shared through context) so tests build isolated stores.
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { uiConfig } from '../../data/tuning/ui';
import type { ExplainRef } from '../../engine';
import { EMPTY_GAME, type GameSlice } from './gameSlice';
import { defaultUiPersisted, type UiPersisted } from './persisted';
import { loadPrefs, mergePrefs, savePrefs, type Prefs, type PrefsStorage } from './prefs';

/** §13.18 `run`: P0 has no Run to Next Decision, so the slice only ever reads `idle` (13.24). */
export interface RunSlice {
  readonly status: 'idle' | 'running' | 'stopping';
  readonly maxWeeks: number;
}

export interface ExplainPopover {
  readonly ref: ExplainRef;
  /** The number that opened it: positions the popover and takes focus back on close (13.19). */
  readonly anchor: HTMLElement | null;
  /** A label the screen gave the number, shown when the explanation has none of its own. */
  readonly label?: string;
}

/** §13.18 `explain`: the drawer's breadcrumb stack (`explain.stack`) and the open popover, if any. */
export interface ExplainSlice {
  readonly stack: readonly ExplainRef[];
  readonly popover: ExplainPopover | null;
  /** Where focus returns when the drawer closes. */
  readonly drawerReturnFocus: HTMLElement | null;
}

export type ToastAction = 'exportNow';

export interface Toast {
  readonly id: number;
  readonly severity: 'critical' | 'info';
  readonly message: string;
  readonly action?: ToastAction;
}

export interface UiState {
  readonly prefs: Prefs;
  /** False after a failed localStorage write; prefs still apply for this session. */
  readonly prefsPersisted: boolean;
  /** `ui/setPrefs` (13.21). */
  setPrefs(patch: Partial<Prefs>): void;
  /** Left nav as the 56 px icon rail instead of the 224 px list (13.1). */
  readonly navCollapsed: boolean;
  setNavCollapsed(collapsed: boolean): void;
  /** Dev-only reveal of hidden truth; the toggle is compiled out of production builds (13.13, D-13.41). */
  readonly devReveal: boolean;
  setDevReveal(on: boolean): void;

  readonly game: GameSlice;
  setGame(patch: Partial<GameSlice>): void;
  readonly persisted: UiPersisted;
  setPersisted(persisted: UiPersisted): void;
  readonly run: RunSlice;

  readonly explain: ExplainSlice;
  openPopover(popover: ExplainPopover): void;
  closePopover(): void;
  /** Opens the drawer on `ref` (replacing the stack) and closes the popover. */
  openDrawer(ref: ExplainRef, returnFocus: HTMLElement | null): void;
  /** Follows a link inside the drawer (a source chip): pushes onto the breadcrumbs. */
  pushExplain(ref: ExplainRef): void;
  /** Walks back up the breadcrumbs to `index`. */
  popExplainTo(index: number): void;
  closeDrawer(): void;

  readonly toasts: readonly Toast[];
  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;
  /** The polite live-region text (13.9 week summary, 13.19). */
  readonly announcement: string;
  announce(text: string): void;
}

export interface UiStoreOptions {
  readonly storage: PrefsStorage | null;
  readonly navCollapsed?: boolean;
}

export type UiStore = StoreApi<UiState>;

export function createUiStore({ storage, navCollapsed = false }: UiStoreOptions): UiStore {
  let toastSeq = 0;
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

    game: EMPTY_GAME,
    setGame(patch) {
      set({ game: { ...get().game, ...patch } });
    },
    persisted: defaultUiPersisted(),
    setPersisted(persisted) {
      set({ persisted });
    },
    run: { status: 'idle', maxWeeks: uiConfig['ui.runMaxWeeksDefault'] },

    explain: { stack: [], popover: null, drawerReturnFocus: null },
    openPopover(popover) {
      set({ explain: { ...get().explain, popover } });
    },
    closePopover() {
      set({ explain: { ...get().explain, popover: null } });
    },
    openDrawer(ref, returnFocus) {
      set({ explain: { stack: [ref], popover: null, drawerReturnFocus: returnFocus } });
    },
    pushExplain(ref) {
      const { explain } = get();
      set({ explain: { ...explain, stack: [...explain.stack, ref] } });
    },
    popExplainTo(index) {
      const { explain } = get();
      set({ explain: { ...explain, stack: explain.stack.slice(0, Math.max(1, index + 1)) } });
    },
    closeDrawer() {
      set({ explain: { stack: [], popover: null, drawerReturnFocus: null } });
    },

    toasts: [],
    pushToast(toast) {
      toastSeq += 1;
      // Critical toasts never auto-dismiss (D-13.22); the oldest beyond ui.maxToastsVisible give way.
      const toasts = [...get().toasts, { ...toast, id: toastSeq }].slice(-uiConfig['ui.maxToastsVisible']);
      set({ toasts });
    },
    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
    announcement: '',
    announce(text) {
      set({ announcement: text });
    },
  }));
}

const UiStoreContext = createContext<UiStore | null>(null);

export function UiStoreProvider({ store, children }: { store: UiStore; children: ReactNode }) {
  return createElement(UiStoreContext.Provider, { value: store }, children);
}

export function useUiStore(): UiStore {
  const store = useContext(UiStoreContext);
  if (!store) throw new Error('useUi must be used inside <UiStoreProvider>');
  return store;
}

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(useUiStore(), selector);
}
