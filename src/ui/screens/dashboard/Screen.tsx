// Dashboard route `#/` (DESIGN §13.1; the P1 dashboard is 13.3). With no game loaded it is the title screen of
// 13.16: Continue (latest autosave), New game, Load and Import. With a game, P0 shows the position (cash and owner
// net worth), last week's cash, and an empty state until the core loop's tiles arrive in P1.
import { useEffect, useState, type ReactNode } from 'react';
import { select, type GameState } from '../../../engine';
import type { SlotMeta } from '../../../persistence';
import { DevTruthPanel } from '../../app/DevTruth';
import { routeHref } from '../../app/router';
import { useServices } from '../../app/services';
import { Button, MessageArea, Panel, ScreenTitle } from '../../components/primitives';
import { Num } from '../../explain/Num';
import { queryLedger } from '../../explain/ledger';
import { CASH_ON_HAND_ACCOUNTS, cashPostingsRef, cashRef, historyRef, netWorthRef } from '../../explain/refs';
import { historyValue } from '../../explain/resolve';
import { yearWeek } from '../../format';
import { useUi } from '../../store/store';
import { useSel } from '../../store/useSel';
import { errorText } from '../saves/messages';

/** Last week's cash movement: the net of the week's cash postings, which is exactly what its explanation lists. */
function weekCashMovementCents(state: GameState): number {
  const turn = state.clock.turn;
  return queryLedger(state, { book: 'company', accounts: [...CASH_ON_HAND_ACCOUNTS], fromTurn: turn, toTurn: turn })
    .netCents;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-48">
      <dt className="text-13 text-ink-2">{label}</dt>
      <dd className="text-24 font-semibold text-ink-1">{children}</dd>
    </div>
  );
}

function GameDashboard({ state }: { state: GameState }) {
  const cash = useSel(select.cashOnHand);
  const netWorth = useSel(select.netWorth, 'scoring');
  const movement = useSel(weekCashMovementCents);
  const cashAtWeekEnd = useSel(historyValue, 'cashCents', state.clock.turn);
  const devReveal = useUi((s) => s.devReveal);
  const lastReport = useUi((s) => s.game.calcReports[0] ?? null);
  const turn = state.clock.turn;
  const lastWeek = select.dateView(state);

  return (
    <div>
      <ScreenTitle title="Dashboard" />
      <Panel title="Position" id="position">
        <dl className="flex flex-wrap gap-10">
          <Stat label="Cash on hand">
            <Num value={cash ?? 0} unit="cents" explain={cashRef} label="Cash on hand" />
          </Stat>
          <Stat label="Owner net worth">
            <Num value={netWorth ?? 0} unit="cents" explain={netWorthRef} label="Owner net worth" />
          </Stat>
        </dl>
      </Panel>

      <Panel title="Last week" id="last-week">
        {turn === 0 ? (
          <p className="text-14 text-ink-2">No week has been played yet. Advance moves the clock one week.</p>
        ) : (
          <dl className="flex flex-wrap gap-10">
            <Stat label={`Cash at the end of ${yearWeek(lastWeek.year, lastWeek.week)}`}>
              <Num
                value={cashAtWeekEnd ?? 0}
                unit="cents"
                explain={historyRef('cashCents', turn)}
                label="Cash on hand at week end"
              />
            </Stat>
            <Stat label="Cash movement that week">
              <Num
                value={movement ?? 0}
                unit="cents"
                fmt={{ delta: true }}
                goodDirection="up"
                explain={cashPostingsRef(turn)}
                label="Cash movement"
              />
            </Stat>
          </dl>
        )}
      </Panel>

      {/* Empty states may carry grain (13.20); the band holds only its heading and text. */}
      <section className="grain mb-6 rounded-card border border-hairline p-6" data-grain-zone="empty-state">
        <h2 className="display-panel mb-2 text-ink-1">Operations arrive in Phase 1</h2>
        <p className="text-14 text-ink-2">
          Claims, crews, equipment and gold sales join the game with the core loop. For now the clock runs and the books
          hold your opening capital.
        </p>
      </section>

      {import.meta.env.DEV && devReveal ? <DevTruthPanel state={state} lastReport={lastReport} /> : null}
    </div>
  );
}

function TitleScreen() {
  const { client, saves } = useServices();
  const [latest, setLatest] = useState<SlotMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void saves.latestAutosave().then((result) => {
      if (!live) return;
      // A storage failure keeps Continue disabled and shows its typed error, instead of failing silently (13.16).
      if (result.ok) setLatest(result.value);
      else setError(errorText(result.error));
    });
    return () => {
      live = false;
    };
  }, [saves]);

  const onContinue = (): void => {
    if (latest === null) return;
    void client.loadSlot(latest).then((r) => setError(r.ok ? null : errorText(r.error)));
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* The title screen may carry grain (13.20); its band holds only the title text. */}
      <div className="grain mb-6 rounded-card px-8 py-10 text-center" data-grain-zone="title-screen">
        <h1 className="display-title-screen text-ink-1">Gold Mining Tycoon</h1>
        <p className="mt-3 text-14 text-ink-2">Found and run a small placer gold mining company.</p>
      </div>
      <MessageArea errors={error === null ? [] : [error]} notices={[]} />
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" disabled={latest === null} onClick={onContinue}>
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

export function DashboardScreen() {
  const state = useUi((s) => s.game.state);
  return state === null ? <TitleScreen /> : <GameDashboard state={state} />;
}
