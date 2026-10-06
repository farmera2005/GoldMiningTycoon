// Hash routing (DESIGN §13.1, D-13.1): every screen and entity has a canonical `#/…` route, so explain links, inbox
// links, the command palette and browser back/forward all work without a server. The catalog of screens and tabs is
// routes.ts; this module parses a hash into a Route, builds the canonical hash back, and follows `hashchange`.
//
// Parsing rules: a missing tab takes the screen's first tab; an unknown tab, an id of the wrong kind or an extra
// segment is `notFound`; the query string is ignored by the route itself (screens read it through useRouteQuery).
// Where one position may hold an id or a tab (`#/claims/:claimIdOrTab`, `#/ops/:claimIdOrTab`), it parses as an id
// when it matches the registered prefix and as a tab otherwise (D-13.99).
import { useMemo, useSyncExternalStore } from 'react';
import type { Id } from '../../engine';
import {
  BANK_TABS,
  CALENDAR_TABS,
  CLAIMS_TABS,
  CLAIM_TABS,
  COMPANY_TABS,
  EQUIPMENT_TABS,
  GOLD_TABS,
  HELP_TOPICS,
  OPS_TABS,
  PROSPECTING_TABS,
  REPORT_TABS,
  STAFF_TABS,
  type KnownRoute,
  type LineSlug,
  type Route,
  type TabDef,
} from './routes';

export type {
  BankTab,
  CalendarTab,
  ClaimTab,
  ClaimsTab,
  CompanyTab,
  EquipmentTab,
  GoldTab,
  HelpTopic,
  KnownRoute,
  LineSlug,
  OpsTab,
  ProspectingTab,
  ReportSlug,
  Route,
  RouteName,
  RouteOf,
  StaffTab,
} from './routes';

/**
 * Registered entity ids (§2.4): `prefix_` and at least six digits, as the engine's formatId writes them. The UI may
 * use only the engine's public surface, which does not export the prefix registry, so the few prefixes a route can
 * carry are matched here (see the package report's contract note).
 */
function idPattern(prefix: string): RegExp {
  return new RegExp(`^${prefix}_\\d{6,}$`);
}

const ID_PATTERNS = {
  clm: idPattern('clm'),
  msg: idPattern('msg'),
  dst: idPattern('dst'),
  prog: idPattern('prog'),
  mch: idPattern('mch'),
  emp: idPattern('emp'),
} as const;

type RoutedPrefix = keyof typeof ID_PATTERNS;

/** True when `s` is a registered id of `prefix` (`emp_owner` counts as an employee id, §2.4). */
export function isRouteId<P extends RoutedPrefix>(s: string, prefix: P): s is Id<P> {
  if (prefix === 'emp' && s === 'emp_owner') return true;
  return ID_PATTERNS[prefix].test(s);
}

function tabOf<T extends readonly TabDef[]>(list: T, slug: string | undefined): T[number]['slug'] | null {
  if (slug === undefined) return list[0]?.slug ?? null;
  return list.some((t) => t.slug === slug) ? slug : null;
}

const LINE_SLUGS: readonly LineSlug[] = ['L1', 'L2', 'L3'];
function isLineSlug(s: string): s is LineSlug {
  return (LINE_SLUGS as readonly string[]).includes(s);
}

/** The path part of a hash, normalised: `#/claims/` → `/claims`, `` → `/`, query dropped. */
export function hashPath(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const pathOnly = raw.split('?')[0] ?? '';
  const trimmed = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, '') : pathOnly;
  return trimmed === '' ? '/' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** The query string of a hash as key → value (`#/inbox?from=12&to=14`); screens read filters from it. */
export function hashQuery(hash: string): Readonly<Record<string, string>> {
  const i = hash.indexOf('?');
  if (i < 0) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(hash.slice(i + 1))) out[k] = v;
  return out;
}

/** A screen with only tabs: `#/bank`, `#/bank/ledger`. */
function tabbed<T extends readonly TabDef[]>(
  segs: readonly string[],
  list: T,
  make: (tab: T[number]['slug']) => KnownRoute,
): KnownRoute | null {
  if (segs.length > 1) return null;
  const tab = tabOf(list, segs[0]);
  return tab === null ? null : make(tab);
}

/** A tab with an optional entity id: `#/staff`, `#/staff/candidates`, `#/staff/roster/emp_000004`. */
function tabbedWithId<T extends readonly TabDef[], P extends RoutedPrefix>(
  segs: readonly string[],
  list: T,
  prefix: P,
  make: (tab: T[number]['slug'], id: Id<P> | null) => KnownRoute,
): KnownRoute | null {
  if (segs.length > 2) return null;
  const tab = tabOf(list, segs[0]);
  if (tab === null) return null;
  const id = segs[1];
  if (id === undefined) return make(tab, null);
  return isRouteId(id, prefix) ? make(tab, id) : null;
}

