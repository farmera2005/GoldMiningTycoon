// The route catalog (DESIGN §13.1 navigation map, D-13.1): every P1 screen, its tabs as URL slugs with their labels,
// and the canonical form of each entity route. The router parses and builds hashes from this table, the left nav
// and the command palette list its screens, and each placeholder screen renders its tabs from it, so one table
// decides what exists. Tabs of later phases (Saved searches, Staking, Auctions, Risk, Permits, Shop, Parts, …) are
// absent until their phase: a hash naming one is `notFound`, and nav items of later systems are hidden (13.1).
import type { Id, RulesPhase } from '../../engine';

export interface TabDef<S extends string = string> {
  readonly slug: S;
  readonly label: string;
}

function tabs<const T extends readonly TabDef[]>(list: T): T {
  return list;
}

export const CALENDAR_TABS = tabs([{ slug: 'agenda', label: 'Agenda' }]);
export const CLAIMS_TABS = tabs([
  { slug: 'market', label: 'Market' },
  { slug: 'owned', label: 'Owned' },
  { slug: 'watched', label: 'Watched' },
]);
/** Claim detail (13.5); `ops` and `pnl` are for owned claims, `offer` only while a listing is open (D-13.99). */
export const CLAIM_TABS = tabs([
  { slug: 'overview', label: 'Overview' },
  { slug: 'estimate', label: 'Estimate' },
  { slug: 'evidence', label: 'Evidence' },
  { slug: 'valuation', label: 'Valuation' },
  { slug: 'offer', label: 'Offer' },
  { slug: 'ops', label: 'Ops' },
  { slug: 'pnl', label: 'P&L' },
]);
export const PROSPECTING_TABS = tabs([
  { slug: 'programs', label: 'Programs' },
  { slug: 'samples', label: 'Sample log' },
  { slug: 'records', label: 'Records & consultants' },
]);
export const OPS_TABS = tabs([
  { slug: 'site', label: 'Site' },
  { slug: 'plan', label: 'Plan' },
  { slug: 'flow', label: 'Flow' },
  { slug: 'production', label: 'Production' },
  { slug: 'cleanups', label: 'Cleanups' },
]);
export const EQUIPMENT_TABS = tabs([
  { slug: 'market', label: 'Market' },
  { slug: 'fleet', label: 'Fleet' },
]);
export const STAFF_TABS = tabs([
  { slug: 'roster', label: 'Roster' },
  { slug: 'candidates', label: 'Candidates' },
  { slug: 'payroll', label: 'Payroll' },
]);
export const BANK_TABS = tabs([
  { slug: 'accounts', label: 'Accounts' },
  { slug: 'bills', label: 'Bills & payments' },
  { slug: 'ledger', label: 'Ledger' },
  { slug: 'loans', label: 'Loans & leases' },
]);
export const GOLD_TABS = tabs([
  { slug: 'inventory', label: 'Inventory' },
  { slug: 'sell', label: 'Sell' },
  { slug: 'history', label: 'History' },
]);
/** P1 reports (13.11): the P&L, per-claim P&L, cash cost per ounce and the simple 13-week forecast. */
export const REPORT_TABS = tabs([
  { slug: 'is', label: 'Income statement' },
  { slug: 'claim-pnl', label: 'Claim P&L' },
  { slug: 'cost-per-oz', label: 'Cost/oz' },
  { slug: '13-week', label: '13-week' },
]);
/** Company & owner (13.12); `investor` shows only for a Backed start (the screen decides). */
export const COMPANY_TABS = tabs([
  { slug: 'profile', label: 'Profile' },
  { slug: 'owner', label: 'Owner' },
  { slug: 'investor', label: 'Investor' },
]);
export const HELP_TOPICS = tabs([
  { slug: 'glossary', label: 'Glossary' },
  { slug: 'shortcuts', label: 'Shortcuts' },
  { slug: 'tuning', label: 'Tuning viewer' },
]);

type SlugOf<T extends readonly TabDef[]> = T[number]['slug'];
export type CalendarTab = SlugOf<typeof CALENDAR_TABS>;
export type ClaimsTab = SlugOf<typeof CLAIMS_TABS>;
export type ClaimTab = SlugOf<typeof CLAIM_TABS>;
export type ProspectingTab = SlugOf<typeof PROSPECTING_TABS>;
export type OpsTab = SlugOf<typeof OPS_TABS>;
export type EquipmentTab = SlugOf<typeof EQUIPMENT_TABS>;
export type StaffTab = SlugOf<typeof STAFF_TABS>;
export type BankTab = SlugOf<typeof BANK_TABS>;
export type GoldTab = SlugOf<typeof GOLD_TABS>;
export type ReportSlug = SlugOf<typeof REPORT_TABS>;
export type CompanyTab = SlugOf<typeof COMPANY_TABS>;
export type HelpTopic = SlugOf<typeof HELP_TOPICS>;
/** Plant lines (§7 7.2.1): `L1`–`L3`; P1 runs one line, and the line segment is optional everywhere. */
export type LineSlug = 'L1' | 'L2' | 'L3';

