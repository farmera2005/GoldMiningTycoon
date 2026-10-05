// Dev reveal toggle (DESIGN §13.24 P0, CLAUDE.md "hidden information"): a development-only switch for viewing hidden
// truth. Callers render it only under `import.meta.env.DEV`, which production builds replace with `false`, so this
// module is tree-shaken out of the production bundle. P0 has no hidden truth yet; the flag is the hook later screens
// read. The normal player-facing reveal is the end-of-run screen, only when the run has ended (D-13.41).
import { useUi } from '../store/store';

export function DevRevealToggle() {
  const devReveal = useUi((s) => s.devReveal);
  const setDevReveal = useUi((s) => s.setDevReveal);
  return (
    <label className="flex items-center gap-2 text-14 text-ink-1">
      <input
        type="checkbox"
        className="h-4 w-4 accent-accent"
        checked={devReveal}
        onChange={(e) => setDevReveal(e.currentTarget.checked)}
      />
      Reveal hidden truth (development builds only)
    </label>
  );
}
