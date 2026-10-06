// Placeholder for §13.7 Operations (DESIGN §13.24 P1). The `ui-ops` package replaces this file with the real screen;
// until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function OpsScreen({ route }: { route: RouteOf<'ops'> }) {
  return <PlaceholderScreen route={route} />;
}