function parseClaims(segs: readonly string[]): KnownRoute | null {
  const [first, second, ...rest] = segs;
  if (rest.length > 0) return null;
  if (first !== undefined && isRouteId(first, 'clm')) {
    const tab = tabOf(CLAIM_TABS, second);
    return tab === null ? null : { name: 'claim', claimId: first, tab };
  }
  if (second !== undefined) return null;
  const tab = tabOf(CLAIMS_TABS, first);
  return tab === null ? null : { name: 'claims', tab };
}

function parseOps(segs: readonly string[]): KnownRoute | null {
  const [first, ...more] = segs;
  if (first === undefined) return { name: 'ops', claimId: null, tab: 'site', lineId: null };
  const withClaim = isRouteId(first, 'clm');
  const claimId = withClaim ? first : null;
  const after = withClaim ? more : segs;
  if (after.length > 2) return null;
  const tab = tabOf(OPS_TABS, after[0]);
  if (tab === null) return null;
  const line = after[1];
  if (line === undefined) return { name: 'ops', claimId, tab, lineId: null };
  // A plant line belongs to a claim (§7 7.2.1): without one, there is no line to show.
  if (claimId === null || !isLineSlug(line)) return null;
  return { name: 'ops', claimId, tab, lineId: line };
}

function parseKnown(path: string): KnownRoute | null {
  if (path === '/') return { name: 'dashboard' };
  const [head = '', ...segs] = path.slice(1).split('/');
  if (segs.some((s) => s === '')) return null;
  const none = segs.length === 0;
  switch (head) {
    case 'inbox': {
      if (segs.length > 1) return null;
      const id = segs[0];
      if (id === undefined) return { name: 'inbox', msgId: null };
      return isRouteId(id, 'msg') ? { name: 'inbox', msgId: id } : null;
    }
    case 'calendar':
      return tabbed(segs, CALENDAR_TABS, (tab) => ({ name: 'calendar', tab }));
    case 'claims':
      return parseClaims(segs);
    case 'map': {
      if (segs.length > 1) return null;
      const id = segs[0];
      if (id === undefined) return { name: 'map', districtId: null };
      return isRouteId(id, 'dst') ? { name: 'map', districtId: id } : null;
    }
    case 'prospecting':
      return tabbedWithId(segs, PROSPECTING_TABS, 'prog', (tab, programId) => ({
        name: 'prospecting',
        tab,
        programId,
      }));
    case 'ops':
      return parseOps(segs);
    case 'equipment':
      return tabbedWithId(segs, EQUIPMENT_TABS, 'mch', (tab, machineId) => ({ name: 'equipment', tab, machineId }));
    case 'staff':
      return tabbedWithId(segs, STAFF_TABS, 'emp', (tab, employeeId) => ({ name: 'staff', tab, employeeId }));
    case 'bank':
      return tabbed(segs, BANK_TABS, (tab) => ({ name: 'bank', tab }));
    case 'gold':
      return tabbed(segs, GOLD_TABS, (tab) => ({ name: 'gold', tab }));
    case 'reports':
      return tabbed(segs, REPORT_TABS, (report) => ({ name: 'reports', report }));
    case 'company':
      return tabbed(segs, COMPANY_TABS, (tab) => ({ name: 'company', tab }));
    case 'help':
      return tabbed(segs, HELP_TOPICS, (topic) => ({ name: 'help', topic }));
    case 'saves':
      return none ? { name: 'saves' } : null;
    case 'settings':
      return none ? { name: 'settings' } : null;
    case 'new':
      return none ? { name: 'newGame' } : null;
    case 'end':
      return none ? { name: 'end' } : null;
    default:
      return null;
  }
}

/** Accepts `#/saves`, `#/saves/`, `/saves` or `` (the dashboard); a query string is ignored. */
export function parseRoute(hash: string): Route {
  const path = hashPath(hash);
  return parseKnown(path) ?? { name: 'notFound', path };
}

