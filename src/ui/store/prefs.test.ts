// Prefs persistence and application (DESIGN §13.18 Prefs, §13.21 `ui/setPrefs`, the theme half of T28).
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  applyPrefs,
  loadPrefs,
  mergePrefs,
  resolveTheme,
  sanitizePrefs,
  savePrefs,
  type PrefsStorage,
} from './prefs';
import { createUiStore } from './store';

function memoryStorage(initial: Record<string, string> = {}): PrefsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (Object.hasOwn(data, k) ? (data[k] ?? null) : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwingStorage: PrefsStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

afterEach(() => {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.removeAttribute('data-density');
  for (const a of ['data-grain', 'data-font-scale', 'data-reduced-motion', 'data-texture']) root.removeAttribute(a);
  root.style.colorScheme = '';
});

describe('Prefs storage', () => {
  it('defaults to system theme, comfortable density and grain on (ui.theme.default)', () => {
    expect(DEFAULT_PREFS).toEqual({
      theme: 'system',
      density: 'comfortable',
      fontScale: 1,
      reducedMotion: 'system',
      texture: false,
      headerGrain: true,
      confirmAdvanceSheet: true,
      compactTiles: false,
    });
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memoryStorage())).toEqual(DEFAULT_PREFS);
  });

  it('round-trips through localStorage', () => {
    const storage = memoryStorage();
    const prefs = {
      ...DEFAULT_PREFS,
      theme: 'lamplight',
      density: 'compact',
      headerGrain: false,
      fontScale: 1.25,
      reducedMotion: 'on',
      texture: true,
    } as const;
    expect(savePrefs(storage, prefs)).toBe(true);
    expect(JSON.parse(storage.data[PREFS_STORAGE_KEY] ?? 'null')).toEqual(prefs);
    expect(loadPrefs(storage)).toEqual(prefs);
  });

  it('falls back to defaults when storage throws or holds junk', () => {
    expect(loadPrefs(throwingStorage)).toEqual(DEFAULT_PREFS);
    expect(savePrefs(throwingStorage, DEFAULT_PREFS)).toBe(false);
    expect(loadPrefs(memoryStorage({ [PREFS_STORAGE_KEY]: '{not json' }))).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memoryStorage({ [PREFS_STORAGE_KEY]: '42' }))).toEqual(DEFAULT_PREFS);
  });

  it('keeps each valid field when others are missing or invalid', () => {
    expect(sanitizePrefs({ theme: 'daylight', density: 'tiny', headerGrain: 'yes' })).toEqual({
      ...DEFAULT_PREFS,
      theme: 'daylight',
    });
    expect(sanitizePrefs({ headerGrain: false })).toEqual({ ...DEFAULT_PREFS, headerGrain: false });
    expect(sanitizePrefs({ fontScale: 1.5, reducedMotion: 'sometimes', texture: 1 })).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({ fontScale: 1.125, reducedMotion: 'off' })).toEqual({
      ...DEFAULT_PREFS,
      fontScale: 1.125,
      reducedMotion: 'off',
    });
  });

  it('merges a partial update (ui/setPrefs takes Partial<Prefs>)', () => {
    expect(mergePrefs(DEFAULT_PREFS, { theme: 'lamplight' })).toEqual({ ...DEFAULT_PREFS, theme: 'lamplight' });
    expect(mergePrefs(DEFAULT_PREFS, {})).toEqual(DEFAULT_PREFS);
  });
});

describe('applying prefs to <html>', () => {
  it('sets data-theme and color-scheme from Prefs.theme; system leaves the attribute off', () => {
    const root = document.documentElement;
    applyPrefs(root, { ...DEFAULT_PREFS, theme: 'lamplight' });
    expect(root.getAttribute('data-theme')).toBe('lamplight');
    expect(root.style.colorScheme).toBe('dark');
    applyPrefs(root, { ...DEFAULT_PREFS, theme: 'daylight' });
    expect(root.getAttribute('data-theme')).toBe('daylight');
    expect(root.style.colorScheme).toBe('light');
    applyPrefs(root, { ...DEFAULT_PREFS, theme: 'system' });
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.style.colorScheme).toBe('light dark');
  });

  it('sets density, the grain switch and the accessibility attributes', () => {
    const root = document.documentElement;
    applyPrefs(root, {
      ...DEFAULT_PREFS,
      density: 'compact',
      headerGrain: false,
      fontScale: 1.25,
      reducedMotion: 'on',
      texture: true,
    });
    expect(root.getAttribute('data-density')).toBe('compact');
    expect(root.getAttribute('data-grain')).toBe('off');
    expect(root.getAttribute('data-font-scale')).toBe('1.25');
    expect(root.getAttribute('data-reduced-motion')).toBe('on');
    expect(root.getAttribute('data-texture')).toBe('on');
    applyPrefs(root, DEFAULT_PREFS);
    expect(root.getAttribute('data-density')).toBe('comfortable');
    expect(root.getAttribute('data-grain')).toBe('on');
    expect(root.getAttribute('data-font-scale')).toBe('1');
    expect(root.getAttribute('data-reduced-motion')).toBe('system');
    expect(root.getAttribute('data-texture')).toBe('off');
  });

  it('resolves system from the OS preference and lets an explicit choice win', () => {
    expect(resolveTheme('system', true)).toBe('lamplight');
    expect(resolveTheme('system', false)).toBe('daylight');
    expect(resolveTheme('daylight', true)).toBe('daylight');
    expect(resolveTheme('lamplight', false)).toBe('lamplight');
  });
});

describe('UI store prefs', () => {
  it('loads stored prefs and persists ui/setPrefs', () => {
    const storage = memoryStorage({
      // An older build's three-field prefs: the new fields take their defaults.
      [PREFS_STORAGE_KEY]: JSON.stringify({ theme: 'daylight', density: 'compact', headerGrain: true }),
    });
    const store = createUiStore({ storage });
    expect(store.getState().prefs.theme).toBe('daylight');
    store.getState().setPrefs({ headerGrain: false });
    expect(store.getState().prefs).toEqual({
      ...DEFAULT_PREFS,
      theme: 'daylight',
      density: 'compact',
      headerGrain: false,
    });
    expect(store.getState().prefsPersisted).toBe(true);
    expect(loadPrefs(storage)).toEqual(store.getState().prefs);
  });

  it('keeps the new prefs for the session when storage refuses the write', () => {
    const store = createUiStore({ storage: throwingStorage });
    store.getState().setPrefs({ theme: 'lamplight' });
    expect(store.getState().prefs.theme).toBe('lamplight');
    expect(store.getState().prefsPersisted).toBe(false);
  });
});
