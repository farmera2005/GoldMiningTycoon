// BALANCE §2.2 (T-xx), §3 (O-xx, G-xx) and §7 (phase applicability and interim bands) as typed data. One entry per
// scored clause: a multi-clause target is scored per clause (DESIGN §2.12: `O-01.S2`, `O-01.B2`) and takes its worst
// clause's status (§3.0). BALANCE.md is canonical; sim/balance/targets.test.ts parses its §7 table and checks every
// ID and every phase status here against it. Bands are inclusive unless marked open; shares are fractions.

export type PhaseNo = 1 | 2 | 3 | 4 | 5 | 6;
export const PHASES: readonly PhaseNo[] = [1, 2, 3, 4, 5, 6];

/** BALANCE §7: G gating, R reported only, — not applicable. */
export type Applicability = 'G' | 'R' | '—';

export interface Band {
  lo: number | null;
  hi: number | null;
  /** True when the edge itself fails ("> 0"). */
  loOpen?: boolean;
  hiOpen?: boolean;
  /** As BALANCE writes it. */
  text: string;
}

export interface PhaseRule {
  status: Applicability;
  /** null: the clause is a rule the extractor scores itself (dominance, ordering), or a reported figure. */
  band: Band | null;
}

/** Metric extractors (sim/balance/scorecard.ts). `unimplemented` always measures null (status N/A). */
export type ExtractorId =
  | 'unimplemented'
  | 'o01.pooledS2'
  | 'o01.pooledB2'
  | 'o02.pooledFsp'
  | 'o02.maxFsp'
  | 'o03.undercapS2'
  | 'o03.undercapB2'
  | 'o06a.bootstrapper'
  | 'o06a.backedEquity'
  | 'o06a.backedRoyalty'
  | 'o06a.inheritor'
  | 'o13.stopsPerYear'
  | 'o13.weekMeanMs'
  | 'o13.weekP95Ms'
  | 'o18.entityGap'
  | 'g03.passiveB5';

export interface TargetClause {
  /** Clause id: `O-01.S2`, `T-08a`, `T-06.rawOz`. */
  id: string;
  /** The BALANCE target id: `O-01`. */
  target: string;
  /** BALANCE part: 2.2 calibration, 3.1 brief, 3.2 design, 3.3 section-owned gates. */
  part: '2.2' | '3.1' | '3.2' | '3.3';
  /** What the clause checks. */
  description: string;
  /** BALANCE §5 metric (or the section that defines it). */
  metric: string;
  extractor: ExtractorId;
  phases: Record<PhaseNo, PhaseRule>;
}

// ----------------------------------------------------------------------------------------------- band helpers

const pctText = (x: number): string => `${Math.round(x * 1000) / 10}%`;
const range = (lo: number, hi: number, text?: string): Band => ({
  lo,
  hi,
  text: text ?? `${pctText(lo)}–${pctText(hi)}`,
});
const atLeast = (lo: number, text?: string): Band => ({ lo, hi: null, text: text ?? `≥ ${pctText(lo)}` });
const atMost = (hi: number, text?: string): Band => ({ lo: null, hi, text: text ?? `≤ ${pctText(hi)}` });
const above = (lo: number, text: string): Band => ({ lo, hi: null, loOpen: true, text });

type Cell = Applicability | [Applicability, Band | null];

/** Six phase cells P1…P6; a bare status reuses `band`. */
function phases(
  cells: readonly [Cell, Cell, Cell, Cell, Cell, Cell],
  band: Band | null = null,
): Record<PhaseNo, PhaseRule> {
  const out = {} as Record<PhaseNo, PhaseRule>;
  PHASES.forEach((p, i) => {
    const c = cells[i] as Cell;
    out[p] = typeof c === 'string' ? { status: c, band: c === '—' ? null : band } : { status: c[0], band: c[1] };
  });
  return out;
}

const gAll = (band: Band | null = null) => phases(['G', 'G', 'G', 'G', 'G', 'G'], band);
const gFrom = (from: PhaseNo, band: Band | null = null, before: Applicability = '—') =>
  phases(PHASES.map((p) => (p < from ? before : 'G')) as unknown as [Cell, Cell, Cell, Cell, Cell, Cell], band);

function clause(
  id: string,
  part: TargetClause['part'],
  description: string,
  metric: string,
  phaseRules: Record<PhaseNo, PhaseRule>,
  extractor: ExtractorId = 'unimplemented',
): TargetClause {
  const target = /^[TOG]-\d{2}/.exec(id)?.[0];
  if (target === undefined) throw new Error(`targets: malformed clause id ${id}`);
  return { id, target, part, description, metric, extractor, phases: phaseRules };
}

