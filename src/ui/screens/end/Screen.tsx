// Placeholder for §13.14 End of run (DESIGN §13.24 P1). The `ui-onboarding-end` package replaces this file with the
// real screen; until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function EndScreen({ route }: { route: RouteOf<'end'> }) {
  return <PlaceholderScreen route={route} />;
}
