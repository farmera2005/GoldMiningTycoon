// The command palette's model (DESIGN §13.1, §13.15, D-13.96; T24): screens, entities by name or id, and verbs. Every
// item is a route: the palette only navigates, to the screen that owns the thing, and never dispatches an engine
// action (a verb such as "Sell gold" opens Gold sales > Sell, where the player acts with the screen's own controls).
//
// Entities come from the screens: a screen folder may export `paletteEntities(state)` from `screens/<group>/
// palette.ts` (visible fields only, through `select.*`), and the palette discovers every such file at build time, so a
// screen package adds its claims, machines or employees without touching the shell. An id typed in full (`clm_000123`)
// always resolves through the router's id patterns, whatever the screens provide.
import type { GameState } from '../../engine';
import { visibleNav } from './nav';
import { isRouteId, routeHref, routeWithTab, type KnownRoute } from './router';
import { SCREENS, UI_PHASE } from './routes';

export type PaletteKind = 'screen' | 'verb' | 'entity';

export interface PaletteItem {
  /** Unique within one result list (the href, plus the entity id for entities). */
  readonly key: string;
  readonly kind: PaletteKind;
  readonly label: string;
  /** Muted context: the screen a tab belongs to, an entity's kind (`Claim`, `Employee`). */
  readonly detail: string;
  /** Extra words that match (synonyms, ids). */
  readonly keywords: string;
  readonly route: KnownRoute;
}

/** What a screen folder's `palette.ts` returns for one entity. */
export interface PaletteEntity {
  readonly id: string;
  /** The entity's visible name (`Caribou Fork #3`, `Dana Whitfield`, `Excavator 30t`). */
  readonly name: string;
  /** Its kind as the player reads it (`Claim`, `Listing`, `Machine`, `Employee`, `Lot`). */
  readonly kind: string;
  readonly route: KnownRoute;
  readonly keywords?: string;
}

export type PaletteEntityProvider = (state: GameState) => readonly PaletteEntity[];

/** Verbs (13.1: "Sell gold", "Hire", …): each opens the screen where the player does it. */
export const PALETTE_VERBS: readonly { label: string; keywords: string; route: KnownRoute }[] = [
  { label: 'Sell gold', keywords: 'lot buyer cash', route: { name: 'gold', tab: 'sell' } },
  { label: 'Set a standing sale order', keywords: 'gold sell cleanup keep cash', route: { name: 'gold', tab: 'sell' } },
  {
    label: 'Hire staff',
    keywords: 'candidates crew operator foreman hand',
    route: { name: 'staff', tab: 'candidates', employeeId: null },
  },
  {
    label: 'Buy equipment',
    keywords: 'machine fleet excavator truck dealer',
    route: { name: 'equipment', tab: 'market', machineId: null },
  },
  {
    label: 'Sell or move a machine',
    keywords: 'fleet dealer transport',
    route: { name: 'equipment', tab: 'fleet', machineId: null },
  },
  { label: 'Lease or buy a claim', keywords: 'ground land listing ask', route: { name: 'claims', tab: 'market' } },
  { label: 'Watch a claim', keywords: 'star listing market', route: { name: 'claims', tab: 'market' } },
  {
    label: 'Start a prospecting program',
    keywords: 'test pit pan sample',
    route: { name: 'prospecting', tab: 'programs', programId: null },
  },
  {
    label: 'Review records or hire a consultant',
    keywords: 'records geologist',
    route: { name: 'prospecting', tab: 'records', programId: null },
  },
  {
    label: 'Write a mine plan',
    keywords: 'cut plan operations',
    route: { name: 'ops', claimId: null, tab: 'plan', lineId: null },
  },
  {
    label: 'Mobilize a site',
    keywords: 'camp site operations',
    route: { name: 'ops', claimId: null, tab: 'site', lineId: null },
  },
  { label: 'Pay bills', keywords: 'payments arrears', route: { name: 'bank', tab: 'bills' } },
  { label: 'Prepay or pay off a loan', keywords: 'debt loan', route: { name: 'bank', tab: 'loans' } },
  { label: 'Read the ledger', keywords: 'transactions postings', route: { name: 'bank', tab: 'ledger' } },
  { label: 'Cash forecast (13 weeks)', keywords: 'runway forecast', route: { name: 'reports', report: '13-week' } },
  { label: 'Cost per ounce', keywords: 'cash cost aisc', route: { name: 'reports', report: 'cost-per-oz' } },
  {
    label: 'Set your own role',
    keywords: 'owner foreman operator office salary draw inject',
    route: { name: 'company', tab: 'owner' },
  },
  { label: 'Edit stop rules', keywords: 'run settings stops', route: { name: 'settings' } },
  { label: 'Save or load a game', keywords: 'slot export import', route: { name: 'saves' } },
  { label: 'Start a new game', keywords: 'wizard setup', route: { name: 'newGame' } },
  { label: 'Keyboard shortcuts', keywords: 'keys help', route: { name: 'help', topic: 'shortcuts' } },
];

