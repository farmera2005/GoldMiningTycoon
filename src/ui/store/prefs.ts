// Global display preferences (DESIGN §13.18 `Prefs`, §13.21 `ui/setPrefs`). Prefs are per browser, not per game:
// they live in localStorage, never in a save, and change nothing in the game (13.21 trade-offs). Every storage access
// is wrapped, because localStorage throws in private modes and sandboxed frames; a failure falls back to defaults.
import { uiConfig } from '../../data/tuning/ui';

export type ThemePref = 'system' | 'daylight' | 'lamplight';
export type Density = 'comfortable' | 'compact';
export type ResolvedTheme = 'daylight' | 'lamplight';
export type FontScale = 1 | 1.125 | 1.25;
export type ReducedMotionPref = 'system' | 'on' | 'off';

export interface Prefs {
  readonly theme: ThemePref;
  readonly density: Density;
  /** Up to 125% without loss of content (13.19). */
  readonly fontScale: FontScale;
  /** `system` follows prefers-reduced-motion. */
  readonly reducedMotion: ReducedMotionPref;
  /** Accessibility line patterns on chips, heat maps and stacked bars (13.2 texture mode). */
  readonly texture: boolean;
  /** Decorative header grain (13.20); separate from the accessibility "texture" patterns (D-13.60). */
  readonly headerGrain: boolean;
  /** The pre-advance sheet (13.9; P1). */
  readonly confirmAdvanceSheet: boolean;
  /** Smaller dashboard KPI tiles (P1). */
  readonly compactTiles: boolean;
}

export const THEME_PREFS: readonly ThemePref[] = ['system', 'daylight', 'lamplight'];
export const DENSITIES: readonly Density[] = ['comfortable', 'compact'];
export const FONT_SCALES: readonly FontScale[] = [1, 1.125, 1.25];
export const REDUCED_MOTION_PREFS: readonly ReducedMotionPref[] = ['system', 'on', 'off'];

/** The localStorage key; the version suffix lets a later shape change start clean instead of misreading old data. */
export const PREFS_STORAGE_KEY = 'gmt.prefs.v1';

export const DEFAULT_PREFS: Prefs = {
  theme: uiConfig['ui.theme.default'],
  density: 'comfortable',
  fontScale: 1,
  reducedMotion: 'system',
  texture: false,
  headerGrain: true,
  confirmAdvanceSheet: true,
  compactTiles: false,
};

function oneOf<T>(values: readonly T[], v: unknown): v is T {
  return (values as readonly unknown[]).includes(v);
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Reads each field on its own, so one bad or missing field (e.g. from an older build) keeps the others. */
export function sanitizePrefs(raw: unknown): Prefs {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_PREFS;
  return {
    theme: oneOf(THEME_PREFS, r['theme']) ? r['theme'] : d.theme,
    density: oneOf(DENSITIES, r['density']) ? r['density'] : d.density,
    fontScale: oneOf(FONT_SCALES, r['fontScale']) ? r['fontScale'] : d.fontScale,
    reducedMotion: oneOf(REDUCED_MOTION_PREFS, r['reducedMotion']) ? r['reducedMotion'] : d.reducedMotion,
    texture: bool(r['texture'], d.texture),
    headerGrain: bool(r['headerGrain'], d.headerGrain),
    confirmAdvanceSheet: bool(r['confirmAdvanceSheet'], d.confirmAdvanceSheet),
    compactTiles: bool(r['compactTiles'], d.compactTiles),
  };
}

/** The subset of the Web Storage API prefs need; injectable for tests. */
export type PrefsStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** `window.localStorage`, or null where touching it throws (blocked storage). */
export function browserPrefsStorage(): PrefsStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadPrefs(storage: PrefsStorage | null): Prefs {
  if (!storage) return DEFAULT_PREFS;
  try {
    const text = storage.getItem(PREFS_STORAGE_KEY);
    return text === null ? DEFAULT_PREFS : sanitizePrefs(JSON.parse(text));
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Returns false when the write failed (quota, blocked storage); the prefs still apply for this session. */
export function savePrefs(storage: PrefsStorage | null, prefs: Prefs): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/** `ui/setPrefs` (13.21): merge a partial update; there are no validation errors, unknown values are ignored. */
export function mergePrefs(current: Prefs, patch: Partial<Prefs>): Prefs {
  return sanitizePrefs({ ...current, ...patch });
}

/** `system` follows the OS; an explicit choice always wins (13.20). */
export function resolveTheme(theme: ThemePref, prefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'lamplight' : 'daylight';
  return theme;
}

/**
 * Applies prefs to the root element: `data-theme` (absent for `system`, so the prefers-color-scheme rule in
 * tokens.css decides), the matching CSS `color-scheme` so native scrollbars and pickers follow, and the attributes
 * base.css keys density, grain, font scale, reduced motion and texture on.
 */
export function applyPrefs(root: HTMLElement, prefs: Prefs): void {
  if (prefs.theme === 'system') {
    root.removeAttribute('data-theme');
    root.style.colorScheme = 'light dark';
  } else {
    root.setAttribute('data-theme', prefs.theme);
    root.style.colorScheme = prefs.theme === 'lamplight' ? 'dark' : 'light';
  }
  root.setAttribute('data-density', prefs.density);
  root.setAttribute('data-grain', prefs.headerGrain ? 'on' : 'off');
  root.setAttribute('data-font-scale', String(prefs.fontScale));
  root.setAttribute('data-reduced-motion', prefs.reducedMotion);
  root.setAttribute('data-texture', prefs.texture ? 'on' : 'off');
}
