// Placeholder for §13.7 Equipment (DESIGN §13.24 P1). The `ui-resources` package replaces this file with the real
// screen; until then the route renders the shared placeholder (title, route tabs, the ids the route names).
import type { RouteOf } from '../../app/router';
import { PlaceholderScreen } from '../../components/PlaceholderScreen';

export function EquipmentScreen({ route }: { route: RouteOf<'equipment'> }) {
  return <PlaceholderScreen route={route} />;
}
