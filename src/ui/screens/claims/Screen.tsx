// Placeholder for §13.5 Claims market and claim detail (DESIGN §13.24 P1). The `ui-claims` package replaces this file
// with the real screen; until then the route renders the shared placeholder (title, route tabs, the ids the route
// names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function ClaimsScreen({ route }: { route: RouteOf<'claims'> }) {
  return <PlaceholderScreen route={route} />;
}

export function ClaimDetailScreen({ route }: { route: RouteOf<'claim'> }) {
  return <PlaceholderScreen route={route} />;
}