/** The canonical path of a route: tabs always spelled out, optional ids and lines only when present. */
export function routePath(route: KnownRoute): string {
  const join = (...parts: (string | null)[]): string => `/${parts.filter((p) => p !== null).join('/')}`;
  switch (route.name) {
    case 'dashboard':
      return '/';
    case 'inbox':
      return join('inbox', route.msgId);
    case 'calendar':
      return join('calendar', route.tab);
    case 'claims':
      return join('claims', route.tab);
    case 'claim':
      return join('claims', route.claimId, route.tab);
    case 'map':
      return join('map', route.districtId);
    case 'prospecting':
      return join('prospecting', route.tab, route.programId);
    case 'ops':
      return join('ops', route.claimId, route.tab, route.claimId === null ? null : route.lineId);
    case 'equipment':
      return join('equipment', route.tab, route.machineId);
    case 'staff':
      return join('staff', route.tab, route.employeeId);
    case 'bank':
      return join('bank', route.tab);
    case 'gold':
      return join('gold', route.tab);
    case 'reports':
      return join('reports', route.report);
    case 'company':
      return join('company', route.tab);
    case 'saves':
      return '/saves';
    case 'settings':
      return '/settings';
    case 'help':
      return join('help', route.topic);
    case 'newGame':
      return '/new';
    case 'end':
      return '/end';
  }
}

/** The route's current tab slug, or null for a screen without tabs. */
export function routeTab(route: KnownRoute): string | null {
  switch (route.name) {
    case 'calendar':
    case 'claims':
    case 'claim':
    case 'prospecting':
    case 'ops':
    case 'equipment':
    case 'staff':
    case 'bank':
    case 'gold':
    case 'company':
      return route.tab;
    case 'reports':
      return route.report;
    case 'help':
      return route.topic;
    default:
      return null;
  }
}

/**
 * The same screen on another tab (the route tabs' links), keeping the entity the screen is about (the claim of claim
 * detail and Operations; Operations keeps its line) and dropping a selected row (a program, machine or employee
 * belongs to the tab it was picked on). Null when the screen has no such tab.
 */
export function routeWithTab(route: KnownRoute, slug: string): KnownRoute | null {
  const pick = <T extends readonly TabDef[]>(list: T): T[number]['slug'] | null =>
    list.some((t) => t.slug === slug) ? slug : null;
  switch (route.name) {
    case 'calendar': {
      const tab = pick(CALENDAR_TABS);
      return tab === null ? null : { ...route, tab };
    }
    case 'claims': {
      const tab = pick(CLAIMS_TABS);
      return tab === null ? null : { ...route, tab };
    }
    case 'claim': {
      const tab = pick(CLAIM_TABS);
      return tab === null ? null : { ...route, tab };
    }
    case 'prospecting': {
      const tab = pick(PROSPECTING_TABS);
      return tab === null ? null : { name: 'prospecting', tab, programId: null };
    }
    case 'ops': {
      const tab = pick(OPS_TABS);
      return tab === null ? null : { ...route, tab };
    }
    case 'equipment': {
      const tab = pick(EQUIPMENT_TABS);
      return tab === null ? null : { name: 'equipment', tab, machineId: null };
    }
    case 'staff': {
      const tab = pick(STAFF_TABS);
      return tab === null ? null : { name: 'staff', tab, employeeId: null };
    }
    case 'bank': {
      const tab = pick(BANK_TABS);
      return tab === null ? null : { ...route, tab };
    }
    case 'gold': {
      const tab = pick(GOLD_TABS);
      return tab === null ? null : { ...route, tab };
    }
    case 'reports': {
      const report = pick(REPORT_TABS);
      return report === null ? null : { name: 'reports', report };
    }
    case 'company': {
      const tab = pick(COMPANY_TABS);
      return tab === null ? null : { ...route, tab };
    }
    case 'help': {
      const topic = pick(HELP_TOPICS);
      return topic === null ? null : { name: 'help', topic };
    }
    default:
      return null;
  }
}

/** `#/claims/clm_000123/estimate`, with an optional query (`#/inbox?from=12`). */
export function routeHref(route: KnownRoute, query?: Readonly<Record<string, string>>): string {
  const q = query === undefined ? '' : new URLSearchParams(query).toString();
  return `#${routePath(route)}${q === '' ? '' : `?${q}`}`;
}

export function navigate(route: KnownRoute, query?: Readonly<Record<string, string>>): void {
  window.location.hash = routeHref(route, query);
}

/** Navigates to a raw `#/…` link (inbox links, explain entity chips) if it names a known route. */
export function navigateHref(href: string): boolean {
  const route = parseRoute(href);
  if (route.name === 'notFound') return false;
  window.location.hash = routeHref(route, hashQuery(href));
  return true;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function currentHash(): string {
  return window.location.hash;
}

/** The current route, re-rendering on `hashchange` (including back and forward). */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash, () => '');
  return parseRoute(hash);
}

/** The current hash's query (filters a screen keeps in the URL, e.g. the run summary's inbox week range). */
export function useRouteQuery(): Readonly<Record<string, string>> {
  const hash = useSyncExternalStore(subscribe, currentHash, () => '');
  return useMemo(() => hashQuery(hash), [hash]);
}