// ------------------------------------------------------------------------------------------- §2.2 calibration

const CALIBRATION: TargetClause[] = [
  clause(
    'T-01a.p10',
    '2.2',
    'bcy-weighted grade of economically mined blocks, p10, per template',
    'M-GRADE',
    gAll(atLeast(0.005, '≥ 0.005 oz/bcy')),
  ),
  clause(
    'T-01a.p90',
    '2.2',
    'bcy-weighted grade of economically mined blocks, p90, per template',
    'M-GRADE',
    gAll(atMost(0.035, '≤ 0.035 oz/bcy')),
  ),
  clause(
    'T-01b.north',
    '2.2',
    'paystreak blocks (f ≥ 0.4) with in-situ grade in [0.005, 0.03], north',
    'M-GRADE',
    gAll(atLeast(0.45)),
  ),
  clause(
    'T-01b.arid',
    '2.2',
    'paystreak blocks with in-situ grade in [0.005, 0.03], arid',
    'M-GRADE',
    gAll(atLeast(0.4)),
  ),
  clause('T-01c', '2.2', 'pocket blocks (> 0.1 oz/bcy) among paystreak blocks', 'M-GRADE', gAll(range(0.0005, 0.01))),
  clause('T-02.uneconomic', '2.2', 'listing pool share uneconomic, per template', 'M-CLASS-Y', gAll(range(0.6, 0.72))),
  clause('T-02.marginal', '2.2', 'listing pool share marginal, per template', 'M-CLASS-Y', gAll(range(0.18, 0.3))),
  clause('T-02.good', '2.2', 'listing pool share good, per template', 'M-CLASS-Y', gAll(range(0.05, 0.1))),
  clause('T-02.excellent', '2.2', 'listing pool share excellent, per template', 'M-CLASS-Y', gAll(range(0.007, 0.025))),
  clause(
    'T-03.uneconomic',
    '2.2',
    'EconTest at refSmallNorth costs: uneconomic share',
    'M-CLASS-E',
    gAll(range(0.6, 0.75)),
  ),
  clause(
    'T-03.goodExcellent',
    '2.2',
    'EconTest at refSmallNorth costs: good + excellent share',
    'M-CLASS-E',
    gAll(range(0.05, 0.12)),
  ),
  clause(
    'T-03.starterArid',
    '2.2',
    'EconTest classes for starterArid at the median well, 6% royalty (reported, no band)',
    'M-CLASS-E',
    gAll(),
  ),
  clause(
    'T-04.starterNorth',
    '2.2',
    'starterNorth bcy per plant run hour, season 2',
    'M-RATE',
    gAll(range(30, 75, '30–75 bcy/hr')),
  ),
  clause(
    'T-04.inheritorNorth',
    '2.2',
    'inheritorNorth bcy per plant run hour, season 2',
    'M-RATE',
    gAll(range(30, 75, '30–75 bcy/hr')),
  ),
  clause(
    'T-04.starterArid',
    '2.2',
    'starterArid bcy per plant run hour, season 2',
    'M-RATE',
    gAll(range(30, 75, '30–75 bcy/hr')),
  ),
  clause(
    'T-04.starterAridWellOnly',
    '2.2',
    'starterAridWellOnly bcy per plant run hour (reported; DESIGN §7.20 expects 28–30)',
    'M-RATE',
    gAll(),
  ),
  clause(
    'T-05.rate',
    '2.2',
    'matureNorth bcy per plant run hour, season 2',
    'M-RATE',
    gAll(atLeast(150, '≥ 150 bcy/hr')),
  ),
  clause('T-05.volume', '2.2', 'matureNorth washed bcy, season 2', 'M-RATE', gAll(atLeast(250_000, '≥ 250,000 bcy'))),
  clause(
    'T-06.bcy',
    '2.2',
    'refSmallNorth washed bcy, season 2 (established)',
    'M-RATE',
    gAll(range(55_000, 65_000, '55–65k bcy')),
  ),
  clause('T-06.rawOz', '2.2', 'refSmallNorth raw oz, season 2', 'M-RATE', gAll(range(450, 650, '450–650 raw oz'))),
  clause(
    'T-06.season1',
    '2.2',
    "refSmallNorth season-1 bcy ÷ season 2's (frozen, nothing stripped ahead)",
    'M-RATE',
    gAll(range(0.8, 0.85)),
  ),
  clause(
    'T-07.fuelWages',
    '2.2',
    'fuel + wages (with burden) share of site opex, season 2, five fixtures',
    'M-OPEX',
    gAll(atLeast(0.55)),
  ),
  clause('T-07.rm', '2.2', 'R&M share of site opex, season 2, five fixtures', 'M-OPEX', gAll(atMost(0.3))),
  clause('T-07.fuel', '2.2', 'fuel share of site opex, season 2, five fixtures', 'M-OPEX', gAll(atLeast(0.12))),
  clause('T-07.starterArid', '2.2', 'starterArid opex shares (reported: trucked water dominates)', 'M-OPEX', gAll()),
  clause('T-08a', '2.2', 'refSmallNorth season-2 operating margin', 'M-MARGIN', gAll(above(0, '> 0'))),
  clause(
    'T-08b',
    '2.2',
    'refSmallNorthRoyalty: royalties ÷ operating margin',
    'M-MARGIN',
    gAll(range(0.5, 1.5, '0.5–1.5')),
  ),
  clause(
    'T-08c',
    '2.2',
    'refSmallNorthDebt: (royalties + debt service) ÷ operating margin',
    'M-MARGIN',
    phases(['R', 'R', 'R', 'G', 'G', 'G'], range(0.5, 1.5, '0.5–1.5')),
  ),
  clause(
    'T-08d',
    '2.2',
    'share of cautious producing season-years that are M-FLIP',
    'M-FLIP',
    phases(['R', 'R', 'R', 'G', 'G', 'G'], range(0.15, 0.35)),
  ),
  clause('T-09a', '2.2', 'typical tired-auction hammer of ex13', 'M-PRICE', gFrom(3, range(10_000, 20_000, '$10–20k'))),
  clause('T-09b.dz9', '2.2', 'new dz9 list price', 'M-PRICE', gAll(atLeast(1_500_000, '≥ $1.5M'))),
  clause('T-09b.pkg300', '2.2', 'pkg300 dealer package price', 'M-PRICE', gAll(atLeast(1_500_000, '≥ $1.5M'))),
  clause(
    'T-09c',
    '2.2',
    'P1 used asks of ex30, ld966, adt30 at grades B and C, each',
    'M-PRICE',
    gAll(range(100_000, 500_000, '$100–500k')),
  ),
  clause(
    'T-09.market',
    '2.2',
    'median private-listing ask of ex30, ld966, adt30 (500-world market sample)',
    'M-PRICE',
    gFrom(3, range(100_000, 500_000, '$100–500k')),
  ),
  clause(
    'T-10a',
    '2.2',
    'refSmallNorth break-even in-situ grade at SR 3, permafrost 0.8, 10% royalty',
    'M-BE',
    gAll(range(0.009, 0.013, '0.009–0.013 oz/bcy')),
  ),
  clause(
    'T-10b',
    '2.2',
    'matureNorth ÷ refSmallNorth break-even with royalty, SR 3, thawed ground',
    'M-BE',
    phases(['R', 'R', 'R', 'G', 'G', 'G'], atMost(0.85, '≤ 0.85')),
  ),
  clause(
    'T-10b.frozen',
    '2.2',
    'the same ratio at permafrost 0.8 (reported; an O-04 risk)',
    'M-BE',
    phases(['R', 'R', 'R', 'G', 'G', 'G']),
  ),
  clause(
    'T-10c.ratio',
    '2.2',
    'refSmallNorth frozen ÷ thawed opex-only break-even at SR 3',
    'M-BE',
    gAll(range(1.33, 1.43, '1.38 ± 0.05')),
  ),
  clause(
    'T-10c.yardstick',
    '2.2',
    "DESIGN §3's yardstick ratio minus the engine's, absolute",
    'M-BE',
    gAll(atMost(0.05, '≤ 0.05')),
  ),
  clause(
    'T-11.lowMonth',
    '2.2',
    'refSmallNorthDebt year 2: lowest month-end cash falls in May–July',
    'M-TROUGH',
    phases(['R', 'R', 'R', 'G', 'G', 'G']),
  ),
  clause(
    'T-11.drawdown',
    '2.2',
    "drawdown Jan 1 → low ÷ the year's ops outflows",
    'M-TROUGH',
    phases(['R', 'R', 'R', 'G', 'G', 'G'], atLeast(0.2)),
  ),
  clause(
    'T-11.net',
    '2.2',
    'refSmallNorthDebt year-2 net cash',
    'M-TROUGH',
    phases(['R', 'R', 'R', 'G', 'G', 'G'], above(0, '> 0')),
  ),
  clause(
    'T-12.northSeason',
    '2.2',
    'north site season (operating weeks), median over 500 seeds',
    'M-SEASON',
    gAll(range(20, 24, '20–24 weeks')),
  ),
  clause('T-12.northP5', '2.2', 'north site season P5', 'M-SEASON', gAll(atLeast(19, '≥ 19 weeks'))),
  clause('T-12.northP95', '2.2', 'north site season P95', 'M-SEASON', gAll(atMost(25, '≤ 25 weeks'))),
  clause(
    'T-12.northSluicing',
    '2.2',
    'north full-rate sluicing weeks, median',
    'M-SEASON',
    gAll(range(18, 22, '18–22 weeks')),
  ),
  clause('T-12.arid', '2.2', 'arid effective day-shift weeks, median', 'M-SEASON', gAll(range(44, 49, '44–49 weeks'))),
  clause(
    'T-13',
    '2.2',
    'every DESIGN §10.6 gold-price statistic in its band, at standard and per difficulty',
    'DESIGN §10.6',
    gFrom(5),
  ),
  clause(
    'T-14.events',
    '2.2',
    'player-affecting events per year at refSmallNorth',
    'M-EVENT',
    phases(['—', '—', 'R', 'R', 'G', 'G'], range(3, 6, '3–6 per year')),
  ),
  clause(
    'T-14.majorYears',
    '2.2',
    'years with a major or external shock',
    'M-EVENT',
    phases(['—', '—', 'R', 'R', 'G', 'G'], range(0.4, 0.55)),
  ),
  clause(
    'T-14.catastrophicYears',
    '2.2',
    'years with a catastrophic event',
    'M-EVENT',
    phases(['—', '—', 'R', 'R', 'G', 'G'], range(0.05, 0.12)),
  ),
  clause(
    'T-14.costUnprepared',
    '2.2',
    'unprepared, uninsured event cost ÷ gross revenue',
    'M-EVENT',
    phases(['—', '—', 'R', 'R', 'G', 'G'], range(0.03, 0.06)),
  ),
  clause(
    'T-14.costPrepared',
    '2.2',
    'prepared and insured event cost ÷ gross revenue',
    'M-EVENT',
    phases(['—', '—', 'R', 'R', 'G', 'G'], range(0.015, 0.03)),
  ),
  clause(
    'T-15a',
    '2.2',
    'share of starting districts whose initial market holds a starter permitted lease',
    'M-PERMIT',
    gFrom(2, atLeast(1, '100%')),
  ),
  clause(
    'T-15b',
    '2.2',
    'northern listings with true transferable plan authority (steady-state pool)',
    'M-PERMIT',
    gFrom(2, atLeast(0.08)),
  ),
  clause(
    'T-16',
    '2.2',
    'difficulty keys resolve once to their §1 1.11 values; setup books the §1 1.22 balance sheets',
    'unit test (vitest)',
    gAll(),
  ),
  clause(
    'T-17.uneconomic',
    '2.2',
    'lode class share uneconomic under refEconomicsLode',
    'M-CLASS-L',
    gFrom(6, range(0.65, 0.78)),
  ),
  clause('T-17.marginal', '2.2', 'lode class share marginal', 'M-CLASS-L', gFrom(6, range(0.15, 0.25))),
  clause('T-17.good', '2.2', 'lode class share good', 'M-CLASS-L', gFrom(6, range(0.05, 0.1))),
  clause('T-17.excellent', '2.2', 'lode class share excellent', 'M-CLASS-L', gFrom(6, range(0.005, 0.025))),
  clause(
    'T-17.costs',
    '2.2',
    'reference projects R1–R3 cash costs within ±15% of DESIGN §14.13',
    'M-CLASS-L',
    gFrom(6),
  ),
];

