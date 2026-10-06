// The left nav (DESIGN §13.1): chrome with header grain, 224 px or a 56 px icon rail, a brass marker on the active
// item. The groups and items come from nav.tsx; items for systems not yet built in this phase are hidden, not greyed.
import { uiConfig } from '../../data/tuning/ui';
import { useUi } from '../store/store';
import { visibleNav } from './nav';
import { routeHref, type Route } from './router';

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
      {visibleNav().map((group) => (
        <div key={group.label} className="mb-3">
          {collapsed ? null : (
            <div className="px-4 pb-1 text-12 font-semibold tracking-wide text-chrome-ink-2 uppercase">
              {group.label}
            </div>
          )}
          <ul aria-label={collapsed ? group.label : undefined}>
            {group.items.map((item) => {
              const active = item.matches.includes(route.name);
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
