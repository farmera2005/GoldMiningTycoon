// The guided first season's text (DESIGN §13.14, §1 1.15; S13-11, S13-15, D-13.93; IR-1). Steps are data: a title, a
// one- or two-sentence body with state params (placeholders as in data/text/alerts.ts), and an optional `Show me`
// target (a route and the `data-tutorial-anchor` it spotlights). Completion predicates live with the coach in
// ui/tutorial; they read only the owners' state paths and action types (T24). The coach never blocks input, never
// advances time and never chooses for the player (D-13.23).
//
// The start letters are the coach's start-specific step-1 body and the Profile panel on Company & owner; there is no
// welcome alert kind and `newGame` runs no collation (§1 D-1.76, IR-1).

export interface TutorialStep {
  /** Stable id: the key of `UiPersisted.tutorial.completed`, `dismissed` and `anchors`. */
  readonly id: string;
  /** 1-based position in the default (arid-first Bootstrapper) path, 13.14's table. */
  readonly order: number;
  /** The §1 1.15 week the step belongs to. */
  readonly week: number;
  readonly title: string;
  readonly body: string;
  readonly params: readonly string[];
  /** `Show me`: navigate to `href` and spotlight `[data-tutorial-anchor=anchor]`. */
  readonly showMe?: { readonly href: string; readonly anchor: string };
}

/** 13.14's fourteen steps (§1 1.15's first ten turns; arid district first while the north is frozen). */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'readPosition',
    order: 1,
    week: 1,
    title: 'Read your position',
    body: 'You have {cash:cents} and no ground. The dashboard shows your runway and each district’s season forecast: the north is frozen until breakup, the desert can work now.',
    params: ['cash'],
    showMe: { href: '#/', anchor: 'dashboard-position' },
  },
  {
    id: 'browseMarket',
    order: 2,
    week: 1,
    title: 'Browse the claims market',
    body: 'Filter the market to the desert district. Note each listing’s water source (spring, well potential or none): water decides which plant you can run.',
    params: [],
    showMe: { href: '#/claims/market', anchor: 'claims-district-filter' },
  },
  {
    id: 'watchListings',
    order: 3,
    week: 1,
    title: 'Watch three listings',
    body: 'Star three listings worth a closer look. Watched claims raise alerts when their price changes or your results come in.',
    params: [],
    showMe: { href: '#/claims/market', anchor: 'claims-watch-star' },
  },
  {
    id: 'sellerData',
    order: 4,
    week: 1,
    title: 'Seller data is not evidence',
    body: 'Open the Evidence tab of a watched listing. The seller’s grades and history are claims, not measurements: they carry no weight in your estimate until you test them.',
    params: [],
  },
  {
    id: 'payForInformation',
    order: 5,
    week: 2,
    title: 'Pay for information',
    body: 'Book a site visit with panning on a listing you like. It costs a little cash and some of your own desk days; results come back next week.',
    params: [],
  },
  {
    id: 'readResults',
    order: 6,
    week: 3,
    title: 'Read the results: estimates have ranges',
    body: 'Open the results report, then the claim’s Estimate tab. Pans show whether gold is there, not how much: the range barely narrows. That is what cheap evidence buys.',
    params: [],
  },
  {
    id: 'acquireGround',
    order: 7,
    week: 3,
    title: 'Acquire ground: lease or buy',
    body: 'Lease the better claim at its ask. A lease costs less up front and lets you test before committing more; the royalty is the price.',
    params: [],
  },
  {
    id: 'equipAndCrew',
    order: 8,
    week: 4,
    title: 'Equip, hire and set your own role',
    body: 'Buy a digger and a plant that suits the claim’s water, then hire an operator and a hand. Someone must run the crew: assign yourself as foreman or operator, or hire a foreman.',
    params: [],
    showMe: { href: '#/equipment/market', anchor: 'equipment-market' },
  },
  {
    id: 'mobilizeAndPlan',
    order: 9,
    week: 5,
    title: 'Mobilize and write a mine plan',
    body: 'Mobilize the site, then pick your first cut from the block estimates and set the hours and cleanup interval.',
    params: [],
    showMe: { href: '#/ops/plan', anchor: 'ops-plan-editor' },
  },
  {
    id: 'readBottleneck',
    order: 10,
    week: 6,
    title: 'Read the bottleneck view',
    body: 'After the first operating week, open Flow. The stage bars show where the plant waited, and why.',
    params: [],
    showMe: { href: '#/ops/flow', anchor: 'ops-stage-bars' },
  },
  {
    id: 'fixConstraint',
    order: 11,
    week: 7,
    title: 'Fix the constraint',
    body: 'Change what limits the plant: a truck or loader, more hours, or reassigning yourself. Check the plan preview before you apply it.',
    params: [],
  },
  {
    id: 'firstCleanup',
    order: 12,
    week: 8,
    title: 'First cleanup: raw versus fine',
    body: 'Your first cleanup is weighed in raw ounces; buyers pay for fine ounces. A lease royalty is taken in kind first. Sell to the local buyer or hold.',
    params: [],
    showMe: { href: '#/gold/sell', anchor: 'gold-sell' },
  },
  {
    id: 'monthEnd',
    order: 13,
    week: 9,
    title: 'Month-end P&L and cost per ounce',
    body: 'Open Reports: the P&L shows the month, and cash cost per fine ounce tells you whether the ground pays.',
    params: [],
    showMe: { href: '#/reports/cost-per-oz', anchor: 'reports-cost-per-oz' },
  },
  {
    id: 'seasonsAndTiming',
    order: 14,
    week: 10,
    title: 'Seasons and timing',
    body: 'The northern winter trail closes in about three weeks (around Wk 13). Decide whether to buy northern ground and move now or wait, and set your stop rules for running weeks.',
    params: [],
    showMe: { href: '#/settings', anchor: 'settings-stop-rules' },
  },
];

