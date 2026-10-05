// The top bar (DESIGN §13.1): chrome, 56 px. Grain covers only the brand block; the status cluster (date through
// Advance) sits on flat chrome because it carries numbers (13.20, T28). P0 shows date, cash, save state and Advance;
// season chips, liquidity, gold, the alert bell and Run arrive with their systems.
import { uiConfig } from '../../data/tuning/ui';
import { MenuIcon, Wordmark } from '../components/icons';
import { routeHref } from './router';
import type { ShellStatus } from './shellModel';
import { useUi } from '../store/store';

const COMPANY_MAX_CHARS = 28;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export interface TopBarProps {
  readonly status: ShellStatus | null;
  readonly onAdvanceWeek: () => void;
}

export function TopBar({ status, onAdvanceWeek }: TopBarProps) {
  const navCollapsed = useUi((s) => s.navCollapsed);
  const setNavCollapsed = useUi((s) => s.setNavCollapsed);
  const devReveal = useUi((s) => s.devReveal);
  const companyName = status?.company.name ?? 'Gold Mining Tycoon';

  return (
    <header
      className="chrome flex shrink-0 items-stretch border-b border-chrome-hairline bg-chrome text-chrome-ink"
      style={{ height: uiConfig['ui.layout.topBarPx'] }}
    >
      <button
        type="button"
        className="flex shrink-0 items-center justify-center text-chrome-ink-2 hover:text-chrome-ink"
        style={{ width: uiConfig['ui.layout.railPx'] }}
        aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-expanded={!navCollapsed}
        aria-controls="app-nav"
        onClick={() => setNavCollapsed(!navCollapsed)}
      >
        <MenuIcon />
      </button>

      <div className="grain-chrome flex min-w-0 items-center gap-2 pr-4" data-grain-zone="brand">
        <Wordmark />
        <span className="display-panel truncate" title={companyName}>
          {truncate(companyName, COMPANY_MAX_CHARS)}
        </span>
      </div>
      {status?.company.entityBadge ? (
        <span className="my-auto rounded-control border border-chrome-ink-2 px-1.5 text-12 font-semibold text-chrome-ink-2">
          {status.company.entityBadge}
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-6 px-4 text-13" data-status-cluster="">
        {import.meta.env.DEV && devReveal ? (
          <span className="rounded-control border border-brass-on-chrome px-1.5 text-12 text-chrome-ink">
            Reveal on
          </span>
        ) : null}
        {status ? (
          <>
            <span className="text-chrome-ink" data-num="">
              {status.date.label}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-chrome-ink-2">Cash</span>
              <span className="font-semibold text-chrome-ink" data-num="">
                {status.cash.label}
              </span>
            </span>
            <a href={routeHref({ name: 'saves' })} className="text-chrome-ink-2 hover:text-chrome-ink">
              {status.save.kind === 'saved' ? (
                <span data-num="">{status.save.label}</span>
              ) : status.save.kind === 'unsaved' ? (
                <span>
                  <span aria-hidden="true">{'● '}</span>Unsaved changes
                </span>
              ) : (
                <span>Not saved</span>
              )}
            </a>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-control border border-chrome-ink-2 bg-accent px-3 font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-60"
              title={status.advance.enabled ? status.advance.tooltip : status.advance.disabledReason}
              disabled={!status.advance.enabled}
              onClick={onAdvanceWeek}
            >
              Advance <span aria-hidden="true">{'›'}</span>
            </button>
          </>
        ) : (
          <a href={routeHref({ name: 'newGame' })} className="text-chrome-ink hover:underline">
            New game
          </a>
        )}
      </div>
    </header>
  );
}