// ------------------------------------------------------------------------------------------- §3.1 brief targets

const O01_S2 = phases([
  ['G', range(0.55, 0.75)],
  ['G', range(0.55, 0.72)],
  ['G', range(0.58, 0.72)],
  ['G', range(0.6, 0.7)],
  ['G', range(0.6, 0.7)],
  ['G', range(0.6, 0.7)],
]);
const O01_B2 = phases([
  ['G', atLeast(0.7)],
  ['G', atLeast(0.7)],
  ['G', atLeast(0.73)],
  ['G', atLeast(0.75)],
  ['G', atLeast(0.75)],
  ['G', atLeast(0.75)],
]);
const O02_CAUTIOUS = phases([
  ['G', range(0.2, 0.45)],
  ['G', range(0.1, 0.35)],
  ['G', range(0.12, 0.35)],
  ['G', range(0.15, 0.35)],
  ['G', range(0.15, 0.35)],
  ['G', range(0.15, 0.35)],
]);
const O03_S2 = phases([
  ['G', range(0.02, 0.4)],
  ['G', range(0.03, 0.35)],
  ['G', range(0.03, 0.35)],
  ['G', range(0.03, 0.35)],
  ['G', range(0.03, 0.35)],
  ['G', range(0.03, 0.35)],
]);
const O04 = (band: Band | null = null) => phases(['R', 'R', 'R', 'G', 'G', 'G'], band);