/**
 * Extra lines the coach adds to a step in some states (13.14 step 8 small-crew branch; s04 #17 week-4 records text).
 */
export const TUTORIAL_NOTES = {
  /** Step 8, when the claim qualifies as a small crew with no foreman (§8 8.12). */
  smallCrew:
    'A crew this small (three hands or fewer, one line, one shift) may work with no foreman, at 92% efficiency (×0.92) and with incident odds ×1.15, while you keep a full office week. A fourth hand needs a foreman.',
  /** Week 4 (s04 #17): what a P1 records review returns. */
  recordsFindings:
    'Records findings cover old workings and creek history. Past production filings come with the full records review in a later version.',
  /** Step 8, for a dry claim. */
  dryWasher: 'On a dry claim a dry-wash plant needs no pump or water source.',
} as const satisfies Readonly<Record<string, string>>;

export interface StartLetter {
  readonly title: string;
  /** The coach's step-1 body for this start and the Profile panel's letter. */
  readonly body: string;
  readonly params: readonly string[];
}

/** Start letters (§1 1.15, D-1.76), keyed by start type and, for Backed starts, the investor terms. */
export const START_LETTERS = {
  bootstrapper: {
    title: 'Your own money, your own call',
    body: 'You put {cash:cents} of your own savings into the company. There is no ground and no iron yet, and no one to answer to. The north is frozen until breakup; the desert can work now.',
    params: ['cash'],
  },
  'backed.equity': {
    title: 'A letter from your investor',
    body: 'Your investor has put up {investorCash:cents} for 40% of the company and a seat at the table. They expect monthly reports, a say on big spending, and a plan for the year by week 4.',
    params: ['investorCash'],
  },
  'backed.royalty': {
    title: 'A letter from your royalty partner',
    body: 'Your royalty partner has advanced {investorCash:cents} against a share of the gold you produce. You keep full control; from year two they expect at least a minimum each year.',
    params: ['investorCash'],
  },
  inheritor: {
    title: 'The estate letter',
    body: 'The family claims are yours, with the camp, the old iron and two blocks stripped ahead. So is the estate note: its first payment falls due in June. Review the family records now and test-pit the rest of the ground after thaw.',
    params: [],
  },
} as const satisfies Readonly<Record<string, StartLetter>>;

export type StartLetterKey = keyof typeof START_LETTERS;
