// Placeholder for §13.1 Help (glossary, shortcuts, tuning viewer) (DESIGN §13.24 P1). The `ui-onboarding-end` package
// replaces this file with the real screen; until then the route renders the shared placeholder (title, route tabs, the
// ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function HelpScreen({ route }: { route: RouteOf<'help'> }) {
  return <PlaceholderScreen route={route} />;
}
