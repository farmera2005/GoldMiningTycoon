// Placeholder for §13.6 District map (DESIGN §13.24 P1). The `ui-claims` package replaces this file with the real
// screen; until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function MapScreen({ route }: { route: RouteOf<'map'> }) {
  return <PlaceholderScreen route={route} />;
}
