// The navigation map as data (DESIGN §13.1): groups, items, the routes each item covers (claim detail lights
// Claims), the `g <key>` shortcut of 13.15 and the phase each item ships in. Items of systems not yet built in this
// phase are hidden, not greyed (13.1); Permits (P2) and News (P5) have no route yet, so they are not listed at all.
import type { ReactNode } from 'react';
import type { RulesPhase } from '../../engine';
import {
  BankIcon,
  CalendarIcon,
  ClaimsIcon,
  CompanyIcon,
  DashboardIcon,
  EquipmentIcon,
  GoldIcon,
  HelpIcon,
  InboxIcon,
  MapIcon,
  OpsIcon,
  ProspectingIcon,
  ReportsIcon,
  SavesIcon,
  SettingsIcon,
  StaffIcon,
} from '../components/icons';
import { UI_PHASE, type KnownRoute, type RouteName } from './routes';

export interface NavItem {
  readonly label: string;
  readonly route: KnownRoute;
  readonly icon: ReactNode;
  /** Route names that mark this item as the current page. */
  readonly matches: readonly RouteName[];
  /** The second key of its `g` sequence (13.15), if it has one. */
  readonly goKey?: string;
  readonly fromPhase: RulesPhase;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_MAP: readonly NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        route: { name: 'dashboard' },
        icon: <DashboardIcon />,
        matches: ['dashboard'],
        goKey: 'd',
        fromPhase: 0,
      },
      {
        label: 'Inbox',
        route: { name: 'inbox', msgId: null },
        icon: <InboxIcon />,
        matches: ['inbox'],
        goKey: 'i',
        fromPhase: 1,
      },
      {
        label: 'Calendar',
        route: { name: 'calendar', tab: 'agenda' },
        icon: <CalendarIcon />,
        matches: ['calendar'],
        goKey: 'c',
        fromPhase: 1,
      },
    ],
  },
  {
    label: 'Ground',
    items: [
      {
        label: 'Claims',
        route: { name: 'claims', tab: 'market' },
        icon: <ClaimsIcon />,
        matches: ['claims', 'claim'],
        goKey: 'l',
        fromPhase: 1,
      },
      {
        label: 'District map',
        route: { name: 'map', districtId: null },
        icon: <MapIcon />,
        matches: ['map'],
        goKey: 'm',
        fromPhase: 1,
      },
      {
        label: 'Prospecting',
        route: { name: 'prospecting', tab: 'programs', programId: null },
        icon: <ProspectingIcon />,
        matches: ['prospecting'],
        goKey: 'x',
        fromPhase: 1,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Operations',
        route: { name: 'ops', claimId: null, tab: 'site', lineId: null },
        icon: <OpsIcon />,
        matches: ['ops'],
        goKey: 'o',
        fromPhase: 1,
      },
      {
        label: 'Equipment',
        route: { name: 'equipment', tab: 'market', machineId: null },
        icon: <EquipmentIcon />,
        matches: ['equipment'],
        goKey: 'e',
        fromPhase: 1,
      },
      {
        label: 'Staff',
        route: { name: 'staff', tab: 'roster', employeeId: null },
        icon: <StaffIcon />,
        matches: ['staff'],
        goKey: 's',
        fromPhase: 1,
      },
    ],
  },
  {
    label: 'Money',
    items: [
      {
        label: 'Bank & loans',
        route: { name: 'bank', tab: 'accounts' },
        icon: <BankIcon />,
        matches: ['bank'],
        goKey: 'b',
        fromPhase: 1,
      },
      {
        label: 'Gold sales',
        route: { name: 'gold', tab: 'inventory' },
        icon: <GoldIcon />,
        matches: ['gold'],
        goKey: 'g',
        fromPhase: 1,
      },
      {
        label: 'Reports',
        route: { name: 'reports', report: 'is' },
        icon: <ReportsIcon />,
        matches: ['reports'],
        goKey: 'r',
        fromPhase: 1,
      },
      {
        label: 'Company & owner',
        route: { name: 'company', tab: 'profile' },
        icon: <CompanyIcon />,
        matches: ['company'],
        goKey: 'u',
        fromPhase: 1,
      },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Saves', route: { name: 'saves' }, icon: <SavesIcon />, matches: ['saves'], fromPhase: 0 },
      { label: 'Settings', route: { name: 'settings' }, icon: <SettingsIcon />, matches: ['settings'], fromPhase: 0 },
      {
        label: 'Help',
        route: { name: 'help', topic: 'glossary' },
        icon: <HelpIcon />,
        matches: ['help'],
        fromPhase: 1,
      },
    ],
  },
];

/** The nav as this build shows it: items of later phases dropped, empty groups dropped. */
export function visibleNav(phase: RulesPhase = UI_PHASE): NavGroup[] {
  return NAV_MAP.map((g) => ({ label: g.label, items: g.items.filter((i) => i.fromPhase <= phase) })).filter(
    (g) => g.items.length > 0,
  );
}

/** The `g <key>` targets of 13.15 that this build ships. */
export function goTargets(phase: RulesPhase = UI_PHASE): ReadonlyMap<string, KnownRoute> {
  const out = new Map<string, KnownRoute>();
  for (const g of visibleNav(phase)) for (const i of g.items) if (i.goKey !== undefined) out.set(i.goKey, i.route);
  return out;
}