const BRIEF: TargetClause[] = [
  clause(
    'O-01.S2',
    '3.1',
    'cautious pooled going-concern S2, standard, background none',
    'S_N (§5.2)',
    O01_S2,
    'o01.pooledS2',
  ),
  clause(
    'O-01.B2',
    '3.1',
    'cautious pooled no-bankruptcy B2, standard, background none',
    'B_N (§5.1)',
    O01_B2,
    'o01.pooledB2',
  ),
  clause(
    'O-02.cautious',
    '3.1',
    'cautious pooled first-season profit rate',
    'FSP (§5.6)',
    O02_CAUTIOUS,
    'o02.pooledFsp',
  ),
  clause(
    'O-02.everyBot',
    '3.1',
    'every core-matrix bot’s first-season profit rate',
    'FSP (§5.6)',
    gAll(atMost(0.45)),
    'o02.maxFsp',
  ),
  clause(
    'O-02.someBot',
    '3.1',
    'at least one bot’s first-season profit rate',
    'FSP (§5.6)',
    gAll(atLeast(0.1)),
    'o02.maxFsp',
  ),
  clause('O-03.S2', '3.1', 'undercap S2', 'S_N (§5.2)', O03_S2, 'o03.undercapS2'),
  clause(
    'O-03.B2',
    '3.1',
    'undercap B2 (a filing of either kind in ≥ 60% of runs by year 2)',
    'B_N (§5.1)',
    gAll(atMost(0.4)),
    'o03.undercapB2',
  ),
  clause(
    'O-04.noDominance',
    '3.1',
    'no bot dominates every other bot, per start (S2, median and p90 NW ratio at year 5)',
    'dominance (§5.9)',
    O04(),
  ),
  clause(
    'O-04.aggressiveP90',
    '3.1',
    "aggressive's year-5 p90 NW ratio ÷ cautious's",
    'NW ratio (§5.3)',
    O04(atLeast(1.15, '≥ 1.15')),
  ),
  clause('O-04.cautiousS2', '3.1', 'cautious S2 − aggressive S2', 'S_N (§5.2)', O04(atLeast(0.1, '≥ +10 pp'))),
  clause(
    'O-04.namedBots',
    '3.1',
    'none of the named option and test bots dominates cautious',
    'dominance (§5.9)',
    O04(),
  ),
];