/** Screens and their tabs, as this build ships them. Claim detail tabs need a claim, so they come from entities. */
export function screenItems(): PaletteItem[] {
  const out: PaletteItem[] = [];
  for (const group of visibleNav(UI_PHASE)) {
    for (const nav of group.items) {
      out.push({
        key: routeHref(nav.route),
        kind: 'screen',
        label: nav.label,
        detail: group.label,
        keywords: '',
        route: nav.route,
      });
      for (const tab of SCREENS[nav.route.name].tabs) {
        const route = routeWithTab(nav.route, tab.slug);
        if (route === null || routeHref(route) === routeHref(nav.route)) continue;
        out.push({ key: routeHref(route), kind: 'screen', label: tab.label, detail: nav.label, keywords: '', route });
      }
    }
  }
  return out;
}

export function verbItems(): PaletteItem[] {
  return PALETTE_VERBS.map((v) => ({
    key: `verb:${v.label}`,
    kind: 'verb',
    label: v.label,
    detail: SCREENS[v.route.name].title,
    keywords: v.keywords,
    route: v.route,
  }));
}

export function entityItems(entities: readonly PaletteEntity[]): PaletteItem[] {
  return entities.map((e) => ({
    key: `entity:${e.id}:${routeHref(e.route)}`,
    kind: 'entity',
    label: e.name,
    detail: e.kind,
    keywords: `${e.id} ${e.keywords ?? ''}`,
    route: e.route,
  }));
}

/** A full registered id typed into the palette, resolved to its canonical route (screens may add the name). */
export function idItem(query: string): PaletteItem | null {
  const q = query.trim();
  const make = (kind: string, route: KnownRoute): PaletteItem => ({
    key: `id:${q}`,
    kind: 'entity',
    label: q,
    detail: kind,
    keywords: q,
    route,
  });
  if (isRouteId(q, 'clm')) return make('Claim', { name: 'claim', claimId: q, tab: 'overview' });
  if (isRouteId(q, 'msg')) return make('Message', { name: 'inbox', msgId: q });
  if (isRouteId(q, 'dst')) return make('District', { name: 'map', districtId: q });
  if (isRouteId(q, 'prog')) return make('Program', { name: 'prospecting', tab: 'programs', programId: q });
  if (isRouteId(q, 'mch')) return make('Machine', { name: 'equipment', tab: 'fleet', machineId: q });
  if (isRouteId(q, 'emp')) return make('Employee', { name: 'staff', tab: 'roster', employeeId: q });
  return null;
}

/** Match quality of one item for the lower-cased query words, or 0 when a word matches nowhere. */
export function scoreItem(item: PaletteItem, words: readonly string[]): number {
  const label = item.label.toLowerCase();
  const hay = `${label} ${item.detail.toLowerCase()} ${item.keywords.toLowerCase()}`;
  let score = 0;
  for (const w of words) {
    if (label.startsWith(w)) score += 6;
    else if (label.split(/[\s›/&-]+/).some((part) => part.startsWith(w))) score += 4;
    else if (label.includes(w)) score += 2;
    else if (hay.includes(w)) score += 1;
    else return 0;
  }
  return score;
}

const KIND_RANK: Readonly<Record<PaletteKind, number>> = { screen: 0, verb: 1, entity: 2 };

/**
 * The palette's results for a query: with no query, the screens; otherwise every item matching all words, best match
 * first, then screens before verbs before entities, then label. Duplicate keys keep their first item.
 */
export function searchPalette(query: string, items: readonly PaletteItem[], limit = 30): PaletteItem[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '');
  const byId = idItem(query);
  if (words.length === 0) return items.filter((i) => i.kind === 'screen').slice(0, limit);
  const scored = items
    .map((item) => ({ item, score: scoreItem(item, words) }))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind] ||
        (a.item.label < b.item.label ? -1 : a.item.label > b.item.label ? 1 : 0),
    )
    .map((s) => s.item);
  const out: PaletteItem[] = [];
  const seen = new Set<string>();
  for (const item of byId === null ? scored : [byId, ...scored]) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

interface PaletteModule {
  readonly paletteEntities?: PaletteEntityProvider;
}

/** Entity providers of the screens that ship one (`screens/<group>/palette.ts`), in folder order. */
export const SCREEN_ENTITY_PROVIDERS: readonly PaletteEntityProvider[] = Object.entries(
  import.meta.glob<PaletteModule>('../screens/*/palette.ts', { eager: true }),
)
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  .flatMap(([, m]) => (m.paletteEntities === undefined ? [] : [m.paletteEntities]));

/** Every entity the screens can name for this state. */
export function paletteEntities(
  state: GameState | null,
  providers: readonly PaletteEntityProvider[] = SCREEN_ENTITY_PROVIDERS,
): PaletteEntity[] {
  if (state === null) return [];
  return providers.flatMap((p) => p(state));
}
