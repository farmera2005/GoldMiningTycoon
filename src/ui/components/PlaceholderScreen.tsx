// The stand-in every P1 route renders until its screen package lands (P1 plan: the foundation ships the router with
// every route and parameter; each screen package replaces its folder's placeholder). It shows the screen's title, its
// route tabs (so every canonical route is reachable and testable now) and what the route names. It reads no game
// state, so it can never show hidden truth (T8) and needs no explanation (T9).
import { routeHref, routeTab, routeWithTab, type KnownRoute } from '../app/router';
import { SCREENS } from '../app/routes';
import { EmptyState } from './EmptyState';
import { ScreenTitle } from './primitives';
import { RouteTabs } from './Tabs';

/** The ids and line a route names, as `label: value` pairs for the placeholder's note. */
function routeSubjects(route: KnownRoute): [string, string][] {
  switch (route.name) {
    case 'inbox':
      return route.msgId === null ? [] : [['Message', route.msgId]];
    case 'claim':
      return [['Claim', route.claimId]];
    case 'map':
      return route.districtId === null ? [] : [['District', route.districtId]];
    case 'prospecting':
      return route.programId === null ? [] : [['Program', route.programId]];
    case 'ops': {
      const out: [string, string][] = route.claimId === null ? [] : [['Claim', route.claimId]];
      if (route.lineId !== null) out.push(['Plant line', route.lineId]);
      return out;
    }
    case 'equipment':
      return route.machineId === null ? [] : [['Machine', route.machineId]];
    case 'staff':
      return route.employeeId === null ? [] : [['Employee', route.employeeId]];
    default:
      return [];
  }
}

export function PlaceholderScreen({ route }: { route: KnownRoute }) {
  const screen = SCREENS[route.name];
  const current = routeTab(route);
  const tabs = screen.tabs.flatMap((t) => {
    const to = routeWithTab(route, t.slug);
    return to === null ? [] : [{ label: t.label, href: routeHref(to), current: t.slug === current }];
  });
  const subjects = routeSubjects(route);
  const title = route.name === 'claim' ? `Claim ${route.claimId}` : screen.title;
  return (
    <div data-placeholder-screen={route.name}>
      <ScreenTitle title={title} />
      {tabs.length === 0 ? null : <RouteTabs label={`${screen.title} tabs`} tabs={tabs} />}
      <EmptyState title="This screen is being built" id="placeholder">
        <p>
          {screen.title}
          {current === null ? '' : ` · ${screen.tabs.find((t) => t.slug === current)?.label ?? current}`} arrives with
          its system in this phase.
        </p>
      </EmptyState>
      {subjects.length === 0 ? null : (
        <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-13">
          {subjects.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-2">{k}</dt>
              <dd className="text-ink-1" data-code="">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
