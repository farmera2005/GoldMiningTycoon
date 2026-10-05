// Dashboard route `#/` (DESIGN §13.1; the P1 dashboard is 13.3). With no game loaded it is the title screen of
// 13.16: Continue (latest autosave), New game, Load and Import. With a game, P0 shows the shell's empty state until
// the core loop's tiles arrive.
import { useEffect, useState } from 'react';
import type { SaveStore, SlotMeta } from '../../../persistence';
import { routeHref } from '../../app/router';
import type { ShellStatus } from '../../app/shellModel';
import { Button, ScreenTitle } from '../../components/primitives';

export interface DashboardProps {
  readonly status: ShellStatus | null;
  readonly saveStore: SaveStore;
  readonly onContinue: (slot: SlotMeta) => void;
}

export function DashboardScreen({ status, saveStore, onContinue }: DashboardProps) {
  return status === null ? (
    <TitleScreen saveStore={saveStore} onContinue={onContinue} />
  ) : (
    <div>
      <ScreenTitle title="Dashboard" />
      <section className="rounded-card border border-hairline bg-surface-1 p-6">
        <h2 className="display-panel mb-2 text-ink-1">Nothing to report yet</h2>
        <p className="text-14 text-ink-2">
          Production, cash and season tiles arrive with the core loop. Use Advance in the top bar to move the clock.
        </p>
      </section>
    </div>
  );
}

function TitleScreen({ saveStore, onContinue }: { saveStore: SaveStore; onContinue: (slot: SlotMeta) => void }) {
  const [latest, setLatest] = useState<SlotMeta | null>(null);
  useEffect(() => {
    let live = true;
    void saveStore.latestAutosave().then((slot) => {
      if (live) setLatest(slot);
    });
    return () => {
      live = false;
    };
  }, [saveStore]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* The title screen may carry grain (13.20); its band holds only the title text. */}
      <div className="grain mb-6 rounded-card px-8 py-10 text-center" data-grain-zone="title-screen">
        <h1 className="display-title-screen text-ink-1">Gold Mining Tycoon</h1>
        <p className="mt-3 text-14 text-ink-2">Found and run a small placer gold mining company.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" disabled={latest === null} onClick={() => latest && onContinue(latest)}>
          Continue
        </Button>
        <a
          href={routeHref({ name: 'newGame' })}
          className="inline-flex h-8 items-center rounded-control border border-border-control bg-surface-2 px-3 text-13 font-medium text-ink-1"
        >
          New game
        </a>
        <a
          href={routeHref({ name: 'saves' })}
          className="inline-flex h-8 items-center rounded-control border border-border-control bg-surface-2 px-3 text-13 font-medium text-ink-1"
        >
          Load or import
        </a>
      </div>
    </div>
  );
}