/**
 * Every route the UI knows. Entity ids are the engine's registered ids (`clm_000123`, `emp_owner`), checked against
 * their prefix when the hash is parsed, so a screen can trust their shape (it still looks the entity up, which may
 * fail: a sold claim's old link).
 */
export type Route =
  | { readonly name: 'dashboard' }
  | { readonly name: 'inbox'; readonly msgId: Id<'msg'> | null }
  | { readonly name: 'calendar'; readonly tab: CalendarTab }
  | { readonly name: 'claims'; readonly tab: ClaimsTab }
  | { readonly name: 'claim'; readonly claimId: Id<'clm'>; readonly tab: ClaimTab }
  | { readonly name: 'map'; readonly districtId: Id<'dst'> | null }
  | { readonly name: 'prospecting'; readonly tab: ProspectingTab; readonly programId: Id<'prog'> | null }
  | {
      readonly name: 'ops';
      /** null: the claim view picks the first held claim. */
      readonly claimId: Id<'clm'> | null;
      readonly tab: OpsTab;
      readonly lineId: LineSlug | null;
    }
  | { readonly name: 'equipment'; readonly tab: EquipmentTab; readonly machineId: Id<'mch'> | null }
  | { readonly name: 'staff'; readonly tab: StaffTab; readonly employeeId: Id<'emp'> | null }
  | { readonly name: 'bank'; readonly tab: BankTab }
  | { readonly name: 'gold'; readonly tab: GoldTab }
  | { readonly name: 'reports'; readonly report: ReportSlug }
  | { readonly name: 'company'; readonly tab: CompanyTab }
  | { readonly name: 'saves' }
  | { readonly name: 'settings' }
  | { readonly name: 'help'; readonly topic: HelpTopic }
  | { readonly name: 'newGame' }
  | { readonly name: 'end' }
  | { readonly name: 'notFound'; readonly path: string };

export type RouteName = Route['name'];
export type KnownRoute = Exclude<Route, { name: 'notFound' }>;
export type RouteOf<N extends RouteName> = Extract<Route, { name: N }>;

/** Screen metadata: the title a placeholder and the palette show, the tabs it has, and the phase it ships in. */
export interface ScreenDef {
  readonly title: string;
  /** The route's tabs, in display order; empty for a screen without tabs. */
  readonly tabs: readonly TabDef[];
  /** The first phase whose UI ships the screen (13.1 navigation map). */
  readonly fromPhase: RulesPhase;
}

export const SCREENS: Readonly<Record<KnownRoute['name'], ScreenDef>> = {
  dashboard: { title: 'Dashboard', tabs: [], fromPhase: 0 },
  inbox: { title: 'Inbox & Decisions', tabs: [], fromPhase: 1 },
  calendar: { title: 'Calendar', tabs: CALENDAR_TABS, fromPhase: 1 },
  claims: { title: 'Claims', tabs: CLAIMS_TABS, fromPhase: 1 },
  claim: { title: 'Claim', tabs: CLAIM_TABS, fromPhase: 1 },
  map: { title: 'District map', tabs: [], fromPhase: 1 },
  prospecting: { title: 'Prospecting', tabs: PROSPECTING_TABS, fromPhase: 1 },
  ops: { title: 'Operations', tabs: OPS_TABS, fromPhase: 1 },
  equipment: { title: 'Equipment', tabs: EQUIPMENT_TABS, fromPhase: 1 },
  staff: { title: 'Staff', tabs: STAFF_TABS, fromPhase: 1 },
  bank: { title: 'Bank & loans', tabs: BANK_TABS, fromPhase: 1 },
  gold: { title: 'Gold sales', tabs: GOLD_TABS, fromPhase: 1 },
  reports: { title: 'Reports', tabs: REPORT_TABS, fromPhase: 1 },
  company: { title: 'Company & owner', tabs: COMPANY_TABS, fromPhase: 1 },
  saves: { title: 'Saves', tabs: [], fromPhase: 0 },
  settings: { title: 'Settings', tabs: [], fromPhase: 0 },
  help: { title: 'Help', tabs: HELP_TOPICS, fromPhase: 1 },
  newGame: { title: 'New game', tabs: [], fromPhase: 0 },
  end: { title: 'End of run', tabs: [], fromPhase: 1 },
};

/**
 * The phase whose screen set this UI ships. The UI leads the engine's BUILD_RULES_PHASE during the P1 build (the
 * screens land as placeholders before their systems), never trails it (a test pins `UI_PHASE ≥ BUILD_RULES_PHASE`).
 */
export const UI_PHASE: RulesPhase = 1;
