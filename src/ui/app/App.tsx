// The application shell (DESIGN §13.1, §13.18 AppShell): top bar, left nav, the routed content area, the explain
// drawer and popover, toasts and the live region. Game state lives in the store and changes only through the engine
// client, so the shell itself holds no game logic.
import { useCallback } from 'react';
import { assertNever } from '../lib/assertNever';
import { ExplainLayer } from '../explain/ExplainLayer';
import { BankScreen } from '../screens/bank/Screen';
import { CalendarScreen } from '../screens/calendar/Screen';
import { ClaimDetailScreen, ClaimsScreen } from '../screens/claims/Screen';
import { CompanyScreen } from '../screens/company/Screen';
import { DashboardScreen } from '../screens/dashboard/Screen';
import { EndScreen } from '../screens/end/Screen';
import { EquipmentScreen } from '../screens/equipment/Screen';
import { GoldScreen } from '../screens/gold/Screen';
import { HelpScreen } from '../screens/help/Screen';
import { InboxScreen } from '../screens/inbox/Screen';
import { MapScreen } from '../screens/map/Screen';
import { OpsScreen } from '../screens/ops/Screen';
import { ProspectingScreen } from '../screens/prospecting/Screen';
import { ReportsScreen } from '../screens/reports/Screen';
import { SavesScreen } from '../screens/saves/Screen';
import { SettingsScreen } from '../screens/settings/Screen';
import { NewGameScreen } from '../screens/setup/Screen';
import { StaffScreen } from '../screens/staff/Screen';
import { UiStoreProvider, useUi, type UiStore } from '../store/store';
import { CommandPalette } from './CommandPalette';
import { DevTruthBanner } from './DevTruth';
import { LeftNav } from './LeftNav';
import { navigate, routeHref, useRoute, type Route } from './router';
import { ServicesProvider, useServices, type AppServices } from './services';
import { ShortcutSheet } from './ShortcutSheet';
import { useGlobalShortcuts } from './shortcuts';
import { ThemeRoot } from './ThemeRoot';
import { LiveRegion, Toasts } from './Toasts';
import { TopBar } from './TopBar';

export interface AppProps {
  readonly store: UiStore;
  readonly services: AppServices;
}

export function App({ store, services }: AppProps) {
  return (
    <UiStoreProvider store={store}>
      <ServicesProvider services={services}>
        <ThemeRoot />
        <AppShell />
      </ServicesProvider>
    </UiStoreProvider>
  );
}

function focusMain(): void {
  document.getElementById('main')?.focus();
}

function AppShell() {
  const route = useRoute();
  const { client } = useServices();
  const drawerOpen = useUi((s) => s.explain.stack.length > 0);
  const devReveal = useUi((s) => s.devReveal);
  const toSaves = useCallback(() => navigate({ name: 'saves' }), []);
  useGlobalShortcuts({ client, onQuickSaveWithoutSlot: toSaves });

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
      <TopBar />
      {import.meta.env.DEV && devReveal ? <DevTruthBanner what="Dev reveal is on: hidden truth may show" /> : null}
      <div className="flex min-h-0 flex-1">
        <LeftNav route={route} />
        {/* 13.1: the drawer pushes the content at ≥ 1440 px and overlays it below. */}
        <main
          id="main"
          tabIndex={-1}
          className={`min-w-0 flex-1 overflow-auto outline-none ${drawerOpen ? 'min-[1440px]:mr-[440px]' : ''}`}
        >
          <div className="mx-auto max-w-[1680px] p-6">
            <RoutedScreen route={route} />
          </div>
        </main>
      </div>
      <ExplainLayer />
      <CommandPalette />
      <ShortcutSheet />
      <Toasts />
      <LiveRegion />
    </div>
  );
}

/** One screen per route (13.1); each P1 screen folder's Screen.tsx is a placeholder until its package lands. */
function RoutedScreen({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'inbox':
      return <InboxScreen route={route} />;
    case 'calendar':
      return <CalendarScreen route={route} />;
    case 'claims':
      return <ClaimsScreen route={route} />;
    case 'claim':
      return <ClaimDetailScreen route={route} />;
    case 'map':
      return <MapScreen route={route} />;
    case 'prospecting':
      return <ProspectingScreen route={route} />;
    case 'ops':
      return <OpsScreen route={route} />;
    case 'equipment':
      return <EquipmentScreen route={route} />;
    case 'staff':
      return <StaffScreen route={route} />;
    case 'bank':
      return <BankScreen route={route} />;
    case 'gold':
      return <GoldScreen route={route} />;
    case 'reports':
      return <ReportsScreen route={route} />;
    case 'company':
      return <CompanyScreen route={route} />;
    case 'help':
      return <HelpScreen route={route} />;
    case 'end':
      return <EndScreen route={route} />;
    case 'saves':
      return <SavesScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'newGame':
      return <NewGameScreen />;
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
