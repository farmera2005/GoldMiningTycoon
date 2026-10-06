// Placeholder for §13.5 Prospecting (DESIGN §13.24 P1). The `ui-resources` package replaces this file with the real
// screen; until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function ProspectingScreen({ route }: { route: RouteOf<'prospecting'> }) {
  return <PlaceholderScreen route={route} />;
}
