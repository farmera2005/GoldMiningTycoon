// Placeholder for §13.4 Inbox & Decisions (DESIGN §13.24 P1). The `ui-inbox-top` package replaces this file with the
// real screen; until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function InboxScreen({ route }: { route: RouteOf<'inbox'> }) {
  return <PlaceholderScreen route={route} />;
}
