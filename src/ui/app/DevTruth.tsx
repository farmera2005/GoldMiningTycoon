// Dev reveal views (DESIGN §13.13, D-13.41): a striped `DEV TRUTH` banner and a raw JSON view of the GameState slices
// and the last WeekReport. Rendered only behind `import.meta.env.DEV`, which production builds replace with false,
// so this module is tree-shaken out of the bundle (an e2e check greps dist/ for it). The player-facing reveal is
// the end-of-run screen, only once the run has ended.
import { useState } from 'react';
import type { GameState, WeekReport } from '../../engine';

export function DevTruthBanner({ what }: { what: string }) {
  return (
    <div className="dev-truth-band px-3 py-1" data-dev-truth="" role="note">
      <span className="rounded-control bg-status-warning px-1.5 text-12 font-semibold text-status-warning-on">
        DEV TRUTH
      </span>{' '}
      <span className="rounded-control bg-surface-2 px-1.5 text-12 text-ink-1">{what}</span>
    </div>
  );
}

function JsonBlock({ name, value }: { name: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="border-b border-hairline py-1" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-13 text-ink-1" data-code="">
        {name}
      </summary>
      {/* Serialized only while open: a year-10 state is megabytes of JSON. */}
      {open ? (
        <pre className="max-h-96 overflow-auto bg-surface-2 p-2 text-12 text-ink-1">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </details>
  );
}

export function DevTruthPanel({ state, lastReport }: { state: GameState; lastReport: WeekReport | null }) {
  return (
    <section className="mb-6 rounded-card border border-hairline bg-surface-1" aria-label="Dev truth" data-dev-truth="">
      <DevTruthBanner what="Raw game state, hidden fields included" />
      <div className="p-4">
        {Object.entries(state).map(([key, value]) => (
          <JsonBlock key={key} name={`state.${key}`} value={value} />
        ))}
        <JsonBlock name="last WeekReport" value={lastReport} />
      </div>
    </section>
  );
}
