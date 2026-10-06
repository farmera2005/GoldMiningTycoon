// The bot catalog (DESIGN §2.12.1; BALANCE §4). Every bot id CLAUDE.md lists is registered here with the phase it
// arrives in; a bot runs only once it is implemented. Bots are frozen within a phase: any change to a bot's rules
// bumps BOT_VERSION, is logged in src/data/tuning/CHANGELOG.md and needs a fresh balance baseline (BALANCE §6.7).
import type { SimStart } from '../setup';
import { passiveBot } from './passive';
import type { Bot, BotId } from './types';

export const BOT_VERSION = '1.0';

export type BotKind = 'brief' | 'test' | 'option';

export interface BotEntry {
  readonly id: BotId;
  /** The build phase whose catalog first ships the bot (§2.12.1 "From"). */
  readonly phase: 1 | 2 | 3 | 4 | 5 | 6;
  readonly kind: BotKind;
  /** What the bot changes against `cautious` (or, for the brief's bots, its character). */
  readonly summary: string;
  /** Starts the bot may play; null = any (§2.12.1: `undercap` is Bootstrapper only). */
  readonly starts: readonly SimStart[] | null;
  /** True for `brandOnly(brandId)`. */
  readonly takesParam: boolean;
  /** Builds the bot (with its parameter, for `brandOnly`), once the bot's phase has shipped it. */
  readonly impl: ((param: string | null) => Bot) | null;
}

function entry(
  id: BotId,
  phase: BotEntry['phase'],
  kind: BotKind,
  summary: string,
  more: Partial<Pick<BotEntry, 'starts' | 'takesParam' | 'impl'>> = {},
): BotEntry {
  return {
    id,
    phase,
    kind,
    summary,
    starts: more.starts ?? null,
    takesParam: more.takesParam ?? false,
    impl: more.impl ?? null,
  };
}

export const BOT_CATALOG: readonly BotEntry[] = [
  entry('cautious', 1, 'brief', 'the careful player: 13-week reserve, tests to indicated, leases, B–C iron'),
  entry('balanced', 1, 'brief', 'between cautious and aggressive: 8-week reserve, tests the best listing to inferred'),
  entry(
    'aggressive',
    1,
    'brief',
    '4-week reserve, largest affordable claimed resource, 7 × 12 h, second claim from year 2',
  ),
  entry(
    'undercap',
    1,
    'brief',
    'undercapitalized, untested ground: no tests, cheapest fleet that can wash, no reserve',
    {
      starts: ['bootstrapper'],
    },
  ),
  entry('noTest', 1, 'test', 'skips pits: seller evidence, records and site visits only (O-08)'),
  entry('heavyProspector', 1, 'test', '3 × the testing budget (diminishing value of information)'),
  entry('leaseOnly', 1, 'test', 'only leases (G-01)'),
  entry('buyOnly', 1, 'test', 'only buys (G-01)'),
  entry('gradeDFleet', 1, 'test', 'buys only grade D (G-02)'),
  entry('gradeAFleet', 1, 'test', 'buys only grade A or new (G-02)'),
  entry('maxHours', 1, 'test', '7 × 12 h every operating week'),
  entry('noStripAhead', 1, 'test', 'never strips ahead'),
  entry('passive', 1, 'test', 'never operates; holds cash and the start assets (G-03)', { impl: () => passiveBot }),
  entry('smallCrewNoForeman', 1, 'option', 'runs crews of 3 or fewer under the small-crew rule, owner in office'),
  entry('exceeder', 2, 'test', 'exceeds every exceedable permit condition (G-04)'),
  entry('abandoner', 2, 'test', 'relinquishes mined-out claims unreclaimed (G-05)'),
  entry('noMaintenance', 3, 'test', 'skips all PM, defers repairs to failure (O-09)'),
  entry('auctionOnlyFleet', 3, 'test', 'buys iron only at auction, bids ≤ 0.85 × visible FMV (G-06)'),
  entry('newOnlyFleet', 3, 'test', 'buys new iron from dealers only (G-06)'),
  entry('rentOnlyFleet', 3, 'test', 'rents everything, monthly with damage waiver (G-06)'),
  entry('brandOnly', 3, 'test', 'buys one brand only (G-06)', { takesParam: true }),
  entry('multiLine', 3, 'option', 'adds a second plant line when the two-line projection reaches 1.5 × one line'),
  entry('poolMechanics', 3, 'option', 'posts mechanics to the district pool at two or more road-access claims'),
  entry('allHardMoney', 4, 'test', 'funds every shortfall with hard money (G-08)'),
  entry('royaltyEveryWinter', 4, 'test', 'sells a royalty each winter (G-08)'),
  entry('hedge50', 5, 'test', 'forwards 50% of the next 26 weeks of production (O-10)'),
  entry('noHedge', 5, 'test', 'never hedges (O-10)'),
  entry('alwaysLocalBuyer', 5, 'test', 'never ships to a refinery'),
  entry('hardrockSeeker', 6, 'test', 'pursues the §14 hard-rock track once develop readiness holds (O-19)'),
];

const BY_ID: Readonly<Record<string, BotEntry>> = Object.fromEntries(BOT_CATALOG.map((e) => [e.id, e]));

export function botEntry(id: string): BotEntry | null {
  return BY_ID[id] ?? null;
}

/** A parsed `--strategy` value: a bot id, plus the brand id of `brandOnly(<brandId>)` (or `brandOnly:<brandId>`). */
export interface BotSpec {
  readonly id: BotId;
  readonly param: string | null;
}

export type BotSpecError =
  | { code: 'BOT_UNKNOWN'; id: string }
  | { code: 'BOT_PARAM_REQUIRED'; id: BotId }
  | { code: 'BOT_PARAM_UNEXPECTED'; id: BotId };

export function parseBotSpec(text: string): { ok: true; spec: BotSpec } | { ok: false; error: BotSpecError } {
  const m = /^([A-Za-z][A-Za-z0-9]*)(?:\(([^()]*)\)|:(.*))?$/.exec(text.trim());
  const id = m?.[1] ?? text;
  const e = botEntry(id);
  if (m === null || e === null) return { ok: false, error: { code: 'BOT_UNKNOWN', id: text } };
  const param = m[2] ?? m[3] ?? null;
  if (e.takesParam && (param === null || param === ''))
    return { ok: false, error: { code: 'BOT_PARAM_REQUIRED', id: e.id } };
  if (!e.takesParam && param !== null) return { ok: false, error: { code: 'BOT_PARAM_UNEXPECTED', id: e.id } };
  return { ok: true, spec: { id: e.id, param } };
}

/** The label a cell and the CSV use for a bot spec: `brandOnly(cat)`, else the id. */
export function botLabel(spec: BotSpec): string {
  return spec.param === null ? spec.id : `${spec.id}(${spec.param})`;
}

/** Bots whose phase has arrived by `phase` (BALANCE §6.4 "each §4.5 bot active in the phase"). */
export function botsActiveIn(phase: number): BotEntry[] {
  return BOT_CATALOG.filter((e) => e.phase <= phase);
}

/** The implementation of a bot, or null when its phase has not shipped it yet. */
export function implementedBot(spec: BotSpec): Bot | null {
  const make = botEntry(spec.id)?.impl ?? null;
  return make === null ? null : make(spec.param);
}