// ------------------------------------------------------------------------------------------- §3.2 design targets

const O06A = phases([
  ['G', range(0.45, 0.85)],
  ['G', range(0.45, 0.85)],
  ['G', range(0.5, 0.8)],
  ['G', range(0.5, 0.8)],
  ['G', range(0.5, 0.8)],
  ['G', range(0.5, 0.8)],
]);
const O07 = phases([
  ['G', atMost(0.07, '±7 pp')],
  ['G', atMost(0.07, '±7 pp')],
  ['G', atMost(0.05, '±5 pp')],
  ['G', atMost(0.05, '±5 pp')],
  ['G', atMost(0.05, '±5 pp')],
  ['G', atMost(0.05, '±5 pp')],
]);
const O14_CASH = phases([
  ['G', range(2600, 3600, '$2,600–3,600')],
  ['G', range(2600, 3600, '$2,600–3,600')],
  ['G', range(2600, 3600, '$2,600–3,600')],
  ['G', range(2600, 3600, '$2,600–3,600')],
  ['G', null],
  ['G', null],
]);
const O14_AISC = phases([
  ['G', range(0.75, 1.0)],
  ['G', range(0.75, 1.0)],
  ['G', range(0.75, 1.0)],
  ['G', range(0.75, 1.0)],
  ['G', range(0.7, 0.9)],
  ['G', range(0.7, 0.9)],
]);
const O15 = (band: Band) => phases(['R', 'G', 'G', 'G', 'G', 'G'], band);
const O17 = phases(['—', '—', 'R', 'R', 'G', 'G'], atMost(0.35));

