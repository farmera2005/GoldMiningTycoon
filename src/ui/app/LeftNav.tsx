// The left nav (DESIGN §13.1): chrome with header grain, 224 px or a 56 px icon rail, a brass marker on the active
// item. Nav items for systems not yet built are hidden, not greyed: P0 has the dashboard, Saves and Settings.
import type { ReactNode } from 'react';
import { uiConfig } from '../../data/tuning/ui';
import { DashboardIcon, SavesIcon, SettingsIcon } from '../components/icons';
import { useUi } from '../store/store';
import { routeHref, type KnownRoute, type Route } from './router';

interface NavItem {
  readonly route: KnownRoute;
  readonly label: string;
  readonly icon: ReactNode;
}

interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  { label: 'Overview', items: [{ route: { name: 'dashboard' }, label: 'Dashboard', icon: <DashboardIcon /> }] },
  {
    label: 'System',
    items: [
      { route: { name: 'saves' }, label: 'Saves', icon: <SavesIcon /> },
      { route: { name: 'settings' }, label: 'Settings', icon: <SettingsIcon /> },
    ],
  },
];

export function LeftNav({ route }: { route: Route }) {
  const collapsed = useUi((s) => s.navCollapsed);
  return (
    <nav
      id="app-nav"
      aria-label="Main"
      className={`chrome grain-chrome shrink-0 overflow-y-auto border-r border-chrome-hairline bg-chrome py-3 text-chrome-ink`}
      style={{ width: collapsed ? uiConfig['ui.layout.railPx'] : uiConfig['ui.layout.navPx'] }}
      data-grain-zone="nav"
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-3">
          {collapsed ? null : <div className="px-4 pb-1 text-12 font-semibold text-chrome-ink-2">{group.label}</div>}
          <ul>
            {group.items.map((item) => {
              const active = item.route.name === route.name;
              return (
                <li key={item.label}>
                  <a
                    href={routeHref(item.route)}
                    className={`nav-item flex h-9 items-center gap-3 text-14 hover:bg-chrome-hairline ${collapsed ? 'justify-center' : 'px-4'} ${active ? 'font-semibold text-chrome-ink' : 'text-chrome-ink-2'}`}
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {collapsed ? null : <span>{item.label}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
