// ThemeRoot (DESIGN §13.18, 13.20): keeps <html> in step with Prefs (data-theme, color-scheme, density, grain).
// main.tsx also applies the stored prefs once before the first render so the page never flashes the wrong theme.
import { useEffect } from 'react';
import { applyPrefs } from '../store/prefs';
import { useUi } from '../store/store';

export function ThemeRoot({ root }: { root?: HTMLElement }) {
  const prefs = useUi((s) => s.prefs);
  useEffect(() => {
    applyPrefs(root ?? document.documentElement, prefs);
  }, [prefs, root]);
  return null;
}
