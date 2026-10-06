// Placeholder for §13.4 Calendar (DESIGN §13.24 P1). The `ui-inbox-top` package replaces this file with the real
// screen; until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function CalendarScreen({ route }: { route: RouteOf<'calendar'> }) {
  return <PlaceholderScreen route={route} />;
}