const DESIGN_TARGETS: TargetClause[] = [
  clause(
    'O-05.S2Order',
    '3.2',
    'cautious S2 easy > standard > hard by ≥ 8 pp per step (McNemar per step)',
    'S_N (§5.2)',
    phases(['R', 'R', 'R', 'R', 'R', 'G']),
  ),
  clause(
    'O-05.nwOrder',
    '3.2',
    'median NW ratio (years 2 and 5) strictly ordered by difficulty',
    'NW ratio (§5.3)',
    phases(['R', 'R', 'R', 'R', 'R', 'G']),
  ),
  clause('O-05.B2Order', '3.2', 'B2 monotone by difficulty', 'B_N (§5.1)', phases(['R', 'R', 'R', 'R', 'R', 'G'])),
  clause('O-06a.bootstrapper', '3.2', 'cautious S2, Bootstrapper', 'S_N (§5.2)', O06A, 'o06a.bootstrapper'),
  clause('O-06a.backedEquity', '3.2', 'cautious S2, Backed equity', 'S_N (§5.2)', O06A, 'o06a.backedEquity'),
  clause('O-06a.backedRoyalty', '3.2', 'cautious S2, Backed royalty', 'S_N (§5.2)', O06A, 'o06a.backedRoyalty'),
  clause('O-06a.inheritor', '3.2', 'cautious S2, Inheritor', 'S_N (§5.2)', O06A, 'o06a.inheritor'),
  clause(
    'O-06b',
    '3.2',
    'year-5 owner-ahead share: largest gap between any two starts',
    'owner-ahead (§5.3)',
    phases(['R', 'R', 'R', 'G', 'G', 'G'], atMost(0.2, '≤ 20 pp')),
  ),
  clause('O-06c', '3.2', 'Inheritor season-1 production-attempt rate', 'attempt (§5.7)', gAll(atLeast(0.8))),
  clause(
    'O-06d.ouster',
    '3.2',
    'Backed equity: P(ouster, forced redemption or reorganization under a redemption demand by season 3 | two losing seasons)',
    'B_N (§5.1)',
    gFrom(4, range(0.4, 0.7)),
  ),
  clause(
    'O-06d.lossRate',
    '3.2',
    'Backed equity two-season loss rate 1 − B2',
    'B_N (§5.1)',
    gFrom(4, range(0.08, 0.25)),
  ),
  clause(
    'O-07.spread',
    '3.2',
    "largest gap between a background's cautious S2 and the five-background mean",
    'S_N (§5.2)',
    O07,
  ),
  clause(
    'O-07.geologistNw',
    '3.2',
    "Geologist median NW ratio ÷ the other four backgrounds' median",
    'NW ratio (§5.3)',
    gAll(atMost(1.15, '≤ 1.15')),
  ),
  clause(
    'O-08.s2Gain',
    '3.2',
    'cautious − noTest S2, common seeds (one-sided 95%)',
    'S_N (§5.2)',
    gAll(atLeast(0.1, '≥ +10 pp')),
  ),
  clause(
    'O-08.nwGain',
    '3.2',
    'cautious − noTest median NW ratio at year 2',
    'NW ratio (§5.3)',
    gAll(atLeast(0.1, '≥ +0.10')),
  ),
  clause(
    'O-08.testingSpend',
    '3.2',
    'cautious year-1 testing spend ÷ first-season capital commitment',
    'O-08',
    gAll(range(0.03, 0.15)),
  ),
  clause(
    'O-09.s2Loss',
    '3.2',
    'cautious − noMaintenance S2 over 5 years',
    'S_N (§5.2)',
    gFrom(3, atLeast(0.08, '≥ 8 pp')),
  ),
  clause(
    'O-09.nwLoss',
    '3.2',
    'cautious − noMaintenance median NW ratio, 5 years',
    'NW ratio (§5.3)',
    gFrom(3, atLeast(0.1, '≥ 0.10')),
  ),
  clause('O-09.season1Margin', '3.2', 'noMaintenance has the higher season-1 operating margin', 'M-MARGIN', gFrom(3)),
  clause(
    'O-10.spread',
    '3.2',
    'hedge50 cut in the p90 − p10 spread of the year-3 NW ratio',
    'NW ratio (§5.3)',
    gFrom(5, atLeast(0.15)),
  ),
  clause(
    'O-10.bankruptcy',
    '3.2',
    'hedge50 cut in BK_N among seeds whose gold falls ≥ 15% in year 1',
    'BK_N (§5.1)',
    gFrom(5, atLeast(0.05, '≥ 5 pp')),
  ),
  clause(
    'O-10.median',
    '3.2',
    "hedge50 median NW ratio ÷ cautious's − 1",
    'NW ratio (§5.3)',
    gFrom(5, range(-0.08, 0.03, '−8% to +3%')),
  ),
  clause(
    'O-11.table',
    '3.2',
    'every DESIGN §10.6 row in band (2,000 × 10 years, market only)',
    'DESIGN §10.6',
    gFrom(5),
  ),
  clause(
    'O-11.fallYear1',
    '3.2',
    'seeds whose gold falls more than 15% in year 1',
    'DESIGN §10.5',
    gFrom(5, range(0.08, 0.16)),
  ),
  clause(
    'O-12.bustsBull',
    '3.2',
    'competitor busts per competitor-year with goldMomentum > +0.10',
    'DESIGN §12.15',
    gFrom(5, range(0.03, 0.08)),
  ),
  clause(
    'O-12.bustsBear',
    '3.2',
    'competitor busts per competitor-year with goldMomentum < −0.15',
    'DESIGN §12.15',
    gFrom(5, range(0.2, 0.35)),
  ),
  clause(
    'O-12.activeCount',
    '3.2',
    'years with the active competitor count within [0.5, 1.5] × ai.competitorCount',
    'DESIGN §12.24',
    gFrom(5, atLeast(0.95)),
  ),
  clause(
    'O-12.contestedWins',
    '3.2',
    'contested listings won by competitors',
    'DESIGN §12.24',
    gFrom(5, range(0.35, 0.6)),
  ),
  clause(
    'O-12.hammerLift',
    '3.2',
    'competitor lift of the median auction hammer in bull years',
    'DESIGN §12.24',
    gFrom(5, range(0.05, 0.1)),
  ),
  clause(
    'O-13.stops',
    '3.2',
    'stops of runToNextDecision per game year under defaultStopRules() (cautious)',
    'O-13',
    gAll(range(25, 60, '25–60 per year')),
    'o13.stopsPerYear',
  ),
  clause('O-13.offSeason', '3.2', 'stops from freeze-up to breakup', 'O-13', gAll(atMost(10, '≤ 10'))),
  clause('O-13.quietRun', '3.2', 'no run of ≥ 26 weeks without a stop in an operating season', 'O-13', gAll()),
  clause(
    'O-13.weekMeanMs',
    '3.2',
    'advanceWeek mean per game-week, explanations off (sim.perf.weekMeanMs)',
    'DESIGN §2.13',
    gAll(atMost(3.5, '≤ 3.5 ms')),
    'o13.weekMeanMs',
  ),
  clause(
    'O-13.weekP95Ms',
    '3.2',
    'advanceWeek p95 per game-week, explanations off (sim.perf.weekCeilingMs)',
    'DESIGN §2.13',
    gAll(atMost(8, '≤ 8 ms')),
    'o13.weekP95Ms',
  ),
  clause(
    'O-14.cashCost',
    '3.2',
    'cautious median cash cost per fine oz, producing seasons (P1 band to P4; reported with the P5 band)',
    'cost/oz (§5.4)',
    O14_CASH,
  ),
  clause('O-14.aisc', '3.2', 'cautious median AISC per fine oz ÷ realized price', 'cost/oz (§5.4)', O14_AISC),
  clause(
    'O-15.cautious',
    '3.2',
    'cautious claims profitable (four starts, claim-weighted), 5 years',
    'M-CLAIMPROFIT (§5.5)',
    O15(range(0.35, 0.6)),
  ),
  clause(
    'O-15.aggressive',
    '3.2',
    'aggressive Bootstrapper claims profitable',
    'M-CLAIMPROFIT (§5.5)',
    O15(range(0.25, 0.5)),
  ),
  clause('O-15.undercap', '3.2', 'undercap claims profitable', 'M-CLAIMPROFIT (§5.5)', O15(atMost(0.25))),
  clause('O-16', '3.2', 'cautious games whose first claim is arid', 'district split', gAll(range(0.15, 0.7))),
  clause('O-17', '3.2', 'bankruptcy filings preceded by a major or catastrophic event', 'event-preceded (§5.10)', O17),
  clause(
    'O-18',
    '3.2',
    'cautious S2 sole proprietor vs LLC, Bootstrapper: absolute gap',
    'S_N (§5.2)',
    gFrom(4, atMost(0.05, '≤ 5 pp')),
    'o18.entityGap',
  ),
  clause(
    'O-19.reachProduction',
    '3.2',
    'fully explored lode targets reaching production',
    'DESIGN §14.13',
    gFrom(6, range(0.35, 0.55)),
  ),
  clause(
    'O-19.failRepay',
    '3.2',
    'producing lode projects failing to repay capital within 5 years',
    'DESIGN §14.13',
    gFrom(6, range(0.25, 0.45)),
  ),
  clause(
    'O-19.gradeRatio',
    '3.2',
    'median realized ÷ estimated lode grade',
    'DESIGN §14.13',
    gFrom(6, range(0.75, 0.95, '0.75–0.95')),
  ),
  clause('O-19.s2Lift', '3.2', 'hard rock lift in year-2 S2', 'S_N (§5.2)', gFrom(6, atMost(0.02, '≤ 2 pp'))),
  clause(
    'O-19.nw',
    '3.2',
    "hardrockSeeker median year-10 NW ÷ the best placer bot's",
    'NW (§5.3)',
    gFrom(6, atMost(2, '≤ 2×')),
  ),
];

