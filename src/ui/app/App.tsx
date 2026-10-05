// The application shell (DESIGN §13.1, §13.18 AppShell): top bar, left nav and the routed content area. Game data
// and game actions come in through props (a typed placeholder model until the engine client is wired in), so the
// shell holds no game logic.
import type { SlotMeta } from '../../persistence';
import { assertNever } from '../lib/assertNever';
import { DashboardScreen } from '../screens/dashboard/Screen';
import { SavesScreen } from '../screens/saves/Screen';
import { SettingsScreen } from '../screens/settings/Screen';
import { NewGameScreen } from '../screens/setup/Screen';
import { UiStoreProvider, type UiStore } from '../store/store';
import { LeftNav } from './LeftNav';
import { navigate, routeHref, useRoute, type Route } from './router';
import type { NewGameInput, SavesController, ShellStatus } from './shellModel';
import { ThemeRoot } from './ThemeRoot';
import { TopBar } from './TopBar';

export interface AppProps {
  readonly store: UiStore;
  /** The game as the shell shows it, or null when no game is loaded (the title screen). */
  readonly status: ShellStatus | null;
  /** `ui/advanceWeek` (13.21). */
  readonly onAdvanceWeek: () => void;
  readonly onNewGame: (input: NewGameInput) => void;
  readonly saves: SavesController;
}

export function App(props: AppProps) {
  return (
    <UiStoreProvider store={props.store}>
      <ThemeRoot />
      <AppShell {...props} />
    </UiStoreProvider>
  );
}

function focusMain(): void {
  document.getElementById('main')?.focus();
}

function AppShell({ status, onAdvanceWeek, onNewGame, saves }: AppProps) {
  const route = useRoute();

  const onContinue = (slot: SlotMeta): void => {
    void saves.store.load(slot.slotId).then((result) => {
      if (result.ok) saves.onLoaded(result.value);
      else navigate({ name: 'saves' });
    });
  };

  return (
    <div className="flex h-screen min-h-[720px] flex-col bg-surface-0 text-ink-1">
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface-2 focus:px-3 focus:py-1 focus:text-ink-1"
        onClick={focusMain}
      >
        Skip to content
      </button>
      <div className="narrow-banner border-b border-hairline bg-surface-2 px-4 py-1 text-13 text-ink-2" role="note">
        Best on a screen at least 1280 px wide
      </div>
      <TopBar status={status} onAdvanceWeek={onAdvanceWeek} />
      <div className="flex min-h-0 flex-1">
        <LeftNav route={route} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-auto outline-none">
          <div className="mx-auto max-w-[1680px] p-6">
            <RoutedScreen
              route={route}
              status={status}
              saves={saves}
              onContinue={onContinue}
              onNewGame={(input) => {
                onNewGame(input);
                navigate({ name: 'dashboard' });
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function RoutedScreen({
  route,
  status,
  saves,
  onContinue,
  onNewGame,
}: {
  route: Route;
  status: ShellStatus | null;
  saves: SavesController;
  onContinue: (slot: SlotMeta) => void;
  onNewGame: (input: NewGameInput) => void;
}) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardScreen status={status} saveStore={saves.store} onContinue={onContinue} />;
    case 'saves':
      return <SavesScreen controller={saves} />;
    case 'settings':
      return <SettingsScreen />;
    case 'newGame':
      return <NewGameScreen onNewGame={onNewGame} />;
    case 'notFound':
      return (
        <section className="rounded-card border border-hairline bg-surface-1 p-6">
          <h1 className="display-section mb-2 text-ink-1">Page not found</h1>
          <p className="text-14 text-ink-2">
            Nothing lives at <code data-code="">{route.path}</code>.{' '}
            <a href={routeHref({ name: 'dashboard' })}>Back to the dashboard</a>
          </p>
        </section>
      );
    default:
      return assertNever(route);
  }
}
