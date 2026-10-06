// Placeholder for §13.11 Reports (DESIGN §13.24 P1). The `ui-money` package replaces this file with the real screen;
// until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function ReportsScreen({ route }: { route: RouteOf<'reports'> }) {
  return <PlaceholderScreen route={route} />;
}