// ------------------------------------------------------------------------------------------ §3.3 section gates

const SECTION_GATES: TargetClause[] = [
  clause('G-01.noDominance', '3.3', 'leaseOnly vs buyOnly: no strict dominance', 'dominance (§5.9)', gAll()),
  clause(
    'G-01.leaseSurvives',
    '3.3',
    'on the Bootstrapper, leasing survives more often than buying',
    'S_N (§5.2)',
    gAll(),
  ),
  clause(
    'G-02',
    '3.3',
    'gradeDFleet vs gradeAFleet vs cautious Bootstrapper fleets, 3 seasons: neither dominates',
    'dominance (§5.9)',
    gAll(),
  ),
  clause(
    'G-03',
    '3.3',
    'passive survives 5 years (no-bankruptcy B5) on a start without debt',
    'B_N (§5.1)',
    gAll(atLeast(1, '100%')),
    'g03.passiveB5',
  ),
  clause('G-04.nw', '3.3', "exceeder 5-year median NW ÷ cautious's", 'NW (§5.3)', gFrom(2, atMost(1.1, '≤ 1.10'))),
  clause('G-04.bk', '3.3', "exceeder BK_5 is not lower than cautious's", 'BK_N (§5.1)', gFrom(2)),
  clause(
    'G-05',
    '3.3',
    'seeds where abandoner ends year 3 with lower NW than cautious',
    'NW (§5.3)',
    gFrom(2, atLeast(0.95)),
  ),
  clause('G-06.auction', '3.3', 'auctionOnlyFleet does not dominate cautious', 'dominance (§5.9)', gFrom(3)),
  clause('G-06.rent', '3.3', 'renting everything loses over 3 seasons', 'NW (§5.3)', gFrom(3)),
  clause('G-06.brand', '3.3', 'no brand dominates on every access class', 'dominance (§5.9)', gFrom(3)),
  clause(
    'G-07.cost',
    '3.3',
    'reference-fleet R&M + PM + parts per fleet hour',
    'DESIGN §9.16',
    gFrom(3, range(130, 180, '$130–180/hr')),
  ),
  clause('G-07.mechanicLoad', '3.3', 'mechanic load with one mechanic', 'DESIGN §9.16', gFrom(3, range(0.6, 0.85))),
  clause(
    'G-08',
    '3.3',
    'allHardMoney and royaltyEveryWinter: neither dominates the matrix',
    'dominance (§5.9)',
    gFrom(4),
  ),
  clause(
    'G-09.privatePrice',
    '3.3',
    'median accepted private price ÷ ask',
    'DESIGN §5.20',
    gFrom(5, range(0.75, 0.85)),
  ),
  clause(
    'G-09.hammer',
    '3.3',
    'median auction hammer ÷ V_claimed',
    'DESIGN §5.20',
    gFrom(5, range(0.45, 0.7, '0.45–0.70')),
  ),
];

export const TARGETS: readonly TargetClause[] = [...CALIBRATION, ...BRIEF, ...DESIGN_TARGETS, ...SECTION_GATES];

/** The phase rule of a clause; P0 has none (no BALANCE target applies to the foundation build). */
export function ruleFor(c: TargetClause, phase: number): PhaseRule | null {
  return phase >= 1 && phase <= 6 ? c.phases[phase as PhaseNo] : null;
}
