# Phase 1 cross-section contract (Wave 0)

The contract that Wave 0 ("contracts and skeleton") puts into code before any system package starts, and that every later
P1 package builds against. It fixes, per owner folder: slice shapes, type names, function signatures with their Wave 0
stub bodies, the P1 action list with error and warning codes, the pipeline part table in §2.6 order, the `newGame` init
order, alert kinds, hook rows, RNG and id registry changes, and the tuning keys Wave 0 adds.

Sources: DESIGN.md (cited as §n.m), BALANCE.md, CLAUDE.md, the twelve reader digests (`digest-contracts.json`), and the
triage rulings `rulings-a.md` (cited `s01#3`, `s05#13` …) and `rulings-b.md` (cited `S08-9`, `S11-17` …). Where DESIGN
is silent, the text says **(contract)** and gives the choice; those choices are integrator-class and are recorded as
D-x.n by the integrator at merge. Items flagged **OWNER** are expensive to reverse (CLAUDE.md working rule 2): their
stated default is implemented and the owner is asked.

How to read a function row: `name(args): Return` · **W0** = what Wave 0 writes · **Callers**. "W0 stub → X" means a
body that returns the neutral value X and carries the marker comment `// CONTRACT-STUB(§n)`. "W0 real" means Wave 0
writes the working P1 body because a stub would break an invariant other packages test against (ledger, ids, gold).

---

## 0. Ground rules

### 0.1 What Wave 0 delivers

1. **Framework changes** of §1 below (warnings channel, decision options without an action, `AlertSignal.decisionId`,
   `StepContext.week`, the pipeline part table, per-owner composition files, explain registry, fixture constructor,
   save version 2, history fields, `select.tuning`), each with its unit test.
2. **Every P1 slice** of §2 below, typed in its owner's `systems/<folder>/types.ts`, wired into `GameState`,
   `SLICE_KEYS` order unchanged, with the initial values given here (`emptyXSlice()` or a `newGame` init part).
3. **Every function, selector and explainer** in §4 below, declared in its owner's folder with the stated W0 body.
4. **Every P1 action** of §5 registered through the owner's `actions.ts` with a stub row (§0.2), and the error and
   warning code lists.
5. **Every pipeline part** of §3 below in the part table, calling the owner's function in the §2.6 sub-order, gated by
   `fromPhase`; the `newGame` init parts of §1.5 likewise.
6. **Data:** the hook registry rows (§7), the alert taxonomy rows (§6), the tuning keys of §9.1 with zod shapes, the
   difficulty rows of §9.2, the new data files of §10 as typed empty catalogs, the scrambler registry entries (§11).
7. **Tests:** registry tests (actions, parts order, hooks union, explain names, selector names unique, error-code union
   closed), the stub-allowlist test (§0.2), the regenerated P0 golden under `rulesPhase: 0`, a new
   `p1-passive-52w` golden under `rulesPhase: 1`, save v2 round trip and `SAVE_TOO_OLD` fixture. `npm run check` green.

Acceptance: `npm run check` and `npm run test:e2e` green; `npm run sim -- --games 10 --strategy passive --years 1` runs
under P1 rules (the observer is wired to the stub selectors, §11); `p0-passive-52w` regenerated once with a CHANGELOG
note ("state shape v2; behaviour unchanged under rules p0", D-2.18); nothing in any stub draws on an RNG stream,
mints an id, or posts to the ledger.

### 0.2 Stub conventions

- **Mutators** take `draft: GameState` (an Immer draft, called inside the caller's `produceState`) and change it in
  place; they return ids or result records, never a new state. **Readers** take `state: GameState` and never write.
  Selectors in `select.*` are always readers. Formula functions take `ex: ExplainCtx` last and return `Calc<T>`
  (`core/calc.ts`): `{ value, calc? }`, `calc` built only when `ex.on`.
- **Neutral values** (used by every stub unless the row says otherwise): numbers 0, multipliers 1, booleans false,
  lists `[]`, records `{}`, optional results `null`, availability 1, access open, phase `'operating'`, a
  `Calc` of the neutral number with no `calc`. Reader stubs return the neutral value; mutator stubs do nothing. A stub
  never draws and never mints an id.
- **Creation stubs throw.** A mutator whose contract returns a new id or a generated record (`createTenure`,
  `addProductionInterest`, `createLoan`, `addCandidate`, `addLot`, `materializeInheritedFleet`, `genInheritedGroup`,
  the fixture builders …) cannot be neutral: its W0
  body throws `ContractStubError(id)` (new, `core/assert.ts`), unless the row says **W0 real**. No P0 or Bootstrapper
  passive path reaches one, so the goldens and the passive sim run; any test that does reach one fails loudly.
- **Stub actions.** `stubActionDef(type, ownerSection, { reveals, commits })` (new, `actions/stub.ts`) validates every
  action of that type to `{ code: 'NOT_IMPLEMENTED' }` and has a no-op handler. `NOT_IMPLEMENTED` joins the framework
  codes. The registry exposes `stubbedActionTypes(): string[]`.
- **Stub allowlist.** `tests/contracts/stubAllowlist.ts` lists every `CONTRACT-STUB(§n)` function id and every stubbed
  action type. `tests/contracts/stubs.test.ts` greps `src/engine/**` for the marker and checks
  `found ⊆ allowlist` and `stubbedActionTypes() ⊆ allowlist`. A package that implements a stub deletes its marker and
  its allowlist line in the same commit. P1 exit requires an empty allowlist (integrator check; the test itself never
  goes red on progress).
- A package may **add** fields, functions, codes, alert kinds and keys inside its own folder and namespace files; it may
  not change a signature in this contract without the integrator (designDelta in its report).

### 0.3 File ownership after Wave 0

| File or folder | Owner after Wave 0 | Others |
|---|---|---|
| `src/engine/systems/<folder>/**` (incl. its `types.ts`, `actions.ts`, `select.ts`, `explain.ts`, `report.ts`, `parts.ts`, `hooks.ts`, `errors.ts`) | that folder's package (map in §4) | read-only |
| `src/engine/state/types.ts`, `state/newGame.ts`, `state/fixture.ts`, `actions/catalog.ts`, `actions/types.ts`, `select/index.ts`, `explain/index.ts`, `turn/parts.ts`, `turn/types.ts`, `turn/steps/*`, `engine/index.ts`, `save/**` | integrator only (they only compose; owners never edit them after Wave 0) | — |
| `src/data/tuning/<ns>.ts` | ops→§7 pkg, staff→§8, fleet→§9, land→§5, permits→§6 obligations pkg, market→§10, finance→§11, events→§12/inbox pkg, geology→§4 pkg (keys `geology.*` of §3 by the §3 pkg in a fenced block), game→§1 pkg (the `game.alerts.*` block by the inbox pkg) | — |
| `tests/data/schemas/tuning/<ns>.ts` (W0 splits `TUNING_KEY_SCHEMAS` per namespace) | same as the namespace | — |
| `src/data/difficulty.ts` | integrator; W0 writes every P1 row (§9.2) | — |
| `src/data/events/hooks.ts` | integrator; W0 writes every row (§7) | owners export their key lists from `systems/<folder>/hooks.ts` |
| `src/data/text/alerts.ts`, `decisions.ts`, `glossary.ts`, `tutorial.ts` | UI foundation package (S13-14) | owners send template text in their report |
| `sim/bots/scramblers/<sNN>.ts` | that section's package | `sim/bots/scramble.ts` composes (integrator) |

### 0.4 Phase gating

Every part and every `newGame` init part carries `fromPhase`; the runner calls it only when
`rulesAtLeast(state, fromPhase)`. `BUILD_RULES_PHASE` becomes 1 and `newGame`'s default `rulesPhase` becomes 1 in Wave 0.
`RULES_VERSION` → `'0.2.0'`. A later phase keeps a P1 path behind `rulesAtLeast` (CLAUDE.md).

### 0.5 Hidden information (applies to every new field)

Every field marked HIDDEN below needs (a) exclusion from every selector, validator and bot view, (b) `hidden: true`
with a `knownAlt` on any calc node built from it, (c) a scrambler in `sim/bots/scramblers/<sNN>.ts` (§11 item 4). W0 creates
each scrambler file as an identity function with the marker; the owning package fills it.

### 0.6 Choices this contract makes beyond the rulings (integrator-class unless flagged)

1. **Welcome letters (conflict s01#11 vs S13-15).** Adopt S13-15: no `company.welcome` alert kind; the letters are the
   coach's start-specific step-1 body and a Profile panel; `newGame` runs no collation. Reason: no taxonomy change, no
   turn-0 collation path.
2. **Key names (conflict s01#3 vs S11-4).** Inheritor note keys `game.inheritor.notePrincipalUsd` / `noteRate` /
   `noteTermMonths` / `notePayMonths`; Banker stub keys in `finance.*`: `finance.p1BankerLoanUsd`,
   `finance.p1BankerLoanSpread`, `finance.p1BankerLoanTermMonths` (the loan is §11's product).
3. **`cash.projectedNegative`** is emitted by §11's step-15 part (with the stage evaluation), not in step 16, so step
   16's section list stays §2.6's (§3, §4, §5, §7, §8, §9, §10, §12).
4. **Cross-owner chains run in the framework step files** (owned by the integrator): step 9's per-claim
   `flow → programs (j) → close` and step 12's D-2.10 cleanup chain call owners' functions in order (§3). Owners never
   call each other's step parts.
5. **Production counters (S10-7, s02#9).** Pipeline-only quantities (washed bcy, weighed raw oz, sample raw oz, fine oz
   recovered) reach the history snapshot through `StepContext.week`; quantities that can also move at action time
   (gold sold) use an owner accumulator reset by the snapshot (`gold.weekSales`). `fineOzRecovered` is the one
   production counter (§1 reputation, §11 cost per ounce, history) = gross cleanup weighed raw oz × the lot's
   `estFineness` + sample lots at creation (s01#21, S10-13).
6. **Money naming.** State money ends in `Cents` even where DESIGN's field name does not (`Owner.salaryPerWeekCents`,
   not `salaryPerWeek`).
7. **`GoldLot.rawMilliOz`** (S10-5) and every gold interface in this contract carries `MilliOz` where DESIGN wrote
   `rawOz: number` for traded gold; selectors expose `rawOz` (number, 3 dp).
8. **Wave 0 real bodies** (besides trivial lookups marked **real** in §4) for `finance.pay`, `finance.receive`, `finance.bill`, `finance.billBatch`, the §6 obligation
   CRUD, `recordReputation`, `ownerSkill`, the explain/select composition and `effective()` query builders, because a
   stub would break the ledger, id or obligation invariants other packages test against. The owning packages own and
   may refine them.

OWNER flags raised by this contract: **Q1** the `prospect` stream key `(claimId, 'assay', n)` (s04#4; default adopted),
**Q2** OQ-3.4 hand-cut lever (s03#17; §3/§4 calibration, no Wave 0 code). No other item here changes a pipeline order,
a registered stream key shape, a units rule, a save of a released version, or a BALANCE band.

---

## 1. Framework (§2) changes in Wave 0

### 1.1 Per-owner composition files (s02#11, S13-5)

Every system folder exports, beside `types.ts`:

| File | Exports | Composed by |
|---|---|---|
| `actions.ts` | `<FOLDER>_ACTIONS: readonly ActionDef[]`; the family's action union `<Folder>Action`; `<FOLDER>_ERROR_CODES`, `<FOLDER>_WARNING_CODES` (`as const` string arrays) | `actions/catalog.ts` (registers), `actions/types.ts` (`Action`, `ActionErrorCode`, `ActionWarningCode` unions) |
| `select.ts` | `<folder>Selectors` (object of readers) | `select/index.ts`: `select = { ...framework, ...climate, ...company, … }`; a test fails on a duplicate name |
| `explain.ts` | `<folder>Explainers` (`(state, ...args) => CalcNode`) | `explain/index.ts`; `ExplainerName = keyof typeof explain` (closed union removed from `explain/types.ts`) |
| `report.ts` | the owner's `…WeekRecord` type, `…WeekScratch` type, calc-key builders (`<folder>/<metric>/<entityId>[/<lineId>]`, S13-6) | `turn/types.ts` |
| `parts.ts` | `<FOLDER>_PARTS: readonly PipelinePart[]`, `<FOLDER>_INIT_PARTS: readonly InitPart[]` | `turn/parts.ts` |
| `hooks.ts` | `<FOLDER>_HOOK_KEYS` (the keys this owner reads or publishes) | the hooks-union test (S12-5) against `data/events/hooks.ts` |

Folders and owners: `climate`, `company`, `investors` (§1) · `history` (§2) · `world` (§3) · `knowledge` (§4) · `land`,
`negotiation` (§5; `negotiation` stays empty in P1) · `permits` (§6) · `ops` (§7) · `staff` (§8) · `fleet` (§9) · `gold`
(§10) · `finance` (§11) · `events`, `competitors` (§12) · `inbox` (§13). No new folder.

### 1.2 Actions framework (§2.2; s07#3, S13-3, S08-14, S12-2, S12-3)

```ts
// actions/types.ts
type FrameworkErrorCode = 'ACTION_UNKNOWN' | 'ACTION_MALFORMED' | 'GAME_OVER' | 'DECISION_NOT_FOUND' | 'DECISION_CLOSED'
  | 'OPTION_INVALID' | 'INSUFFICIENT_FUNDS' | 'NOT_IMPLEMENTED' | 'ACTION_NOT_IN_PHASE';
type ActionErrorCode = FrameworkErrorCode | (typeof COMPANY_ERROR_CODES)[number] | … ;      // closed union, one list per folder
type ActionWarningCode = (typeof OPS_WARNING_CODES)[number] | … ;
interface ActionWarning { code: ActionWarningCode; message: string; subject?: EntityRef[] }
type ValidationResult = { ok: true; warnings: ActionWarning[] } | { ok: false; error: ActionError };
interface ActionDef<A extends AnyAction = AnyAction> {
  readonly type: A['type']; readonly ownerSection: number; readonly reveals: boolean; readonly commits: boolean;
  readonly fromPhase: RulesPhase;                         // below it: ACTION_NOT_IN_PHASE
  validate(state: GameState, action: A): ActionError | null;
  warnings?(state: GameState, action: A): ActionWarning[]; // only called when validate passed
  handle(draft: GameState, action: A, ctx: HandlerContext): void;
}
type ActionResult = { ok: true; state: GameState; effects: ActionEffect[]; undoable: boolean; warnings: ActionWarning[] }
                  | { ok: false; error: ActionError };
interface DecisionOption { id: string; labelKey: string; action?: Action; consequenceKey: string }  // no action = close only
```

- `applyAction` collates the result's `{ kind: 'alert' }` effects at once through `collateAlerts(…, 'action')` (§4.13).
- `decision/answer` sets the decision's linked message (`InboxMessage.decisionId`) to `answered` at action time; an
  option without `action` closes the decision with no other effect.
- `ActionDef.fromPhase` is 1 for every P1 action (§5).

### 1.3 Step context and week report (s02#10, S09-16, D-2.45)

```ts
// turn/types.ts
interface StepContext { readonly explain: ExplainCtx; readonly report: WeekReportBuilder; calendar: WeekCalendar | null;
                        readonly week: WeekScratch }                 // emptyWeekScratch() per advanceWeek; never in state
interface WeekScratch {                                              // each sub-object has exactly one writer (its owner)
  desk: DeskWeekScratch;            // §1: { done: DeskTask[] }                                     (written step 7)
  land: LandWeekScratch;            // §5: { listingEvents: ListingEvent[] }                         (step 3, 6)
  fleet: FleetWeekScratch;          // §9: { availability: Record<ClaimId, Record<MachineId, MachineAvailability>> } (step 8)
  ops: OpsWeekScratch;              // §7: per-claim flow state, machineHours, crewHours, ownerHours, costLines,
                                    //     gradeDraws (ops-grade cache, s07#9), results: Record<ClaimId, WeekOpsResult> (step 9)
  knowledge: KnowledgeWeekScratch;  // §4: programMachineUse, programCrewUse, programCosts, programDisturbance, sampleLots (steps 9, 12)
  staff: StaffWeekScratch;          // §8: { hours: Record<EmployeeId, EmployeeWeekHours> }          (step 10)
  cleanup: { results: CleanupResult[] };   // §2 step-12 chain, in chain order
  gold: GoldWeekScratch;            // §10: { lotsCreated: LotId[]; sales: GoldSaleRow[] }           (step 12)
  finance: FinanceWeekScratch;      // §11: { paymentEvents: PaymentEvent[]; payroll: PayrollRunSummary | null } (step 14)
}
interface WeekReport {
  turn: number; alerts: AlertSignal[]; stopCandidates: StopCandidate[];
  ops: Record<ClaimId, { result: WeekOpsResult; cleanups: CleanupResult[] }>;   // §7's real types replace the placeholders
  calc?: Record<string, CalcNode>; hints?: Record<ClaimId, WhatIfHint[]>;        // explain only
  records: WeekRecords;                                                         // new: owners' visible week records
}
interface WeekRecords { climate: ClimateWeekRecord; knowledge: KnowledgeWeekRecord; land: LandWeekRecord;
  staff: StaffWeekRecord; fleet: FleetWeekRecord; gold: GoldWeekRecord; finance: FinanceWeekRecord }
```

W0 record shapes (owners may add fields; visible data only): `ClimateWeekRecord { byDistrict: Record<DistrictId,
{ phase: SeasonPhase; weather: WeatherWeek; forecastIssued: boolean }> }` · `KnowledgeWeekRecord { samplesCompleted:
SampleId[]; resultsReleased: SampleId[]; reportsIssued: ReportId[] }` · `LandWeekRecord { listingsNew: ClaimListingId[];
listingsClosed: ClaimListingId[]; closings: ClosingId[]; settlements: { claimId: ClaimId; lineId: LineId | null;
deliveredRawMilliOz: MilliOz; playerRawMilliOz: MilliOz }[] }` · `StaffWeekRecord { arrivals: EmployeeId[]; departures:
EmployeeId[]; absences: EmployeeId[]; quits: EmployeeId[] }` · `FleetWeekRecord { deliveries: MachineId[];
transportsStalled: TransportJobId[]; maintenanceCents: Cents }` · `GoldWeekRecord { lotsCreated: LotId[]; soldFineOz:
number; soldNetCents: Cents }` · `FinanceWeekRecord { paymentsCents: Cents; shortCents: Cents; arrearsOpen: number;
counterOpen: boolean }`. A WeekReport carries no hidden value outside calc nodes tagged `hidden`.

### 1.4 Pipeline parts (s02#8, s02#11)

```ts
// turn/parts.ts
interface PipelinePart {
  readonly id: string;              // '<folder>.<name>', unique
  readonly step: number;            // 1–16
  readonly order: number;           // position within the step = §2.6 sub-order (§3 of this contract)
  readonly section: number;         // owning DESIGN section
  readonly fromPhase: RulesPhase;
  run(state: GameState, ctx: StepContext): GameState;   // wraps its own work in one produceState
}
export const PIPELINE_PARTS: readonly PipelinePart[];   // concatenation of every folder's parts + framework parts
```

The 17 step files keep their names and become `runParts(step, state, ctx)`; step 0 (guard), the step-1 calendar
derivation, the step-9 and step-12 chains and the step-16 framework pieces are framework parts (`section: 2` or 13).
Tests: the table sorted by `(step, order)` equals §3 of this contract; `fromPhase` gating reproduces P0 under
`rulesPhase: 0` (golden).

### 1.5 `newGame` (D-2.13, s01#17, s03#1–2, S08-8)

- Signature unchanged: `newGame(setup, seed, tuning?, opts?: { rulesPhase?: RulesPhase })`.
- `validateSetup(setup: NewGameSetup, rulesPhase: RulesPhase): SetupIssue[]` (was 1-arg). `startsAvailable(rulesPhase):
  StartType[]`: **W0 returns `['bootstrapper']`**; the §1 company package returns all four for rules ≥ 1 once its start
  setup lands. `DISTRICT_TEMPLATE_NOT_IN_PHASE` checks against the rules phase too.
- `GameMeta` gains `calendarMode: 'drawn' | 'mean'` (always present; `'mean'` only through `newFixtureGame`) and
  `fixtureId?: string`.
- `InitPart { id; order; section; fromPhase; run(draft: GameState, init: InitCtx): void }` with
  `InitCtx { seed: string; setup: NewGameSetup; tuning: TuningResolved; scratch: InitScratch }`.
  `InitScratch { candidates: ListingCandidate[]; inheritor: InheritorStreams | null; fixture: FixtureSpec | null }`.
  Init order (fixed; ids mint in this order, so `lst` goes §5 then §9, D-9.43):

| # | Init part | Owner | fromPhase | Work |
|---|---|---|---|---|
| N1 | `world.generate` | §3 | 0 | `generateWorld` (exists), id reservation |
| N2 | `climate.init` | §1 | 1 | per district: `weather-init` draws, year-1 `season` roll, week-1 forecasts, turn-0 weather, `clock.phase` (mean calendar: no draws) |
| N3 | `world.initialCandidates` | §3 | 1 | `createInitialListings(world, rng(seed,'supply','init'))` → `scratch.candidates` (family run excluded) |
| N4 | `company.inheritorGround` | §1 | 1 | Inheritor only: `scratch.inheritor = inheritorStreams(seed)`; §3 `genInheritedGroup(draft, s.ground, s.pits)`; `npcHeldBaseline` recompute; §4 `addFamilyRecords` |
| N5 | `land.createInitialListings` | §5 | 1 | `createListings(draft, scratch.candidates)` with the stationary age (s05#15) |
| N6 | `fleet.initMarket` | §9 | 1 | dealer-new offers, graded-used dealer offers (S09-3), 6 rotating used listings per district |
| N7 | `gold.init` | §10 | 1 | one local buyer per district (`market-buyers`), `standingOrder = keepCashAbove $0 / bestLocal` |
| N8 | `staff.initPools` | §8 | 1 | per district asc, per role in `Role` order: Poisson(poolTarget) on `rng(seed,'staff-market',0,districtId)` |
| N8b | `knowledge.initContractors` | §4 | 1 | one pitting contractor per region from `data/prospecting/contractors.ts` (no draws) |
| N9 | `company.startSetup` | §1 | 0 | opening books for every start (Bootstrapper exists); Backed agreements + §5 `addProductionInterest` (investorRoyalty); Inheritor tenures (§5 `createTenure` ×3), §9 `materializeInheritedFleet`, §7 `initInheritedSite`, §8 `addCandidate` (s.hand), §11 `createLoan` (estate note) and fuel AP bill; Banker: §11 `createLoan` (fixedP1); `company.reputation.value`, `regulatorStanding`, owner credit score from the start table |
| N10 | `fixture.apply` | §2 | 1 | `newFixtureGame` only (§1.6) |
| N11 | `history.init` | §2 | 0 | pre-history + turn-0 snapshot (exists) |

### 1.6 Fixture games (s02#2, s02#3, S08-27, S08-21)

```ts
// state/fixture.ts (§2) — exported from engine/index.ts; sim/ and tests only (lint forbids it in src/ui)
function newFixtureGame(spec: FixtureSpec, seed: string, opts?: { rulesPhase?: RulesPhase }): GameState;
interface FixtureSpec {
  id: string;                                   // BALANCE §2.1 fixture id
  template: 'northernFederal' | 'aridFederal';
  start: { entity: EntityType; background: OwnerBackground; companyCashUsd: number; personalCashUsd: number };
  claim: ReferenceClaimSpec;                    // §3 builder
  tenure: { kind: 'ownedUnpatented' | 'leased'; costBasisUsd: number; lease?: FixtureLeaseSpec };   // §5 builder
  interests: FixtureInterestSpec[];             // §5 addProductionInterest (lease royalty, investor royalty)
  fleet: { modelId: ModelId; grade: Grade; options?: MachineOption[] }[];     // §9 builder, placed on the claim
  crew: { role: Role; skill: number; reliability?: number; safety?: number; payCentsPerHour?: Cents }[];  // §8 builder
  owner: { assignment: 'foreman' | 'operator' | 'office'; operatorModelId?: ModelId };
  loans: { product: 'fixedP1'; principalUsd: number; annualRate: number; termMonths: number }[];          // §11 createLoan
  site: 'none' | 'ready' | 'winterized';        // §7 builder
  stripAheadBlocks: number;                     // pre-stripped blocks (established season)
  plan: 'default' | Partial<MinePlan>;          // §7 defaultMinePlan or a spec
  tuningOverrides?: TuningOverrides;            // S08-21: { 'staff.quitHazardMult': 0, 'staff.absence.base': 0 }
}
interface ReferenceClaimSpec { acres: number; blocks: number; gradeOzPerBcy: number; payFt: number; bedrockFt: number;
  overburdenFt: number; permafrost: number; clay: number; boulders: number; cementation: number;
  sizeMix: Record<SizeClass, number>; alloyFineness: number;
  water: { kind: 'creek'; gpm: number } | { kind: 'arid'; wellYieldGpm: number | null; springGpm: number | null };
  access: Access; roadMi: number }
```

`newFixtureGame` builds a Bootstrapper `NewGameSetup` with the spec's entity and background, passes the spec's cash as
tuning overrides of `game.start.bootstrapper.companyCashUsd` / `personalCashUsd` (plus `spec.tuningOverrides`), sets
`meta.calendarMode = 'mean'` and `meta.fixtureId` before the init parts run (N2 and the step-1 climate part read the
mode: s02#3's mean calendar, no `season`/`season-fc`/`weather`/`weather-init` draws), then runs N10.
`newFixtureGame`'s orchestration is **W0 real**; the builders it calls are creation stubs (they throw
`ContractStubError`) until their packages land, so a fixture game builds once §3, §5, §7, §8, §9 and §11 have merged.
Builders: §3 `buildReferenceClaim(draft, spec, districtId): ClaimId`
(rewrites one `heldNpc`, unlisted claim of the district to uniform truth, water and access), §5
`fixtureTenure(draft, claimId, spec): TenureId`, §8
`fixtureEmployee(draft, spec, claimId): EmployeeId` (through `addCandidate` with a truth spec, then the hire path,
S08-27), §9 `fixtureMachine(draft, spec, claimId): MachineId`, §7 `fixtureSite(draft, claimId, site, stripAhead,
plan)`, §11 `createLoan` (real by its package). `engine/index.ts` exports these under one `fixtures` namespace.
`FixtureSpec` values live in `src/data/balance/fixtures.ts` (types imported from the engine).

### 1.7 Saves (s02#7, D-2.34)

`CURRENT_SCHEMA_VERSION = 2`, new `MIN_SUPPORTED_SCHEMA_VERSION = 2`, new `SaveErrorCode 'SAVE_TOO_OLD'` (13.16's
message) for v1 files; `MIGRATIONS` stays empty in P1; intra-P1 shape changes need no migration; the v2 shape and a
committed `save-v2.json` fixture freeze at P1 exit. `stateProblem` gains a generic `…Ids`-mirror check for every
`Record` + `…Ids` pair listed in §2, plus per-slice hooks `<folder>SliceProblem(slice): string | null` (W0 stubs →
`null`). `EngineSaveCodec`, `SaveFile.ui` unchanged.

### 1.8 History (§2.5; s01#20–21, s02#9, s02#19, S11-15, S13-8)

```ts
interface CompanySnapshot {                       // + new fields (W0 writes 0 until owners fill ctx.week)
  cashCents; ownerNwCents; companyNwCents; payWashedBcy; weighedRawOz /* cleanup weighings only */; soldFineOz;
  sampleRawOz: number;                            // new: sample lots weighed this week (raw, not in weighedRawOz)
  fineOzRecovered: number;                        // new: §0.6 item 5
  byClaim: Record<ClaimId, { payWashedBcy: number; weighedRawOz: number; fineOzRecovered: number;
                             inKindFineOz: number; inKindValueCents: Cents }>;
}
interface YearRollup {                            // + new fields
  year; cashEndCents; ownerNwEndCents; companyNwEndCents; payWashedBcy; weighedRawOz; soldFineOz; revenueCents;
  netIncomeCents; claimsHeld /* §5 controlledClaimCount */;
  fineOzRecovered: number; cashCostCents: Cents; aiscCents: Cents; cashCostPerOzCents: Cents | null; aiscPerOzCents: Cents | null;
  byClaim: Record<ClaimId, { payWashedBcy: number; fineOzRecovered: number }>;
}
companySnapshot(state: GameState, ctx: StepContext): CompanySnapshot   // reads ctx.week + gold.weekSales (then reset)
export const HISTORY_METRIC_INFO: Record<HistoryMetric, { label: string; unit: Unit }>   // UI deletes its own table
```

Year Y's rollup is written in step 16 of turn 52Y (week 1 of year Y + 1) from the turn-(52Y − 1) snapshot and §11
`periodNetIncome` / `periodTotals` for year Y (s02#9). `cashCostCents`/`aiscCents` from §11 `costPerOunce` for the year.

### 1.9 Selectors, explainers, queries (s02#13, S12-7, S12-14)

- Framework selectors added: `select.tuning(state, key: TuningKey): TuningValue` (resolved engine tuning; not hidden).
  Existing framework selectors move to their owners' `select.ts` with unchanged names: `cashOnHand`, `netWorth`,
  `companyNetWorth` → §11; `market`, `spotUsdPerFineOz` → §10; `heldDistrictIds` → §5 (now real). `dateView`,
  `runStatus`, `runOutcome`, `weeklyHistory`, `annualHistory`, `openDecisions`, `canAdvance` stay §2's.
  `select.periodNetIncome` is §11's.
- `effective()` query builders, **W0 real**, `systems/events/queries.ts`: `qDistrict(districtId)`, `qClaim(state,
  claimId)` → `{ districtId, claimId }`, `qBlock(state, claimId, blockId)`, `qMachine(state, machineId)` →
  `{ districtId?, claimId?, machineId, modelId, brandId }`, `qEmployee(state, empId)`, `qCompany()`.
- `HookDef` (data/events/hooks.ts) becomes `{ key; ownerSection; unit; neutral; ops: ('mul'|'add'|'set')[];
  scopeDims: ('company'|'district'|'claim'|'block'|'machine'|'model'|'brand'|'employee'|'lender')[];
  base: 'neutral' | 'tuning'; baseKey?: TuningKey; consumerPhase: RulesPhase; mulBounds?; addBounds?; setBounds? }`.
  Schema test: `base: 'tuning'` rows need their tuning key (or `baseKey`) to exist once `consumerPhase ≤
  BUILD_RULES_PHASE`.

### 1.10 Public surface additions (`engine/index.ts`)

`newFixtureGame`, `fixtures` (builders of §1.6), `previewStart` and `StartPreview` (§4.2), `startsAvailable`,
`MIN_SUPPORTED_SCHEMA_VERSION`, `HISTORY_METRIC_INFO`, `stubbedActionTypes` (tests only), every owner's public types
named in §4, `ActionWarning`/`ActionWarningCode`, and the explain/select composition (unchanged names `select`,
`explain`).

---

## 2. GameState v2: slice map

Policy (s01#31, S08-9, S12-4): ship every field DESIGN defines for a slice with an inert initial value, so P2–P4 add
behaviour, not fields. **(contract)** Exception: fields whose valid initial value needs later-phase generation are added
by that phase's migration: §6's permit, bond, application and inspection collections (P2), §10's `price`, `macro`,
`news`, `analysts` (P5), §12's `CompetitorSlice` (P5). Every `Record` with an `…Ids` array keeps the array equal to the
sorted key set (§2.5).

| Slice | Owner folder | Type (file) | W0 initial value / what changes from P0 |
|---|---|---|---|
| `meta` | §2 `state/` | `GameMeta` | + `calendarMode: 'drawn'`, optional `fixtureId` |
| `clock` | §2 | `Clock` | `phase` written by §1 (N2, step 1c); unchanged shape |
| `climate` | §1 `climate/` | `ClimateSlice` (exists) | `{}`; N2 fills one `DistrictClimate` per district (rules ≥ 1) |
| `company` | §1 `company/` | `CompanySlice` (§4.2) | full 1.18 shape; owner, investors, reputation, standing, safety record, `timeline` from N9 |
| `world` | §3 `world/` | `WorldSlice` | + `foundTells: Record<string /* '<listingId>/<tellKind>' */, SellerTell>` = `{}` (s03#6) |
| `knowledge` | §4 `knowledge/` | `KnowledgeSlice` (§4.4) | P0 fields + programs, reports, engagements, contractors, sellerChecks, planning, history, sampleConc, assays … all empty |
| `land` | §5 `land/` | `LandSlice` (§4.5) | full 5.2 shape, all collections empty; N5 fills `listings` |
| `permits` | §6 `permits/` | `PermitSlice` (§4.6) | `{ obligations: {}, obligationIds: [] }` |
| `ops` | §7 `ops/` | `OpsSlice` (§4.7) | `{ claims: {}, claimIds: [], lastWeek: {} }` |
| `staff` | §8 `staff/` | `StaffSlice` (§4.8) | full 8.1 shape + S08-9 fields; N8 fills pools |
| `fleet` | §9 `fleet/` | `FleetSlice` (§4.9) | full 9.1 shape (P3 collections empty, `shopPolicy` defaults) + `saleLog: []`; N6 fills the market |
| `gold` | §10 `gold/` | `GoldSlice` (§4.10) | P1 fields + empty P5 collections; N7 fills buyers and the standing order |
| `finance` | §11 `finance/` | `FinanceSlice` (§4.11) | full 11.23 shape with inert values (no `reorg` case, empty credit derogs) |
| `events` | §12 `events/` | `EventsSlice` (§4.12) | full 12.1 shape, director at neutral values |
| `competitors` | §12 `competitors/` | placeholder (exists) | unchanged until P5 |
| `inbox` | §13 `inbox/` | `InboxSlice` | `InboxMessage` + `action?`, `explain?` (S12-11) |
| `history` | §2 `history/` | `HistorySlice` | §1.8 fields |

Hash: these initial values enter the state hash, so Wave 0 regenerates `p0-passive-52w` (under `rulesPhase: 0`) and
records `p1-passive-52w` once (§0.1).

---

## 3. Pipeline step map (the part table, §2.6 order)

`fromPhase` 1 unless marked. P1 work is the subset in force under P1 rules; a part listed with a later phase is
registered now as an empty part so the order is fixed (its body arrives with its phase).

| Step.order | Part id | § | P1 work (DESIGN ref) |
|---|---|---|---|
| 0.1 | `framework.guard` | 2 | (exists, P0) `canAdvance`, turn++, year/week, new report |
| 1.1 | `framework.calendar` | 2 | (exists, P0) `WeekCalendar` into ctx |
| 1.2 | `climate.seasonWeek` | 1 | per district asc: (a) week-1 `season` roll + prune to current and prior year; (b) apply recorded §12 shifts (none in P1); (c) `clock.phase`, reveals, `season.phaseChange` (info, S12-8); (d) forecasts on issue weeks (`season-fc`), `season.forecastUpdate`; (e) `weather` draw and state; `weather.severe` (s01#10). (f) nothing stored (s01#7). Mean calendar: no draws |
| 1.3 | `staff.yearStart` | 8 | week 1 only: experience increments (≥ 12 weeks worked), `seasonsWithCompany`, P1 recall rolls (`staff-rehire`, p 0.75), former re-entry draws |
| 2.1 | `gold.marketStep` | 10 | fromPhase 5 (P1: constants, no draws) |
| 3.1 | `land.marketsRefresh` | 5 | (a) `world.supplyTick` first, then `createListings`; (b) aging, re-pricing (ask and lease terms, 3% hysteresis), expiry → `world.onListingClosed('expired')`; (c) background sales on `land-market` → `onListingClosed('soldOffscreen')`; writes `ctx.week.land.listingEvents` |
| 3.2 | `knowledge.marketsRefresh` | 4 | P1 no-op (registered; P3/P5 fill) |
| 3.3 | `staff.laborMarket` | 8 | per district asc: labor season, wages, pool targets, churn, arrivals (`staff-market`), referrals, re-entries, recruiter deliveries, deposit forfeits |
| 3.4 | `fleet.marketsRefresh` | 9 | expire graded used listings at 6 weeks, one new per district per week up to 6 (`fleet-market`, `fleet-listing`) |
| 4.1 | `gold.campSafeRevert` | 10 | fromPhase 5 |
| 4.2 | `events.eventsStep` | 12 | 4a–4g on the empty catalog (inert; tested on fixture `EventDef`s) |
| 5.1 | `competitors.step` | 12 | fromPhase 5 |
| 6.1 | `land.pendingDeals` | 5 | (c) quick-sale closings; (f) lease anniversaries, AMR obligations one ahead, work test and in-lieu, renewal decision at termEnd − 13, term end, option expiry, surrender effective, cure lapse; (h) §5's own due decision defaults |
| 6.2 | `fleet.pendingDeals` | 9 | factory orders at ETA (balance via `pay`, hold, lapse), transport legs vs `accessOpen`/`claimAccess`, arrivals, assembly |
| 6.3 | `gold.pendingDeals` | 10 | fromPhase 5 |
| 6.4 | `finance.pendingDeals` | 11 | fromPhase 4 |
| 6.5 | `knowledge.pendingDeals` | 4 | contractor bookings start, mobilizations, consultant engagements, records-review engagements |
| 6.6 | `ops.siteTasks` | 7 | site tasks counted in weeks (mobilizing → ready, demobilizing → none), well drilling completes (yield revealed) |
| 7.1 | `company.ownerWeek` | 1 | apply `pendingAssignment`; reset used and forced desk days; capacity 5 / 2.5; walk `deskQueue` (owners' `canResolve`); publish `ctx.week.desk.done` |
| 7.2 | `world.resolveSiteVisits` | 3 | site visits in `ctx.week.desk.done`: report and tells on `rng(seed,'site',turn,claimId)` |
| 7.3 | `staff.availability` | 8 | (a0) pending assignments; (a) arrivals; (c) morale; (d) quits (`staff-quit`); (e) absences (`staff-absence`); (f) training stub; (g) unpaid refusal and `staff.crewAvailableFrac`; (h) `availableFraction`, camp occupancy, small-crew test, `foremanFor` per claim and line, supervision records |
| 8.1 | `fleet.availability` | 9 | `ctx.week.fleet.availability` (P1: in transit or assembling → down share; else 0) |
| 9.1 | `framework.operations` | 2 | for each claim in `ops.claimIds` asc: `ops.operateClaimFlow` (a–i) → `knowledge.runClaimPrograms` (j) → `ops.closeClaimWeek` (k–l); then `knowledge.runOrphanPrograms` (claims not in `ops.claimIds`, asc) |
| 10.1 | `fleet.failures` | 9 | fromPhase 3 (10a) |
| 10.2 | `ops.reResolve` | 7 | fromPhase 3 |
| 10.3 | `fleet.meters` | 9 | 10b: meters += §7 `smr` + §4 program hours; status; `MachineWeekLog` |
| 10.4 | `ops.freezeDamage` | 7 | fromPhase 3 |
| 10.5 | `staff.hoursAndFatigue` | 8 | gather hours (§7 crew, §4 program crew, site mechanic stub, office, cook, owner), fatigue, skill growth, counters, `ctx.week.staff.hours`; injuries fromPhase 2 |
| 10.6 | `events.tallyShocks` | 12 | fromPhase 3 |
| 11.1 | `fleet.shop` | 9 | P1–P2 flat maintenance on SMR incl. program hours (`billBatch`), site upkeep (S09-13), weekly depreciation accrual into `Machine.book.unpostedDepCents` |
| 12.1 | `framework.cleanupChain` | 2 | for each `ops.cleanupsDue(state, ctx)` entry (claims asc, lines asc): `ops.weighCleanup` → `land.settleProductionInterests` → `gold.addLot('cleanup')` → `finance.drawdownDeferredRevenue` → `ops.finishCleanup` (→ `ctx.week.cleanup.results`, report) → `knowledge.recordProduction` → `events.onCleanup` |
| 12.2 | `framework.sampleChain` | 2 | `knowledge.weighSampleConcentrates` → per weighing: `land.settleProductionInterests` → `gold.addLot('sample')` → `knowledge.afterSampleLot` (assay check, s04#4) |
| 12.3 | `gold.standingOrders` | 10 | sell per the standing order through `finance.receive` (`goldSale: true`) using `finance.dueThisWeek(state, finance.pendingCostsThisWeek(state, ctx))` |
| 12.4 | `gold.forwardDeliveries` | 10 | fromPhase 5 |
| 13.1 | `permits.obligationsStep` | 6 | sub-step f: billable obligations unsatisfied at `dueTurn + graceWeeks + 1` → `missed`, routed by owner (§5 `land.onObligationMissed`, §1 `investor.onMinimumMissed` = P1 no-op); recurrences; sub-step j: `obligation.dueSoon` / `obligation.missed` (S12-9, info cap in P1) |
| 14.1 | `finance.financeStep` | 11 | (a) loan interest accrual; (b) payroll (`staff.payrollForWeek`); (c) bills: `ctx.week.ops.costLines`, `ctx.week.knowledge.programCosts`, `staff.drainStaffingCharges`, loan payments in month-end weeks, §1 owner items (salary or draw, week-13 entity fee, turn-1 formation fee), week-52 Backed minimum top-up (§5 `minimumShortfallCents`), billable obligations due, month-end `accrued.royalties`, loan obligations refresh; (d) receipts; (e) one settlement, then `staff.recordPayrollOutcome` per employee asc; (f) statuses, §11-owned obligation misses; (h) month end (depreciation from `fleet.monthDepreciation`, ledger compaction, pruning) |
| 15.1 | `finance.distressStep` | 11 | (b) P1 insolvency counter (`openSinceTurn`), stub stage (S11-17), `distress.stage` signal; (c) liquidation flag `{ cause: 'p1Counter' }` at `t0 + grace`; `cash.projectedNegative` from `forecast13Week` vs `finance.distress.watchWeeks` (§0.6 item 3) |
| 16.1 | `company.reputation` | 1 | 16a: decay, pending deltas with per-kind caps (truncate), week-1 cap reset, log trim 52 wk, week-52 production inputs |
| 16.2 | `investors.weekly` | 1 | 16b: P1 nothing (agreements consistent); check-ins P4 |
| 16.3 | `company.scenario` | 1 | fromPhase 6 |
| 16.4 | `company.runEnd` | 1 | (exists, P0) 16d |
| 16.5 | `world.wrapUp` | 3 | `listing.new`, `listing.priceChanged` (watched or adjacent), `siteVisit.report`; retention (3 reports per claim) |
| 16.6 | `knowledge.wrapUp` | 4 | start records-review engagements from `ctx.week.desk.done`; deliver findings and tells; release results; seller and family checks; estimate refresh (full / incremental / econ rerun) of tracked claims; snapshots; `lastClass`; `prospect.*` alerts; retention |
| 16.7 | `land.wrapUp` | 5 | `lease.anniversarySoon` (info, level), land alerts (§6), work-commitment accumulation from `ctx.week`, closed-listing pruning (13 wk) with found tells |
| 16.8 | `ops.wrapUp` | 7 | `ops.*` alerts (`ops.freezeUpNotWinterized` info in P1, s07#24), `ClaimOps.seasons` summary at season end |
| 16.9 | `staff.wrapUp` | 8 | departures and roster removal, separations pruning, `employee.quit`, `crew.moraleLow`, `crew.noForeman` (only emitter, S08-20), `crew.leadHand`, layoff and recall decisions with their signals (S12-2) |
| 16.10 | `fleet.wrapUp` | 9 | `delivery.arrived`, `transport.stalled`, `transport.windowClosing`; pruning |
| 16.11 | `gold.wrapUp` | 10 | retention (terminal lots > 104 wk → archive; sales ring 104 wk) |
| 16.12 | `events.wrapUp` | 12 | `annualCounts`, history |
| 16.13 | `framework.decisionDefaults` | 2 | (exists, P0) fallback due defaults, closed-decision pruning |
| 16.14 | `inbox.collate` | 13 | `collateAlerts(…, 'week')`: messages, level/edge, reopen window, auto-resolve, obligation grouping, retention, defaulted marks, stop candidates |
| 16.15 | `framework.history` | 2 | (exists, extended) snapshot from `companySnapshot(state, ctx)`; at week 1 the previous year's rollup (§1.8) |
| 16.16 | `framework.reportCalc` | 2 | (exists) explain trees when `ctx.explain.on` |

Step 9 and step 12 functions are listed in their owners' sections (§4.4, §4.5, §4.7, §4.10, §4.11, §4.12). §1's step-14
owner items and §8's payroll are called by §11 inside 14.1; no other section has a part in steps 13–15.

---

## 4. Per-owner contracts

Each subsection: slice and types · functions (signature · W0 body · callers) · actions (detail in §5) · parts ·
alerts · hooks · RNG · hidden fields · selectors and explainers. Types DESIGN prints in full are cited ("verbatim
§x.y") and only the P1 deltas are spelled out.

Supporting types used across owners and fixed here: `TempBand = WeatherWeek['tempBand']` (§1);
`GoldLotLocation` = the verbatim §10 10.9 location union; `ProgramDraft = Omit<Extract<ProspectAction, { type:
'prospect/createProgram' }>, 'type'>` and `ProgramPatch = Partial<Omit<ProgramDraft, 'claimId' | 'methodId' |
'delivery'>>` (§4); `OfferPreview { cashAtCloseCents: Cents; closingCostsCents: Cents; firstYearObligations:
ObligationSpec[]; validation: ValidationResult; forecastAfterClose: Forecast13Week }` (§5); `InvestorTermsView` = the
visible fields of `InvestorAgreement` (§1); `ClaimWaterView` = the visible fields of §3's `ClaimWater` plus
`listedFlowGpm`. Types used inside one owner only (`PayrollRunSummary`, `TailingsAuditReport`, `ClaimSeasonSummary`,
`LessonRef`, `ClassDef` …) are that owner's to shape.

### 4.1 §1 climate (`systems/climate/`)

**Types** (exist, verbatim §1 1.4.3, 1.5): `SeasonPhase`, `SeasonPhaseByDistrict`, `SeasonForecast`,
`DistrictYearSeason`, `WeatherWeek`, `WeatherState`, `DistrictClimate`, `ClimateSlice`. New:

```ts
type AccessMode = 'highway' | 'seasonalRoad' | 'winterTrail' | 'air' | 'barge';          // s01#8
type Outlook = 'open' | 'closed' | 'uncertain';
type PhaseOutlook = SeasonPhase | 'uncertain';
interface SeasonView {                                // revealed dates only (D-1.27)
  districtId: DistrictId; year: number; phase: SeasonPhase;
  breakupWeek: number | null; operatingStartWeek: number | null; freezeUpWeek: number | null; operatingEndWeek: number | null;
  monsoonStartWeek: number | null; monsoonEndWeek: number | null;   // once each has begun
  forecast: SeasonForecast }
type CalendarMode = 'drawn' | 'mean';                // GameMeta.calendarMode
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `seasonPhase(state, districtId): SeasonPhase` | **real**: `clock.phase[districtId] ?? 'operating'` | §3, §4, §7, §8, §9, §13, stops |
| `phaseOutlook(state, districtId, turn): PhaseOutlook` (s01#9: absolute turn; unrolled years use climatology) | stub → `'operating'` | §7 forecast, §8 rush window, §9 spring pricing, §11, bots |
| `seasonForecast(state, districtId): SeasonForecast \| null` | stub → `null` | §8, §13, bots |
| `seasonView(state, districtId): SeasonView` | stub → phase from `seasonPhase`, every date `null`, empty forecast | §13, bots |
| `weather(state, districtId): WeatherWeek` | stub → `{ tempBand: 'mild', precip: 'normal', streamFlowFactor: 1, fireDanger: 0, meanTempF: 60, fireLevel: 0 }` | §3 water, §4, §7, §8 heat fatigue, §9 cold |
| `fireLevel(state, districtId): 0\|1\|2\|3\|4` | stub → 0 | §7, §13 chip |
| `accessOpen(state, districtId, mode: AccessMode): boolean` (current week; computed, nothing cached, s01#7; applies district-scoped `geology.access.closed`, `access.roadOpen`, `access.airOpen`) | stub → `true` | §3 `claimAccess`, §8 arrivals, §9 transports |
| `accessOutlook(state, districtId, mode, turn): Outlook` | stub → `'open'` | §9 booking, §13 calendar, bots |
| `weatherHoursMult(state, districtId, shift: 0 \| 1, ex): Calc<number>` (P1: heat × fire-level hours; precipitation P5) | stub → 1 | §7 |
| `shiftHoursCap(state, districtId, shift): number \| null` **(contract)**: fire level 3 caps the day shift at `ops.fireLevel3DayShiftMaxHours` | stub → `null` | §7 |
| `expectedActiveWeeks(state, districtId, year): number` | stub → 0 (consumer §6 from P2) | §6 |
| `initClimate` (init N2), `seasonWeek` (part 1.2) | stubs (no-op) | framework |

**Alerts:** `season.phaseChange` (info, edge; the `seasonPhase` stop rule is its only stop path, S12-8),
`season.forecastUpdate` (info, edge), `weather.severe` (s01#10: edge, held districts only, one per district per week,
dedupe `weather.severe:<districtId>:<kind>`; warning on fire level rising to ≥ 3 or an arid storm week with a held
seasonal-road claim; info on fire level rising to 2, the arid day-shift heat factor first ≤ 0.70, a northern storm).
**Hooks published:** `season.breakupShiftWeeks`, `season.freezeUpShiftWeeks`, `access.roadOpen`, `access.airOpen`.
**RNG:** `season (year, districtId)`, `season-fc (year, districtId, kind, issueWeek)`, `weather (turn, districtId)`,
`weather-init (districtId)` — registered; s01#12 fixes `weather-init`'s draw order (tempAnom, moistAnom, wetnessPrev).
**Hidden:** `DistrictYearSeason.z`, every unrevealed date, `WeatherState`, `wetnessPrev`, forecast noise; calc nodes
from them hidden with `knownAlt` (s01#27). Scrambler `sim/bots/scramblers/s01.ts`.
**Selectors:** `seasonPhase`, `phaseOutlook`, `seasonForecast`, `seasonView`, `weather`, `fireLevel`, `accessOpen`,
`accessOutlook`. **Explainers:** `seasonForecast(districtId)`, `weatherHoursMult(districtId, shift)`.
**Report:** `ClimateWeekRecord`.

### 4.2 §1 company and investors (`systems/company/`, `systems/investors/`)

**Slice** (verbatim §1 1.18 `CompanySlice`, with the P1 deltas):

```ts
interface CompanySlice {
  name; entity; pendingEntity /* null in P1 */; background; start; difficulty; mode;
  owner: Owner;
  investors: Record<InvestorAgreementId, InvestorAgreement>; investorIds: InvestorAgreementId[];
  reputation: { value: number; pending: ReputationEntry[]; log: ReputationEntry[] /* 52 wk */; capsUsedThisYear: Record<string, number> };
  regulatorStanding: number;            // game.start.regulatorStandingStart 60; Inheritor game.inheritor.regulatorStandingStart 55
  safetyRecord: SafetyRecord;           // §8 type; { value: staff.safetyRecord.start (50), lastLostTimeTurn: null, log: [] }
  scenario: ScenarioProgress | null;    // null (sandbox)
  runStatus; endReason; liquidationPath;
  timeline: TimelineEntry[];            // s01#20: ring of game.endReport.timelineMaxEntries (200)
}
interface Owner {                       // §1 1.9 less the ledger mirrors (s01#6), plus the desk queue (s01#1)
  name: string;
  personalCreditScore: number;          // game.start.<start>.personalCreditScore (760 / 720 / 680); scored from P4
  guarantees: Guarantee[];              // inert until P4; Inheritor LLC/corp gets one on the estate note (s01#18)
  salaryPerWeekCents: Cents;            // 0 at start
  assignment: OwnerAssignment;          // { kind: 'office' } at start
  pendingAssignment: OwnerAssignment | null;
  deskDaysUsedThisWeek: number; deskDaysForcedThisWeek: number;
  deskQueue: DeskTask[];                // FIFO; array order = insertion order
  injuredUntilTurn: number | null;      // null in P1
}
type OwnerAssignment = /* verbatim §1 1.9 */ { kind: 'office' } | { kind: 'foreman'; claimId: ClaimId }
  | { kind: 'operator'; claimId: ClaimId; machineId: MachineId } | { kind: 'shop'; mode: 'site'; claimId: ClaimId }
  | { kind: 'shop'; mode: 'pool'; districtId: DistrictId } /* P3 */ | { kind: 'fieldGeologist'; programId: ProgramId };
interface Guarantee { loanId: LoanId; kind: 'full' | 'limited' | 'indemnity'; capCents: Cents | null; releasedTurn: number | null }
type DeskTaskKind = 'siteVisit' | 'recordsReview' | 'sellerAudit' | 'closing';         // 'permitPrep' from P2
interface DeskTask { kind: DeskTaskKind; ownerSection: 3 | 4 | 5 | 6; ref: EntityRef; daysTotal: number;
                     daysRemaining: number; queuedTurn: number }
interface ReputationEntry { turn: number; kind: ReputationKind; delta: number; ref: Id | null }
type ReputationKind = keyof (typeof gameTuning)['game.reputation.delta'];   // the 1.12 table as `as const` data (§9.1)
  // P1 inputs (s01#23): missedPayroll, partialPayroll, seasonProduction, recordYear, royaltyPaidInFull,
  // missedAdvanceRoyalty, leaseTerminatedDefault, dealClosed, firings3InWeek, sponsorship
interface TimelineEntry { turn: number; kind: 'purchase' | 'lease' | 'loan' | 'hire' | 'sale' | 'distress' | 'liquidation';
                          ref: EntityRef | null; amountCents: Cents; note: string; evidenceClass?: EvidenceClass }
interface InvestorAgreement { /* verbatim §1 1.8.1 */ }   // minus deliveredValueCents (derived from §5's interest, s01#25);
                                                          // prefUnpaidCents stays 0 under P1–P3 rules (s01#5)
interface InheritorStreams { ground: Rng; pits: Rng; fleet: (i: number) => Rng; hand: Rng }   // init scratch only, never state
interface StartPreview { companyCashCents: Cents; personalCashCents: Cents; inheritedFleetResaleCents: Cents;
  appraisalCents: Cents; debtCents: Cents; investorTerms: InvestorTermsView[]; companyNwCents: Cents; ownerNwCents: Cents }
interface EndReport { /* §1 1.14 fields: outcome (RunOutcome), dates, seed, score, weekly series refs, claims table,
                         reveal (geology only in P1), timeline, lessons (LessonRef[]) */ }
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `bookDeskTask(draft, task: { kind; ownerSection; ref; days }, ownerTime: 'queue' \| 'now'): { bookedDays: number; queuedDays: number; forcedDays: number }` (s01#1 partial booking) | stub → `{ 0, days, 0 }`, no change | §3 site visit, §4 records review and pan survey |
| `ownerDeskDays(state): { capacity; used; queued; forcedThisWeek }` | stub → `{ 5, 0, 0, 0 }` | §8 owner availability, §13, bots |
| `canResolveDeskTask(state, task): boolean` (dispatches to §3 `canResolveSiteVisit`; others true) | stub → `true` | step 7 |
| `ownerWeek` (part 7.1) | stub | framework |
| `recordReputation(draft, kind: ReputationKind, ref: Id \| null): void` | **W0 real**: append `{ turn, kind, delta: game.reputation.delta[kind].delta, ref }` to `pending` | §5, §8, §11, §1 |
| `reputationWeek` (part 16.1) | stub | framework |
| `investorClaims(state, companyNwCents): { agreementId; claimCents }[]` (1.8.1 waterfall) | stub → `[]` | §11 netWorth |
| `ownerShare(state, companyNwCents): Cents` | stub → `companyNwCents` | §11 netWorth |
| `deliveredValueCents(state, agreementId): Cents` (reads §5 `paidToDate.valueCents`) | stub → 0 | §13, §11 |
| `ownerPayCapCents(state): Cents \| null` | **real** → `null` (P4) | §11, validators |
| `investorOnMinimumMissed(draft, obligationId)` | **real** P1 no-op (P4 cure) | §6 step 13 |
| `conversionMotionActive(state): boolean` | **real** → `false` | §11 (P4) |
| `ownerItemsDue(state, calendar: WeekCalendar): OwnerItem[]` **(contract)**: `OwnerItem = { kind: 'draw' \| 'formationFee' \| 'entityAnnualFee'; amountCents; memo }` (corp salary is §8's `isOwner` payroll line; the week-52 Backed top-up is §5's obligation) | stub → `[]` | §11 14c |
| `inheritorStreams(seed): InheritorStreams` (D-1.65 keys) | **W0 real** (builds streams; draws nothing) | N4, N9 |
| `previewStart(setup, overrides?: TuningOverrides): StartPreview` (S13-4; must equal `netWorth(newGame(...), 'scoring')`, test) | stub → Bootstrapper cash from tuning, other fields 0 | §13 wizard, sim start NW cross-check |
| `startsAvailable(rulesPhase): StartType[]` | **W0** → `['bootstrapper']` | `validateSetup`, §13 |
| `endReport(state): EndReport \| null` | stub → `null` | §13 end screen |
| `inheritorGround` (N4), `startSetup` (N9) | N9 **W0 real for Bootstrapper** (moves the existing opening-capital code); other starts stub; N4 stub | framework |
| `ownerSkill` | re-export of §8 `staff/owner.ts` (S08-19) | — |
| `investorsWeekly` (part 16.2), `scenarioWeek` (16.3, P6) | real P1 no-op / registered empty | framework |

**Actions:** `owner/setAssignment`, `owner/setSalary`, `owner/draw`, `owner/inject`, `community/sponsor`, `game/retire`
(§5). **Rules fixed by rulings:** draws and salary increases fail `DISTRESS_BLOCKED` while §11's P1 counter is open or
the stub stage ≥ 3 (s01#13, S11-17); salary above the lowest investor cap fails `ABOVE_CAP_INVESTOR` (s01#16); a
sole-prop/LLC scheduled draw that cash cannot cover is skipped (info), never an arrear (s01#15, S11-8); owner-loan
injections carry no interest under P1–P3 rules (s01#14); the formation fee is billed in 14c of turn 1 (s01#2).
**Alerts:** none in P1 (§0.6 item 1). **Hidden:** none. **Selectors:** `owner` (view incl. §11's
`ownerPersonalCash`), `ownerDeskDays`, `reputation` (value + 52-week log), `investorAgreements` (visible terms),
`timeline`, `endReport`. **Explainers:** `startPreview(setup)`, `reputation()`.

### 4.3 §3 world (`systems/world/`)

**Slice delta:** `WorldSlice.foundTells: Record<string, SellerTell>` keyed `'<listingId>/<tellKind>'` (s03#6, visible);
`siteVisits` kept to the last 3 reports per claim (s03#14). Generation-time `genParams.seller` gains every
seller-evidence key (s03#13).

**Types** (verbatim §3 3.9, 3.10, 3.12): `ListingInfo`, `ListingCandidate`, `SellerClaimSummary`, `ClaimedEvidence`,
`OldReport`, `SellerTell`, `TellKind` (12 kinds), `OpenParcel`, `SiteVisitReport` (exists), `SellerProfile` (exists).
New:

```ts
interface ClaimAccess { heavyOpen: boolean; freightOpen: boolean; freightMode: 'road' | 'trail' | 'air' }
type ListingCloseOutcome = 'expired' | 'withdrawn' | 'soldOffscreen' | 'soldToPlayer' | 'leasedToPlayer' | 'soldToCompetitor';
interface FamilyRecords {                         // (contract) §3 → §4 for the Inheritor run (3.6.1); §3 may add fields
  claimIds: ClaimId[]; seasons: { year: number; bcyWashed: number; rawOzRecovered: number }[];   // optimistic ledger
  pitLogs: { blockId: BlockId; year: number; depthFt: number; recoveredOzPerYd: number }[]; preStrippedBlockIds: BlockId[] }
interface DistrictMap { /* verbatim 3.14 districtMap shape */ }
interface SiteVisitQuote { costCents: Cents; days: number; fitsThisWeek: boolean; earliestTurn: number; blockedBy: 'access' | null }
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `createInitialListings(world, rng): { world; candidates: ListingCandidate[] }` (s03#1 strata; `rng(seed,'supply','init')`; each candidate's own draws on `rng(seed,'supply',0,claimId)`) | stub → `{ world, candidates: [] }` | N3 |
| `supplyTick(draft, turn): ListingCandidate[]` (P1: queued relists, hazard rolls in claim-id order; patented parcels take the draw but never list, s03#12) | stub → `[]` | §5 part 3.1 |
| `onListingClosed(draft, claimId, outcome: ListingCloseOutcome)` (`leasedToPlayer` keeps the lessor as `holderId`, s03#11) | stub no-op | §5 |
| `returnFromLease(draft, claimId)` (s03#11) · `forfeitToOpen(draft, claimId)` · `relistClaim(draft, claimId, situation)` (P5 caller) | stubs no-op | §5 |
| `saleQualityMult(state, claimId): number` (engine-only, reads hidden) | stub → 1 | §5 |
| `genInheritedGroup(draft, r: Rng, rPits: Rng): FamilyRecords` (3.6.1; recentCat removed from the run's kind mix, s03#3) | creation stub (only the Inheritor path reaches it) | N4 |
| `revealTells(draft, listingId, channel: 'recordsReview' \| 'geologistReview' \| 'siteVisit', skillMult): SellerTell[]` (writes `foundTells`; `seller-tells (listingId, channel)`) | stub → `[]` | §3 site visit, §4 records review |
| `claimAccess(state, claimId): ClaimAccess` (current week; applies claim-scoped `geology.access.closed`, s01#8) | stub → `{ true, true, 'road' }` | §4, §7, §9, §10 |
| `waterAvailableGpm(state, claimId): number` (current week; sff, and `ops.waterAvailableMult` on springs and wells) | **W0** → existing `waterAvailableFromFlow(claim.water, 1, 1)` | §4, §7 |
| `claimWater(state, claimId): ClaimWaterView` (visible fields only) · `lowFlowGpmOf(state, claimId)` · `listedFlowGpm(state, claimId)` | **W0 real** wrappers of `world/water.ts` | §6 (P2), §7, §13 |
| `accessFactors(state, claimId, ex): Calc<AccessFactors>` (state form of the existing world function) | **W0 real** wrapper | §4, §7, §9 |
| `districtMap(state, districtId): DistrictMap` | stub → empty map of the district's size | §13 |
| `openParcel(state, claimId): OpenParcel` | stub (P2 consumer) | §5 (P2) |
| `siteVisitError(state, claimId, ownerTime): ActionError \| null` · `bookSiteVisit(draft, ctx: HandlerContext, claimId, ownerTime): void` (pays at action time through §11 `pay`, books §1 desk days; one pending visit per claim, `VISIT_ALREADY_BOOKED`, s03#8) | stub → `null` / no-op | `world/siteVisit`, §4 `prospect/panSurvey` |
| `canResolveSiteVisit(state, task): boolean` (= `claimAccess(…).freightOpen`) | stub → `true` | §1 step 7 |
| `siteVisitQuote(state, claimId, ownerTime?): SiteVisitQuote` (S13-9) | stub → zeros | §13 |
| `resolveSiteVisits` (7.2), `wrapUp` (16.5), `initialCandidates` (N3) | stubs | framework |
| `buildReferenceClaim(draft, spec, districtId): ClaimId` | creation stub | `newFixtureGame` |

**Actions:** `world/siteVisit`, `world/setWatch` (§5). **Alerts:** `listing.new`, `listing.priceChanged`,
`siteVisit.report` (info, edge; listing alerts for watched districts or claims or ones adjacent to player ground, read
from `ctx.week.land.listingEvents`). **Hooks:** publishes `geology.supply.listingHazardMult`,
`geology.access.closed`; reads `ops.waterAvailableMult` (springs, wells). **RNG:** `world`, `seller (claimId, holderId)`
with the fixed layout of s03#4, `seller-tells (listingId, channel)`, `supply (turn [, claimId | districtId] | 'init')`,
`site (turn, claimId)` with s03#7's draw order. **Hidden:** existing (claim truth, holders' honesty and evidence,
water.hidden); scrambler `s03.ts` exists (`scrambleWorldTruth`). **Selectors:** `watchList`, `districtMap`,
`claimAccess`, `claimWater`, `listedFlowGpm`, `siteVisitReports(claimId)`, `foundTells(listingId)`, `siteVisitQuote`.
**Explainers:** `accessFactors(claimId)`, `waterAvailable(claimId)`, `siteVisitQuote(claimId)`.

### 4.4 §4 knowledge (`systems/knowledge/`)

**Slice** (P0 fields + §4 4.1 + rulings):

```ts
interface KnowledgeSlice {
  samples; sampleIds; drawIndex; records; recordIds; priorStatus;                  // exist (production rows join samples)
  programs: Record<ProgramId, ProspectProgram>; programIds: ProgramId[];
  reports: Record<ReportId, ProspectReport>; reportIds: ReportId[];
  engagements: Record<EngagementId, Engagement>; engagementIds: EngagementId[];     // s04#5: records reviews and consultants
  contractors: Record<ContractorId, ProspectContractor>; contractorIds: ContractorId[];   // filled at N8b from data/prospecting/contractors.ts
  sellerChecks: Record<string /* ClaimListingId | ClaimId (family) */, SellerCheck>;
  planning: Record<ClaimId, PlanningAssumptions>; planningDefault: PlanningAssumptions | null;   // s04#6
  decisionContext: Record<ClaimId, DecisionContext>;                                 // overrides only; empty in P1
  sampleConc: Record<ClaimId, { recoveredMgLogged: number; mgSinceAssay: number;
    hidden: { metalOz: number; fineOz: number; lines: { capture: number; processing: number; variance: number } } }>;  // s04#19
  assays: Record<ClaimId, FinenessAssay[]>; assayCount: Record<ClaimId, number>;   // s04#4 (OWNER Q1 key shape)
  history: Record<ClaimId, EstimateSnapshot[]>;                                      // ≤ 52 per claim
  lastClass: Record<ClaimId, ConfidenceClass>;
  anchors: Record<ClaimId, { turn: number; minedBlockIds: BlockId[]; strippedBlockIds: BlockId[] }>;   // s04#1 incremental path
  familyRecords: Record<ClaimId, FamilyRecords>;                                     // Inheritor (shown, never admitted)
}
```

**Types** (verbatim §4 4.12, 4.10.4, 4.11, 4.14): `ProspectProgram`, `SampleTarget`, `GeologistRef`,
`ProspectContractor`, `ProspectReport`, `EstimateSnapshot`, `Recommendation`, `SellerCheck`, `SellerCheckStatus`,
`DecisionContext`, `EstimateVerdict`. New or changed:

```ts
interface Engagement { id: EngagementId; kind: 'recordsReview' | 'consultant'; reviewer: ReviewerRef;   // s04#5
  target: { claimId?: ClaimId; creekId?: CreekId; listingId?: ClaimListingId };
  status: 'awaitingDesk' | 'booked' | 'active' | 'delivered' | 'cancelled'; startTurn: number | null; dueTurn: number | null;
  daysBilled: number; reportId?: ReportId; tier?: 'budget' | 'standard' | 'premier'; scope?: 'supervision' }
interface ProgramResourceRequest { programId: ProgramId; machineId?: MachineId; employeeId?: EmployeeId | 'owner'; hours: number }
interface ProgramMachineUse { programId: ProgramId; claimId: ClaimId; machineId: MachineId; hours: MachineWeekHours }   // 4.18
interface ProgramCrewUse { employeeId: EmployeeId | 'owner'; programId: ProgramId; claimId: ClaimId; role: Role;
  byDay: number[]; supervisingGeologist: EmployeeId | 'owner' | EngagementId | null }                               // 4.18
interface ProgramCostLine { programId: ProgramId; claimId: ClaimId; account: AccountCode; cents: Cents; memo: string;
  vendor: 'contractor' | 'lab' | 'consultant' | 'supplies' | 'rental' | 'none' }    // billed by §11 in 14c, cost center prospecting
interface ProgramDisturbance { claimId: ClaimId; acres: number; type: 'explorationPit'; backfilled: boolean }
interface SampleWeighing { claimId: ClaimId; rawMilliOz: MilliOz; trueAlloyFineness: number; trueDirtFrac: number }  // hidden truth fields
interface ProgramPreview { costCents: Cents; weeks: number; units: number; disturbedAcres: number; warnings: ActionWarning[] }
// ClaimEstimate (exists) gains: turn; evidenceHash; verdict: EstimateVerdict. BlockEstimate gains (s07#15):
//   gravelPayFtP50, bedrockFtP50, bouldersVis, clayVis, pFrozen (visible ground values on 4.7's tercile mapping).
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `knownEstimate(state, claimId): ClaimEstimate \| null` (memoized by evidence hash; warm from step 16) | stub → `null` | §5, §7, §11, §13, bots |
| `blockEstimates(state, claimId): BlockEstimate[]` | stub → `[]` | §5, §7, §13 |
| `percentileOz(state, claimId, q, which: 'contained' \| 'minable'): number` | stub → 0 | §13, §5 |
| `decisionContext(state, claimId): DecisionContext \| null` · `estimateVerdict(state, claimId): EstimateVerdict` | stubs → `null` / `{ verdictKey: 'verdict.none', params: {}, biggestUnknownKey: null }` | §13 |
| `sellerCredibility(state, listingId): { status: SellerCheckStatus; flags: SellerFlag[]; pHonest?: number }` | stub → `{ 'unchecked', [] }` | §5 view, §13 |
| `programResourceRequests(state, claimId): ProgramResourceRequest[]` (this week's own-delivery requests, for §7's step 9(f)) | stub → `[]` | §7 |
| `runClaimPrograms(draft, ctx, claimId)` (step 9 j; writes `ctx.week.knowledge`) · `runOrphanPrograms(draft, ctx)` | stubs | framework 9.1 |
| `recordProduction(draft, cleanup: CleanupResult)` (incremental path; attributes `rawOzWeighed − pileRawOzEst`, s04#3; estimate as of the start of step 12, s04#20) | stub | framework 12.1 |
| `weighSampleConcentrates(draft, ctx): SampleWeighing[]` (finished/cancelled programs, season-ended districts) · `afterSampleLot(draft, ctx, claimId, lotId: LotId \| null)` (assay check ≥ 300 mg, s04#4) | stubs → `[]` / no-op | framework 12.2 |
| `addFamilyRecords(draft, records: FamilyRecords)` | stub | N4 |
| `assessmentWorkSpend(state, claimId, year): Cents` | stub → 0 (P2 consumer) | §6 |
| `reviewerSkillMult(state, reviewer: ReviewerRef): number` (for §3 `revealTells`) | stub → 1 | §3 |
| `previewProgram(state, draft: ProgramDraft): ProgramPreview` (S13-9) | stub → zeros | §13, bots |
| `onMachineRemoved(draft, machineId)` (S09-15) · `onTenureEnded(draft, claimId)` (cancel programs on the claim) | stubs | §9, §5 |
| `pendingDeals` (6.5), `marketsRefresh` (3.2), `wrapUp` (16.6) | stubs | framework |

The existing `estimateFromEvidence(priors, evidence, planning, ctx)` is unchanged. **Actions:** `prospect/panSurvey`,
`createProgram`, `modifyProgram`, `pauseProgram`, `resumeProgram`, `cancelProgram`, `bookContractor`, `recordsReview`,
`engageConsultant`, `setPlanning` (§5). Contractor delivery only for `excavatorPit` in P1 (s04#9); lead time
`max(1, ceil(base × geology.contractorLeadMult × effective('prospect.contractorLeadTimeMult')))` (s04#8); pits refused on
blocks with `areaMined > 0` (`BLOCK_BEING_MINED`, s07#26); open ground allows records reviews only (s04#7).
**Alerts:** `prospect.resultsReady`, `prospect.classChanged`, `prospect.programPaused`, `prospect.sellerContradicted`
(records tells may set `contradicted` from P1, s04#21). **Hooks:** `prospect.rateMult`, `prospect.pitStopProbMult`,
`prospect.recordsFindMult`, `prospect.consultantLeadMult`, `prospect.contractorCostMult`,
`prospect.contractorLeadTimeMult` (P1); `prospect.labTurnaroundWeeksAdd` (P3). **RNG:** `sample`, `records`,
`contractors`, `prospect` (+ **OWNER Q1**: `(claimId, 'assay', n)` with `n = assayCount[claimId]`). **Hidden:**
`sampleConc[*].hidden`; scrambler `s04.ts`. **Selectors:** `knownEstimate`, `blockEstimates`, `percentileOz`,
`estimateVerdict`, `decisionContext`, `sellerCredibility`, `programs(claimId?)`, `program`, `reports(claimId?)`,
`report`, `sampleLog(claimId)`, `estimateHistory(claimId)`, `contractors(districtId)`, `engagements`,
`planningAssumptions(claimId?)`, `trackedClaimIds`, `familyRecords(claimId)`. **Explainers:** `claimEstimate(claimId)`
(lazy from the cached layers, s04#23), `programPreview(draft)`.

### 4.5 §5 land (`systems/land/`; `systems/negotiation/` stays empty)

**Slice:** verbatim §5 5.2 `LandSlice` (every collection present, P2+ ones empty: `negotiations`, `auctions`,
`diligence`, `stakings`, `jvs`, `pendingTrueUps`). P1 deltas:
- `Listing.askNoise` moves into `Listing.hidden`, and `Listing.hidden` gains `royaltyNoiseZ: number` (s05#7, #9);
  `SellerDisposition` otherwise verbatim (`allowsSiteSampling` true in P1).
- `Tenure.endDetail?: 'default' | 'surrender' | 'expiry'` beside `endedReason` (s05#24c).
- Types verbatim: `Tenure`, `TenureEndReason`, `LeaseState`, `Listing`, `SellerDisposition`, `SaleTerms`, `LeaseTerms`,
  `InspectionTerm`, `Closing`, `ProductionInterest` (5.12, D-5.27), `CashAccrual`, `SellerRef`, `SellerKey`, `Channel`,
  `EvidenceClass`; P2+ types (`StakingJob`, `Auction`, `DiligenceJob`, `JvAgreement`, `TitleDefect`) declared now.

```ts
interface SamplingAccess { tier: 'none' | 'casual' | 'operator'; untilTurn: number | null;     // 5.5
  reason: 'owned' | 'leased' | 'staked' | 'jv' | 'sellerPermission' | 'inspectionPeriod' | 'none';
  maxAuthority?: 'casual' | 'notice'; sellerNoticePermitId?: PermitId }
interface Settlement {                                    // settleProductionInterests result (milli-oz, §0.6 item 7)
  deliveries: { interestId: ProductionInterestId; holder: ProductionInterest['holder']; rawMilliOz: MilliOz; valueCents: Cents }[];
  cashAccruals: CashAccrual[]; playerRawMilliOz: MilliOz; calc?: CalcNode }
interface NewTenure { claimId: ClaimId; kind: 'ownedUnpatented' | 'leased'; origin: Tenure['origin']; costBasisCents: Cents;
  lease?: { terms: LeaseTerms; lessor: SellerRef } }
type NewProductionInterest = Omit<ProductionInterest, 'id' | 'recoupCredits' | 'excludedClaimIds' | 'paidToDate' | 'status'>;
interface ClaimValuation { p10Cents: Cents; p50Cents: Cents; p90Cents: Cents;
  breakdown: { burden: number; amrCents: Cents; holdingCents: Cents; opPvCents: Cents; npvCents: Cents } }
interface ListingEvent { listingId: ClaimListingId; claimId: ClaimId; kind: 'new' | 'priceChanged' | 'closed' }   // ctx.week.land
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `createListings(draft, candidates: ListingCandidate[], opts: { initial: boolean })` (`land-list (listingId)` with the s05#8 layout; stationary age for initial listings, s05#15) | stub no-op | N5, part 3.1 |
| `marketsRefresh` (3.1), `pendingDeals` (6.1), `wrapUp` (16.7) | stubs | framework |
| `samplingAccess(state, claimId): SamplingAccess` | stub → `{ tier: 'none', untilTurn: null, reason: 'none' }` | §4 |
| `presentedAuthority(info: ListingInfo): 'none' \| 'notice' \| 'plan'` | **real** (pure map; `'none'` in P1) | §13 |
| `createTenure(draft, spec: NewTenure): TenureId` | creation stub | §1 N9, fixtures, `land/acceptAsk` |
| `addProductionInterest(draft, spec: NewProductionInterest): ProductionInterestId` (`PI_BURDEN_TOO_HIGH`) · `endProductionInterest(draft, piId, reason)` | creation stub / no-op | §1 N9, fixtures, §5 |
| `settleProductionInterests(draft, claimId, { rawMilliOz, turn, source: 'cleanup' \| 'sample' }): Settlement` (in kind off the top; credit consumption and cash accruals posted by §5; +0.5 reputation per in-kind lease royalty paid in full) | stub → `{ deliveries: [], cashAccruals: [], playerRawMilliOz: rawMilliOz }` | framework 12.1, 12.2 |
| `minimumShortfallCents(state, piId, year): Cents` (s01#25: minimum − Δ`paidToDate.valueCents` over year Y; 0 once stepped) | stub → 0 | §11 14c week 52 |
| `valueClaimForPlayer(state, claimId, terms?: SaleTerms \| LeaseTerms): ClaimValuation` (cost = §4 `costUsdPerPayBcyM` + `land.valCapitalChargePerBcy` × cpi, s05#26) | stub → zeros | §13, bots |
| `breakevenGradeOzPerBcy(state, claimId, blockId) · breakevenSpot(state, claimId) · breakevenOz(state, claimId, priceCents?)`: `number \| null`; `valueSensitivity(state, claimId)` | stubs → `null` | §13, §4 (P2 EVSI) |
| `buyerClaimView(state, tenureId, disclosure: 'none' \| 'summary' \| 'full')` (s05#12: oz view = §4 `minableOzP50` only) | stub → zeros | §5 quick sale, §12 (P5) |
| `quickSaleQuote(state, tenureId): Cents` (= `land.quickSaleFrac` × V_buyer(summary)) | stub → 0 | §11 counter moves, §13, observer (O-15) |
| `previewOffer(state, listingId, structure: 'sale' \| 'lease'): OfferPreview` (+ `forecastAfterClose` from §11, S13-9) · `valuationView(state, claimId)` | stubs | §13 |
| `tenureOf(state, claimId): Tenure \| null` · `heldClaimIds(state)` · `heldDistrictIds(state)` · `controlledClaimCount(state)` | **real** (lookups over active tenures) | everyone |
| `holdingCostAnnual(state, tenureId): Cents` (owned 0 under rules < 2; leases AMR, s05#11) | stub → 0 | §13, §5 valuation |
| `onObligationMissed(draft, obl: Obligation)` (`land.onObligationMissed`) · `onObligationSatisfied(draft, obl)` (pushes the AMR recoup credit, s05#2) | stubs | §6 step 13, §6 `satisfyObligation` |
| `fixtureTenure(draft, claimId, spec): TenureId` | creation stub | `newFixtureGame` |

Tenure end (sale, surrender, expiry, termination, relinquish, option conversion) calls, in order: §5's own handler,
then `ops.onTenureEnded(draft, claimId, reason)`, `knowledge.onTenureEnded(draft, claimId)`, then §3
`onListingClosed` / `returnFromLease` / `forfeitToOpen` as the case requires (s05#13, s03#11). **Actions:**
`land/acceptAsk`, `buyDownRoyalty`, `exerciseOption`, `setLeaseRenewal`, `surrenderLease`, `quickSell`, `relinquish`
(§5); decision kind `land.leaseRenewal` (non-blocking, default `renew`). Voluntary ends need a demobilized site
(`SITE_ACTIVE`, s05#13); lease signing pays the first AMR and any option fee at once (s05#4); options exercise
instantly (s05#10); P1 generates in-kind leases only (s05#23). **Alerts:** `lease.anniversarySoon` (info, level,
≤ 4 wk), new kinds `lease.defaultNotice` (critical, edge), `lease.terminated` (warning, edge), `lease.ended` (info,
edge), `land.quickSaleClosed` (info, edge), `land.interestChanged` (info, edge) (s05#20). **Hooks:**
`land.askPriceMult`, `land.rivalSaleMult`, `land.sellerMotivationAdd` (P1; m_t formula s05#22),
`land.distressedShareMult`, `land.titleDefectRateMult` (P5), `land.stakeConflictMult` (P2). **RNG:** `land-list
(listingId)`, `land-market (turn, listingId)` (registry doc fix, s05#27). **Hidden:** `Listing.hidden` (incl. `askNoise`,
`royaltyNoiseZ`), `Tenure.hiddenDefects`; scrambler `s05.ts`. **Selectors:** `listings(filter?)` (visible view, no
`hidden`), `listing(id)`, `tenures`, `tenure(id)`, `tenureOf`, `productionInterests(claimId?)`, `heldClaimIds`,
`heldDistrictIds`, `controlledClaimCount`, `samplingAccess`, `quickSaleQuote`, `valueClaimForPlayer`, `previewOffer`,
`valuationView`, `holdingCostAnnual`. **Explainers:** `listingAsk(listingId)` (pricing factor hidden with `knownAlt`,
s05#7), `claimValue(claimId)`, `cleanupSplit(claimId, turn, lineId)`, `leaseObligations(tenureId)`,
`valuationView(claimId)`.

### 4.6 §6 permits: the P1 obligation store (`systems/permits/`; s05#1)

**Slice:** `PermitSlice { obligations: Record<ObligationId, Obligation>; obligationIds: ObligationId[] }` (§2 policy
exception: the P2 collections join with P2's migration).

**Types:** verbatim §6 6.9 `Obligation`, `ObligationCategory`; P1 `ObligationKind` = `'leaseAdvanceRoyalty' |
'leaseShortfallRoyalty' | 'workInLieu' | 'leaseCure' | 'minimumRoyaltyShortfall' | 'loanPayment'` (P2 adds §6's own
kinds). `ObligationSpec = Omit<Obligation, 'id' | 'status' | 'satisfiedTurn' | 'satisfiedVia' | 'ledgerTxnIds'>`.
`ObligationFilter { owner?; category?; kinds?; claimId?; statuses? }`.

| Function | W0 body | Callers |
|---|---|---|
| `createObligation(draft, spec): ObligationId` | **W0 real** (store, `obl` id, status `upcoming`/`due` by turn) | §5, §11, §1 (via §5) |
| `satisfyObligation(draft, id, via, refs?)` (idempotent; then the owner's `onObligationSatisfied`: §5's or §11's) | **W0 real** (dispatch to the owners' stubs) | §11 settlement, `permits/payObligation` |
| `cancelObligation(draft, id)` (s05#2; then §11 `onObligationCancelled` cancels the open bill) | **W0 real** | §5 |
| `obligationsInRange(state, fromTurn, toTurn, filter?): Obligation[]` | **W0 real** | §11 forecast, §13 calendar, `upcomingDeadlines` |
| `settlementClass(obl): 'statutory' \| 'billable'` | **W0 real** (6.9 rule) | §11, §13 |
| `operatingAuthority(state, claimId)` → `'plan'` for held claims else `'none'`; `activityAllowed(state, claimId, activity, params?)` → `{ ok: true }`; `conditionLimits` → `{}`; `complianceMode` → `'strict'`; `bulkSampleRemainingBcy` → 0; `registerTenureObligations(draft, tenure)` → no-op | **W0 real** (the P1 forms of 6.18) | §4, §7, §5 |
| `obligationsStep` (13.1: sub-steps f and j) | stub | framework |

**Actions:** `permits/payObligation`, `permits/payObligations`, `permits/setAutoPay` (§5). An obligation that already
has a §11 bill is paid as that bill (S11-18). **Alerts:** `obligation.dueSoon` (level, ladder from §13's
`obligationAlertSeverity`; capped at info in P1, S12-9), `obligation.missed` (§6, §5 and §1 items only; §11 emits its
own kinds). **Hooks published** (consumerPhase 2, 6 for Yukon): the `permits.*` rows of §7. **Selectors:**
`obligations(filter)`, `obligation(id)`, `upcomingObligations(weeks)`.

### 4.7 §7 ops (`systems/ops/`)

**Slice:** `OpsSlice { claims: Record<ClaimId, ClaimOps>; claimIds: ClaimId[]; lastWeek: Record<ClaimId, WeekOpsResult> }`
(verbatim §7 7.1; `lastWeek` holds the core result only, rewritten for every claim in `claimIds` every week, s07#22).
`ClaimOps`, `LineOps`, `BlockOps`, `Pile`, `GoldParcel`, `TailingsDeposit`, `DisturbanceLedger`, `SeasonTotals`,
`Pond` (empty in P1), `Well`, `SiteWorkOrder`, `SiteStatus` verbatim §7 7.1, 7.3, 7.13, 7.14, plus (s07#12, s05#13,
s01#20):

```ts
// ClaimOps +
  orders: { cleanupLines: LineId[] };                       // ops/cleanupNow, consumed by next step 9(b)
  auditReports: TailingsAuditReport[];                      // ring of 4 (visible results)
  payDugLast4: number[];                                    // coverageWeeks input
  seasons: ClaimSeasonSummary[];                            // last 10: { year; washedBcy; weighedRawOz; plantIdleHoursByCause }
  status: 'active' | 'left'; leftTurn: number | null;      // kept read-only after the tenure ends (conservation)
  lostOnTenureEndRawOz: number;                             // HIDDEN terminal conservation term
// LineOps +
  lostSinceAudit: { sinceTurn: number; bySize: Record<SizeClass, number> };   // HIDDEN
  directFeedBcySinceShift: number;
// Well: { id: WellId; status: 'drilling' | 'ready'; readyTurn: number; yieldGpm: number | null /* null until ready */;
//         depthFt: number; drilledTurn: number }
// SiteWorkOrder (kind 'plantMove' | 'clear' in P1) + plantMoveHoursLeft?: number
```

**Types** verbatim §7 7.2, 7.16: `MinePlan`, `PlantLine`, `LineId` (core/ids), `OpsRole`, `CutSource`,
`WeekOpsResult`, `LineWeekResult`, `MachineWeekHours` (+ `runHours: number` on the plant's entry, s07#1),
`GroundCtx`, `CleanupResult` (+ `lotId?: LotId`; `interestsTaken[].rawMilliOz: MilliOz`), `OpsCostLine` (7.11),
`Stage`, `IdleItem`, `IdleCause`, `CircuitKey`, `FeedMode`, `WhatIfHint { label; deltaWashedBcy; deltaVisibleRawOz;
weeklyCostUsd }`. These replace the placeholders in `turn/types.ts`. New:

```ts
interface OpsProjection {            // projectOpsVisible: visible model only (estimates, shown skills)
  claimId: ClaimId; washedBcyWk: number; estContainedRawOz: number; estRecoveredRawOz: number;
  estRecoveryBySize: Record<SizeClass, number>; weeklyCostCents: Cents;
  lines: { lineId: LineId; washedBcyWk: number; plantIdlePct: number; bottleneck: Stage }[];
  strip: { needBcyWk: number; doneBcyWk: number; coverageWeeks: number };
  water: { needGpm: number; availableGpm: number }; warnings: ActionWarning[] }   // the plan warnings (s07#3, S13-3)
interface ProductionForecast {        // 7.16, D-7.40 (P50 from P1)
  byWeek: { turn: number; p10FineOz: number; p50FineOz: number; p90FineOz: number }[];
  cleanups: { claimId: ClaimId; lineId: LineId; turn: number; p50RawOzWeighed: number; p50PlayerRawOz: number; estFineness: number }[];
  washedBcyByClaim: Record<ClaimId, number> }      // §5 valuation's annual bcy (s05#26)
interface CleanupDue { claimId: ClaimId; lineId: LineId; reason: 'interval' | 'maxBoxWeeks' | 'ordered' | 'standby' | 'winterizing' | 'plantMove' | 'seasonEnd' }
interface WeighedCleanup { claimId: ClaimId; lineId: LineId; weighedRawMilliOz: MilliOz;
  trueAlloyFineness: number; trueDirtFrac: number /* HIDDEN, handed to §10 addLot */ }
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `operateClaimFlow(draft, ctx, claimId)` (9 a–i: gates, cleanup decision, thaw every week for cleared/stripping/payExposed blocks (s07#8), `ops-grade` draws cached in `ctx.week.ops.gradeDraws`, program-first reservations from §4 `programResourceRequests`, hour-block flow calling `events.onBlockStripped` / `onBlockMined`, attribution, disturbance) | stub no-op | framework 9.1 |
| `closeClaimWeek(draft, ctx, claimId)` (9 k–l: cost lines incl. program fuel from `ctx.week.knowledge.programMachineUse`, `WeekOpsResult` into `ctx.week.ops.results`, `ops.lastWeek`, report, accumulators) | stub no-op | framework 9.1 |
| `cleanupsDue(state, ctx): CleanupDue[]` (decided in 9(b), claims asc, lines asc) | stub → `[]` | framework 12.1 |
| `weighCleanup(draft, ctx, due: CleanupDue): WeighedCleanup` (gold room, weigh `floorMilliOz(metal / (1 − dirt))`; skim skipped in P1) | stub (unreachable while `cleanupsDue` is empty) | framework 12.1 |
| `finishCleanup(draft, ctx, w: WeighedCleanup, s: Settlement, lotId: LotId \| null): CleanupResult` (clear box, keep remainder, reset `sinceCleanup`, record into report) | stub | framework 12.1 |
| `projectOpsVisible(state, claimId, planOverride?: MinePlan): OpsProjection \| null` | stub → `null` | bots, §4, §5, §10, §11, §13 |
| `opsHints(state, claimId): WhatIfHint[]` (s07#2; step 9 copies it into the report only with explain) | stub → `[]` | bots, §13 |
| `recoveryBySize(state, claimId, plantOverride?, lineId: LineId = 'L1'): Record<SizeClass, number>` | stub → all 0 | §4, §5 |
| `productionForecast(state, fromTurn, toTurn, claimIds?): ProductionForecast` | stub → empty | §11, §5, §13, bots |
| `defaultMinePlan(state, claimId): MinePlan \| null` (s07#5 roles and cut rules; `CUT_EMPTY` when nothing minable) | stub → `null` | §13 editor, bots |
| `maxPlantLines(state, claimId): number` · `planLineOf(plan, machineId): LineId \| null` | **real** (1 under rules < 3; pure) | §13, bots |
| `groundTaskMult(classId, task, ground): number` · `REFERENCE_GROUND: GroundCtx` | stub → 1 / placeholder constant (marked) | §9, §4 |
| `siteStatus(state, claimId): SiteStatus` | **real** (`'none'` without a `ClaimOps`) | §8, §9, §13 |
| `disturbance(state, claimId): DisturbanceLedger` · `opsWaterUse(state, claimId)` · `thawingStrippedAcres` · `campStaffed` · `boxGoldRawOz` · `theftExposure` | stubs → zeros / false | §6 (P2), §12 (P5), §13 |
| `fuelOnHandGal(state, claimId)` → 0; `pondFreeboardFrac(state, claimId)` → 1 | **real** (P1 forms) | §12 |
| `onTenureEnded(draft, claimId, reason)` (stand down; pad and box gold → `lostOnTenureEndRawOz`; `status 'left'`) | stub | §5 |
| `onMachineRemoved(draft, machineId)` (S09-15: drop from assignments and lines) | stub | §9 |
| `initInheritedSite(draft, claimId)` (site `winterized`, camp present, pre-stripped `BlockOps`, s01#18, s07#7) · `fixtureSite(draft, claimId, site, stripAheadBlocks, plan)` | stub / creation stub | §1 N9 / `newFixtureGame` |
| `siteTasks` (6.6), `wrapUp` (16.8); `reResolve` (10.2) and `freezeDamage` (10.4) registered fromPhase 3 | stubs | framework |

**Actions:** `ops/setMinePlan`, `setPlanActive`, `cleanupNow`, `movePlant`, `mobilizeSite`, `winterize`, `startup`,
`demobilizeSite`, `drillWell`, `tailingsAudit` (§5). Site lifecycle per s07#10; season-end cleanup in the winterizing
week (s07#11); `emp_owner` in `plan.crew` only as `operator` on that claim (s07#25); later-phase plan inputs per s07#27.
**Alerts:** `ops.plantIdleHigh` (dedupe ends in `lineId`), `ops.stripCoverageLow`, `ops.waterLimited`,
`ops.freezeUpNotWinterized` (info while auto-winterize applies, s07#24), `ops.cleanupOverdue`, `ops.padFull`,
`ops.cleanupDone` (info, per line). `crew.noForeman` is §8's. **Hooks** (all published by §7, consumerPhase 1 unless
noted): `ops.hoursMult`, `ops.productivityMult`, `ops.haulCycleMult`, `ops.plantCapacityMult`, `ops.thawMult`,
`ops.recoveryLossExpMult`, `ops.waterTruckCostMult`, `ops.blockLocked`, `ops.fuelAdderMult`, `ops.campCapacityMult`,
`ops.campCostMult`, `ops.waterAvailableMult`; `ops.fuelSupplyFrac`, `ops.freezeDamageProbMult` (3);
`ops.highGradeProbMult` (5). **RNG:** `ops-grade (turn, claimId, blockId)`, `ops-audit (claimId, lineId, auditSeq)`.
**Hidden:** every gold field (pad, box, `BlockOps` oz, tailings, stolen, skimmed, `lostSinceAudit`,
`lostOnTenureEndRawOz`), the hidden `WeekOpsResult` fields in `lastWeek`, `MachineWeekHours.operatorSkill`,
`CleanupResult.skimOz`; scrambler `s07.ts`. **Selectors:** `claimOps(claimId)` (visible view), `minePlan(claimId)`,
`siteStatus`, `lastWeekOps(claimId)` (visible view of the result), `projectOpsVisible`, `opsHints`,
`productionForecast`, `defaultMinePlan`, `maxPlantLines`, `wells(claimId)`, `disturbance`, `auditReports(claimId)`.
**Explainers:** `opsProjection(claimId)`, `recoveryBySize(claimId, lineId)`, `siteMobilization(claimId)`; week numbers
explain from `WeekReport.calc` under `ops/<metric>/<claimId>/<lineId>` keys.

### 4.8 §8 staff (`systems/staff/`)

**Slice:** verbatim §8 8.1 `StaffSlice` (incl. P2+ fields at neutral values: `injuries: []`, `claimSafety: {}`,
`pendingRefs: []`, `flexHourPlan: {}`, `leakage: { 0, 0 }`) plus:

```ts
  supervision: Record<ClaimId, Partial<Record<LineId, SupervisionRecord>>>;
    // SupervisionRecord { leadHandWeeks; presentWeeks; lastSupervisorQuitTurn: number | null;
    //                     kind: SupervisorKind; empId: EmployeeId | null; qF: number; reason: StandDownReason | null }  (S08-9)
  separations: Separation[];      // + reentry?: { turn: number; snapshot: CandidateSnapshot } (S08-5; snapshot HIDDEN)
  recruiterOrders: RecruiterOrder[];   // 8.1 + deliveredTurn: number | null; candIds: CandidateId[]; firstFeeCredited: boolean
  staffingCharges: StaffingCharge[];   // { turn; kind: 'travel' | 'recruiterFee' | 'depositForfeit'; cents; costCenter; claimId?; memo; refId }
  camps: Record<ClaimId, CampWeekRecord>;  // last week's { onSite; cooks; cookShort; overCapacity; tier; commuting } (8.7 inputs)
type SupervisorKind = 'hired' | 'owner' | 'leadHand' | 'smallCrew' | 'none';
type StandDownReason = 'reassigned' | 'leadHandExhausted' | 'smallCrewExceeded';
```

`Employee` verbatim §8 8.3 plus (S08-9): `pendingAssignment: Assignment | null`, `pendingPay: { bonusCents; severanceCents }`,
`lastWeek: { hoursByDay: number[]; availableFraction: number; claimId: ClaimId | null; lineId: LineId | null; onSite: boolean }`,
`weeksWorkedThisYear`, `moralePrev`, `leaving: { turn: number; walkOff: boolean } | null`. `Candidate` verbatim + 
`recruiterOrderId?` (S08-25). `Assignment`, `PayStructure`, `Role`, `OpClass`, `Truth`, `Resume`, `ResumeNoise`,
`LaborMarketState`, `OwnerWork`, `UnpaidWages`, `SafetyRecord`, `InjuryRecord`, `Separation`, `CandidateSnapshot`
verbatim §8 8.1–8.5.

```ts
interface ForemanInfo { kind: SupervisorKind; empId: EmployeeId | null; skill: number; shownSkill: Range; safety: number;
                        leadHandWeeks: number; lineIds: LineId[] }
interface CandidateSpec { role: Role; districtId: DistrictId; origin: Candidate['origin']; truth?: Partial<Truth>;
  askMult?: number; tags?: Candidate['tags']; formerEmployeeId?: EmployeeId; leavesPoolTurnMin?: number }
interface EmployeeWeekHours { byDay: number[]; paidHours: number; straightEqHours: number;
  byCostCenter: { costCenter: CostCenter; claimId?: ClaimId; programId?: ProgramId; hours: number }[] }
type ShopKey = { mode: 'site'; claimId: ClaimId } | { mode: 'pool'; districtId: DistrictId };
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| Skill curves (8.11): `skillProductivityMult`, `skillWearMult`, `skillRecoveryMult`, `inspectionAccuracy`, `repairQuality`, `repairHoursMult`, `reworkHazardMult`, `permitApplicationQuality`, `drillerNoiseMult`, `controllerQuality` (pure `(skill: number) => number`) | stubs → 1 | §7, §9, §4 |
| `ownerSkill(state, role: 'ops' \| 'foreman' \| 'mechanic' \| 'geologist' \| 'landSpecialist'): number` (`staff/owner.ts`, S08-19; geologist reads `geology.ownerGeologistSkill`) | **W0 real** | §1, §4, §7, §9 |
| `operatorProfile(state, empId \| 'owner', classId: ClassId): { effSkill: number; shownSkill: Range } \| null` | stub → `{ 50, { lo: 50, hi: 50 } }` | §9, §7 |
| `canFill(state, empId \| 'owner', role: OpsRole, machineClass?: ClassId): { ok: boolean; effSkill: number; reason?: string }` | stub → `{ ok: true, effSkill: 50 }` | §7 pairing |
| `availableFraction(state, empId \| 'owner', turn): number` | stub → 1 | §7, §4 |
| `foremanFor(state, claimId, lineId: LineId = 'L1'): ForemanInfo` (reads `supervision`, written in step 7) | stub → kind `'none'` | §7, §13 |
| `prospectiveSupervisorKind(state, claimId, plan: { shiftsPerDay; activeLines: LineId[]; crewIds: EmployeeId[] }): SupervisorKind` (s07#4: applies pending assignments and the small-crew test) | stub → `'none'` | §7 and §1 validators |
| `supervisionIncidentMult(state, claimId)` → 1; `fieldCrewCount(state, claimId)` → 0 | stubs | §12 (P2), §7 |
| `shopCapacity(state, shop: ShopKey): { mechHours; weldHours; mechSkill; weldSkill }` | stub → zeros | §9 |
| `marketWage(state, role, districtId): Cents` · `marketWageBase(...)` (hourly cents, or annual for salaried) | stubs → 0 | §13, bots |
| `payrollForWeek(state): PayrollLine[]` (reads `Employee.lastWeek`, written in part 10.5 of the same week; corp owner `isOwner` line, S08-18; standby on the guarantee, S08-11) | stub → `[]` | §11 14b |
| `recordPayrollOutcome(draft, empId, paidCents, shortCents)` | stub | §11 14e |
| `drainStaffingCharges(draft): StaffingCharge[]` | stub → `[]` | §11 14c |
| `payrollProjection(state, weeks: number): { turn; grossCents; burdenCents }[]` · `crewRequirement(state, claimId, plan: MinePlan): Partial<Record<Role, number>>` (S08-22) | stubs → `[]` / `{}` | §11 forecast, bots |
| `addCandidate(draft, spec: CandidateSpec, stream?: Rng): CandidateId` (S08-7 caller-supplied stream) · `fixtureEmployee(draft, spec, claimId): EmployeeId` | creation stubs | §1 N9, fixtures |
| `initPools` (N8), `yearStart` (1.3), `laborMarket` (3.3), `availability` (7.3), `hoursAndFatigue` (10.5), `wrapUp` (16.9) | stubs | framework |

**Actions:** `staff/hire`, `cancelHire`, `useRecruiter`, `assign`, `setPay`, `giveBonus`, `fire`, `layoff`, `recall`
(§5); decisions `staff.layoffDecision` (northern freeze-up, options `layoffDefault` / `keepAll`) and
`staff.recallDecision` (forecast breakup − 6, `recallAll` / `recallNone`), non-blocking with defaults (S08-14). Role ↔
assignment table in `data/staff/roles.ts` (S08-17). **Alerts:** `employee.quit`, `crew.moraleLow` (thresholds
`game.alerts.moraleWarnAvg` / `moraleWarnKey`, S12-16), `crew.noForeman` (only emitter; one per claim with the stood-down
lines and reason, S08-20), `crew.leadHand`, `staff.layoffDecision`, `staff.recallDecision` (each with `decisionId`,
S12-2). **Hooks:** `staff.wageAskMult`, `staff.poolSizeMult` (base = difficulty tuning, district), `staff.crewAvailableFrac`
(set, neutral 1, claim / company), `staff.quitHazardMult` (base tuning), `staff.moraleTargetAdd` (add 0, ±10) — P1;
`staff.injuryHazardMult` (P2). **RNG:** `staff-cand (candId)` with the S08-6 draw order, `staff-market (turn, districtId
| turn, 'ref', empId | turn, 'rcr', orderId | 'former', empId)` (doc fix only, S08-5), `staff-quit`, `staff-absence`,
`staff-rehire (turn, empId)`. **Hidden:** `truth`, `resumeNoise`, `leavesPoolTurn` (employees, candidates, re-entry
snapshots); `shown` is a degenerate range equal to truth in P1 and is rewritten when truth changes (S08-26); scrambler
`s08.ts`. **Selectors:** `roster` (incl. the owner row), `employee(id)`, `candidates(districtId?)`,
`laborMarket(districtId)`, `supervision(claimId)`, `recallList`, `recruiterOrders`, `separations`,
`quitRiskBand(empId)`, `crewRequirement`, `payrollProjection`, `foremanFor`, `fieldCrewCount`. **Explainers:**
`morale(empId)`, `quitRisk(empId)`, `ask(candId)`.

### 4.9 §9 fleet (`systems/fleet/`)

**Slice:** verbatim §9 9.1 `FleetSlice` (P3 collections empty: `auctions`, `auctionBanUntilTurn: 0`, `workOrders`,
`parts`, `partsOrders`, `contracts`, `inspections`, `callouts`, `sales`, `shopBays`; `shopPolicy` at its 9.1 defaults;
`dealers: {}`; `market` fixed `{ usedMult: { placer: 1, general: 1, light: 1 }, newMult: 1, floodIdx: 0, repoBustLots13w: [] }`),
plus `saleLog: FleetSaleEvent[]` (52 wk; S09-14). P1 deltas: `Machine.pm` optional and unset (S09-20); `Machine.grade`
always set in P1; `Machine.book: { accumDepCents: Cents; unpostedDepCents: Cents }` (S09-17); `LocationRef` gains
`{ kind: 'town'; id: DistrictId }` (S09-9); `EquipmentListing.truth` optional (unset in P1); `FactoryOrder.heldSinceTurn:
number | null` (4-week hold, `fleet.newOrderHoldWeeks`). Id types keep the code names (`FactoryOrderId`,
`TransportJobId`, `RentalContractId`, S10-16's policy).

```ts
type Grade = 'A' | 'B' | 'C' | 'D';
interface FleetSaleEvent { turn: number; machineIds: MachineId[]; proceedsCents: Cents; distress: boolean }
interface MachineAvailability { downShare: number; reason?: 'inTransit' | 'assembling' | 'down' }
interface InheritedFleetSpec { items: { modelId: ModelId; ageYears: number; hours: number; options: MachineOption[] }[] }  // data (S09-6)
// data/equipment: EquipmentModel (verbatim 9.2.1, phase incl. 3 for fixture-only rows), EquipmentPackage, Brand, ClassDef,
//   ModelId / BrandId / ClassId / SizeKey string unions derived from the catalog
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `modelOf(modelId): EquipmentModel` · `classOf(classId): ClassDef` (data lookups) | **real** (catalog may be empty until the §9 package) | everyone |
| `machineEffectiveRate(m: Machine, operator: { effSkill: number } \| null, ground: GroundCtx, ctx: { task: string; tempBand: TempBand; phase: SeasonPhase }, ex): Calc<number>` (P1: spec × grade × skill × ground × cold × `fleet.rateMult`, S09-7) | stub → 0 | §7, §4 |
| `fuelBurnGalHr(m, loadFactor, ctx: { tempBand }, ex): Calc<number>` | stub → 0 | §7, §4 |
| `campSummary(state, claimId): { capacity; tier: 'basic' \| 'standard' \| 'good' \| 'premium'; security; overCapacity; hasSafe }` (applies `ops.campCapacityMult`) | stub → `{ 0, 'basic', 0, 0, false }` | §7, §8, §10 |
| `siteSupport(state, claimId): { serviceTruck; fuelTruck; routineAvailabilityBonus; hasTable }` | stub → false/0 | §7, §10 |
| `fuelStorageGal(state, claimId)` → 0 · `avgKnownHealth(state, claimId)` → 1 · `meanTrueHealth(state, claimId)` → 1 | **real** (P1 forms) | §6, §7, §8 |
| `shopHours(state): Record<EmployeeId \| 'owner', { total: number; byClaim: Record<ClaimId, number>; yard: number }>` (P1: a site mechanic works his claim's scheduled shift-1 hours, S08-10) | stub → `{}` | §8 |
| `resaleEstimate(state, machineId, ex?): Calc<Cents>` (new units: price mult 1.0 at condRef for life under P1–P2, S09-4) | stub → 0 | §11 NW, §1 preview, bots |
| `machinesOnClaim(state, claimId): MachineId[]` | **real** (location lookup) | §7, §4, observer |
| `monthDepreciation(draft, calendar): { machineId; claimId: ClaimId \| null; cents: Cents }[]` (sums and clears `unpostedDepCents`, split by the month's hours, S11-16) | stub → `[]` | §11 14h |
| `fleetWashCapacityBcyHr(state): number` · `distressFleetSale(state, fromTurn): boolean` · `sellIronLeverCents(state): Cents` (0.80 × Σ resale) | stubs → 0 / false / 0 | observer, §11 counter moves |
| `transportLegs(state, from, to)` · `transportQuote(state, machineIds, from, to, mode)` · `machineCostPerHour(state, machineId, window)` · `p1MaintUsdPerSmrHour(state, machineId, ex): Calc<number>` | stubs | §13, bots |
| `materializeInheritedFleet(draft, spec: InheritedFleetSpec, fleetRng: (i: number) => Rng): MachineId[]` · `fixtureMachine(draft, spec, claimId): MachineId` | creation stubs | §1 N9 / fixtures |
| `initMarket` (N6), `marketsRefresh` (3.4), `pendingDeals` (6.2), `availability` (8.1, writes `ctx.week.fleet.availability`), `meters` (10.3), `shop` (11.1), `wrapUp` (16.10); `failures` (10.1, fromPhase 3) | stubs | framework |

**Actions:** `fleet/buy`, `fleet/move`, `fleet/sell` (§5). P1 market: hub dealer new units plus standing graded-used
offers per model and grade (S09-3), six rotating used listings per district; `ACCESS_CLOSED` only when the outlook has
no open week (S09-10); payment timing S09-12; `fleet/sell` and `fleet/move` call `ops.onMachineRemoved` and
`knowledge.onMachineRemoved` (S09-15); collateral display only (S11-3). **Alerts:** `delivery.arrived` (info, edge),
`transport.stalled`, `transport.windowClosing` (warning, level). **Hooks:** `fleet.rateMult`, `fleet.fuelBurnMult`,
`fleet.transportCostMult`, `fleet.usedPriceMult`, `fleet.newLeadAddWeeks` (P1); `fleet.machineGrounded`,
`fleet.partsLeadTimeMult`, `fleet.partsPriceMult`, `fleet.failureHazardMult` (base tuning), `fleet.wearMult`,
`fleet.fieldServiceDelayMult`, `fleet.auctionSupplyMult`, `fleet.rentalAvailMult` (P3). **RNG:** `fleet-market (turn,
districtId)` (turn 0 at N6), `fleet-listing (listingId)` with brand and ripper draws at fixed positions (S09-5,
S09-18). **Hidden:** none in P1 (S09-20); no scrambler until P3. **Selectors:** `machines`, `machine(id)`,
`equipmentListings(districtId)`, `listingView(id)` (ask, landed cost incl. sales tax and transport), `orders`,
`transports`, `machinesOnClaim`, `fleetWashCapacityBcyHr`, `distressFleetSale`, `saleLog`, `resaleEstimate`,
`machineCostPerHour`. **Explainers:** `fleetMaintRate(machineId)`, `resaleEstimate(machineId)`,
`equipmentPrice(listingId)`, `transportQuote(machineIds, toClaimId)`, `bookValue(machineId)`.

### 4.10 §10 gold (`systems/gold/`)

**Slice** (§10 10.17 P1 subset, §2 policy):

```ts
interface GoldSlice {
  buyers: Record<LocalBuyerId, LocalBuyer>; buyerIds: LocalBuyerId[];
  lots: Record<LotId, GoldLot>; lotIds: LotId[];
  claimFineness: Record<ClaimId, ClaimFineness>;       // empty in P1 (derived on read until a P5 refinery assay)
  standingOrder: StandingSaleOrder;                     // N7: { mode: 'keepCashAbove', cashFloorCents: 0, buyer: 'bestLocal' }
  sales: GoldSaleRow[];                                 // 104 wk: { turn; channel: 'local'; lotIds; rawMilliOz; fineOz (est); netCents; spotUsd }
  archive: { rawMilliOzByStatus: { assayed: number; sold: number; stolen: number }; lots: number; shipments: number; forwards: number };
  createdRawMilliOz: { cleanup: number; sample: number };   // S10-6 inventory identity
  weekSales: { fineOz: number; rawMilliOz: number; netCents: Cents };   // reset by the §2 history snapshot (§0.6 item 5)
  // P5 collections, typed per §10 10.17 and empty in P1: storage { bankBoxes }, moves / moveIds, shipments / shipmentIds,
  // metalAccounts, refineryHistory, forwards / forwardIds, puts / putIds
}
interface GoldLot { id: LotId; sourceClaimId: ClaimId | null; cleanupTurn: number; source: 'cleanup' | 'sample' | 'split';
  rawMilliOz: MilliOz;                                  // S10-5 (DESIGN's rawOz)
  trueAlloyFineness: number; trueDirtFrac: number;      // HIDDEN
  estFineness: number; estBasis: 'regionPrior' | 'sampleAssays' | 'districtAssays' | 'claimAssays';   // S10-1
  assayedFineness: number | null;
  location: GoldLotLocation;                            // full 10.9 union; P1 uses only { kind: 'camp'; claimId; inSafe: false }
  status: 'held' | 'inTransit' | 'atRefinery' | 'assayed' | 'sold' | 'stolen';   // P1 uses 'held' | 'sold'
  costBasisCents: Cents /* 0 in P1, S11-1 */; parentLotId?: LotId; terminalTurn?: number }
interface LocalBuyer { id: LocalBuyerId; districtId: DistrictId; name: string; basis: 'estimatedFine'; seasonal: false;
  biasMean: number /* HIDDEN */ }                       // weeklyCapUsd and capUsedCents absent until P5 (S10-4)
type StandingSaleOrder = { mode: 'none' } | { mode: 'sellAllAtCleanup'; channel: 'local'; buyer: 'bestLocal' | LocalBuyerId }
  | { mode: 'keepCashAbove'; cashFloorCents: Cents; buyer: 'bestLocal' | LocalBuyerId };
interface ChannelQuote { channel: 'local'; buyerId?: LocalBuyerId; basis: 'estimatedFine'; fineOz: number; grossCents: Cents;
  deductions: { key: string; cents: Cents }[]; netCents: Cents; cashTurn: number; netPerRawOz: number; pctOfSpot: number;
  priceRisk: 'none'; impliedFineness?: number; yourFineness: number }      // S10-8
interface ClaimFineness { alloy: number; alloyBasis: GoldLot['estBasis']; dirt: number; dirtBasis: 'tuning' | 'assay' }
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `addLot(draft, spec: { claimId: ClaimId; rawMilliOz: MilliOz; trueAlloyFineness: number; trueDirtFrac: number; source: 'cleanup' \| 'sample' }): LotId` (estFineness = `claimFinenessKnowledge`; increments `createdRawMilliOz`) | creation stub | framework 12.1, 12.2 |
| `claimFinenessKnowledge(state, claimId): ClaimFineness` (P1–P4: alloy = §4 `finenessP50`, else the template mean; dirt = `ops.goldRoomDirtFrac.noTable` / `.table` by `siteSupport.hasTable`, S10-1) | stub → template mean (`data/regions`) and `.noTable` | §5 f_est, §7 estDirt, §11 |
| `netSalePerFineOz(state, lotId, ex?): Calc<number>` (expected public terms, D-10.28, S10-3) | stub → spot | §11 NW and forecast, §1, bots |
| `quoteChannels(state, lotIds): ChannelQuote[]` (one local column per district buyer, S10-17) | stub → `[]` | §13 |
| `metalAccountValueForScoring(state)` → 0 · `forwardMtmLossForScoring(state)` → 0 | **real** (P1) | §11 NW |
| Prices: `spotUsdPerFineOz`, `dieselRackUsdPerGal`, `cpiIndex`, `baseRate`, `realRate`, `goldIdx`, `goldIdxReal`, `goldMomentum` `(state): number`; `goldIdxAt(state, turn)`, `goldIdxRealAt(state, turn)`, `goldMomentumAt(state, turn, weeks)` | **real** flat (from the market snapshot / tuning; setup's opening spot honoured) | everyone |
| Ripple (S10-15): `ripple(state, base, e, lagWeeks, lo, hi, opts?: { escalate?: boolean })`, `rippleRate(...)`, `rippleTwoSided(state, base, eUp, eDown, lag, lo, hi)`, `rippleAdd(state, base, ptsPerUnit, lag, cap)`, `momentumTilt(state, k, cap)`, `rippleDomain(state, key)` → `Calc<number>` | stubs → `base` (exact on the flat index) | §3, §4, §5, §8, §9 |
| `standingOrders` (12.3; sells through §11 `receive` with `goldSale: true`, oldest lots first, last partial by binary search, S10-3) · `init` (N7, `market-buyers (districtId)` layout S10-14) · `wrapUp` (16.11) | stubs | framework |
| `resetWeekSales(draft)` | **W0 real** | §2 history 16.15 |

**Actions:** `gold/sellLocal`, `gold/setStandingOrder` (§5). P5 gold actions are not registered in P1. **Alerts:** none
in P1. **Hooks:** `market.localBuyerDiscountAdd` (P1; add, 0, [−0.05, +0.15], district/claim); `market.theftHazardMult`,
`market.shippingCostMult`, `market.refineryTransitWeeksAdd`, `market.localBuyerCapMult` (P5). **RNG:** `market-buyers
(districtId)`, `buyer (buyerId, claimId)`. **Hidden:** lot true fineness and dirt, `biasMean`; scrambler `s10.ts`.
**Selectors:** `lots(filter?)` (est fine oz, value at spot and best net), `lot(id)`, `buyers(districtId?)`,
`standingOrder`, `goldSales`, `heldGoldValue` (`{ atSpotCents; expectedNetCents }`), `quoteChannels`, the price
readers. **Explainers:** `lotFineness(lotId)`, `netSalePerFineOz(lotId)`, `localBuyerQuote(lotIds, buyerId)`
(buyer's fineness a visible leaf, S10-9), `inventoryValue()`.

### 4.11 §11 finance (`systems/finance/`)

**Slice:** verbatim §11 11.23 `FinanceSlice` with inert values (§2 policy): `books` (exists); `sweep: {
operatingTargetCents: finance.defaultOperatingTargetUsd × 100, autoDrawRevolver: false, autoPaydownRevolver: false }`;
`paymentPriority`: the 11.4 default order (constant `DEFAULT_PAY_PRIORITY`); `bills`, `billIds`, `arrears`,
`arrearIds`, `loans`, `loanIds`, `obligationsByBill`, `payrollRegister` (13 runs); empty `leases`, `liens`, `cards`,
`vendorAccounts`, `applications`, `offers`, `agreements`, `covenants`, `locs`, `payrollYtd`,
`payrollQtdByJurisdiction`; `credit: { owner: { score: start score, anchor: start score, derogs: [], inquiries: [] },
company: { fileExists: false, paydex: null, U: 0, derogs: [], tradeLines: [] } }`; `insurance: { policies: {}, claims:
{}, losses: {}, emr: 1 }`; `tax: { elections: {}, estimateMethod: 'safeHarbor', distributionPolicy: 'auto', nol: { 0, 0 },
priorYear: { 0, 0, 0 }, basis: { machines: {}, claims: {} }, akHolidayStartTurn: null, installments: [] }`; `inventory:
{ pools: {}, cleanedThisWeek: [] }`; `reorg: { active: null, history: [] }`; `primaryClimate: 'northernInterior'`;
`distress`: full 11.16 `DistressState` (`stage: 0`, `enteredTurn: 0`, `history: []`, `form: null`, `nextTrigger: null`,
counters 0, `guaranteeDemands: []`, `tfrp` zeros, `p1: { openSinceTurn: null }`, `petitionDecisionId: null`,
`liquidation: null` with `caseId: null`).

**Types:** verbatim §11 11.3, 11.4, 11.7, 11.16, 11.23: `PayCategory`, `Bill` (+ `payee: PayeeRef`, `closedTurn: number |
null`, `source: string`, `accrualTxnId: TxnId | null`), `Arrear`, `PaymentRequest`, `PayResult`, `ReceiptRequest`,
`Loan`, `PaymentScheduleKind`, `CollateralRef`, `PayrollLine`, `PayrollRegisterLine`, `DistressState`,
`MonthlySummary`, `CostCenter` (exists). New (S11-6, S11-19, S13-2, S10-2):

```ts
interface PayeeRef { kind: 'vendor' | 'employee' | 'lender' | 'lessor' | 'investor' | 'owner' | 'agency' | 'buyer' | 'insurer'; id?: string; name: string }
interface NewBill { payee: PayeeRef; category: PayCategory; amountCents: Cents; dueTurn: number; allowPartial: boolean;
  accrual: PostingLine[] | null; payableAccount: AccountCode; loanId?: LoanId; obligationId?: ObligationId;
  refs: EntityRef[]; memo: string; source: string }
interface PaymentEvent { turn: number; kind: 'paid' | 'partial' | 'failed'; category: PayCategory; billId: BillId; shortCents: Cents }
interface LedgerFilter { book?; accounts?; fromTurn?; toTurn?; claimId?; costCenter?: CostCenter; minCents?: Cents;
  maxCents?: Cents; text?: string; ref?: EntityRef; txnIds?: TxnId[] }                      // extends the P0 filter
interface LedgerPage { rows: Txn[]; summaries: MonthlySummary['rows']; total: number; netCents: Cents }
interface LoanSpec { product: 'estateNote' | 'fixedP1' | 'ownerLoan'; lenderName: string; principalCents: Cents;
  annualRate: number; termMonths: number; schedule: 'level' | 'seasonal'; payMonths?: number[]; fundedTo: 'cash' | 'none';
  guarantee?: Guarantee | null; collateral: CollateralRef[] }
interface PendingWeekCosts { unbilledCents: Cents; payrollCents: Cents }
interface DistressStatusP1 { stage: 0 | 1 | 2 | 3; stageKey: 'none' | 'lateVendors' | 'missedLoan' | 'missedPayroll';
  p1Counter: { open: boolean; openSinceTurn: number | null; weeksOpen: number; graceWeeks: number; netCashCents: Cents };
  counterMoves: { kind: 'sellGold' | 'quickSellClaim' | 'sellIron' | 'injectEquity' | 'injectLoan'; valueCents: Cents; ref?: EntityRef }[];
  liquidation: DistressState['liquidation'] }
interface FundingPreview { needCents: Cents; fundCents: Cents; autoGoldCents: Cents; shortfallCents: Cents;
  firstShort: { category: PayCategory; shortCents: Cents; consequenceKey: string } | null }
interface Forecast13Week { weeks: { turn: number; outflowsCents: Cents; inflowsSchedCents: Cents; inflowsProdCents: Cents; endCashCents: Cents }[];
  productionByClaim: Record<ClaimId, Cents> }
```

**Functions**

| Function | W0 body | Callers |
|---|---|---|
| `post(state, entry)` (exists) | — | — |
| `pay(draft, req: PaymentRequest): PayResult` (P1: funds from `cash.operating`; `allowPartial: false` fails whole; Dr `req.lines` / Cr cash; pipeline priority reserve added by the §11 package) | **W0 real** | every action that pays, §9 step 6 |
| `receive(draft, req: ReceiptRequest): TxnId` (Dr cash / Cr `req.lines`; `goldSale` flag kept; no sweep in P1) | **W0 real** | §10, §5 quick sale, §9 sale |
| `bill(draft, b: NewBill): BillId` · `billBatch(draft, source, bills: NewBill[]): BillId[]` (one accrual txn per call, S11-7) | **W0 real** (record + accrual posting; settlement is the §11 package's) | §9, §11 |
| `queryLedger(state, filter: LedgerFilter, page: { offset: number; limit: number }): LedgerPage` (S11-19) | stub → empty page (the UI keeps `ui/explain/ledger.ts` until the §11 package lands) | §13 |
| `obligationPayCategory(obl): PayCategory` | **W0 real** (11.4 table) | §11 |
| `createLoan(draft, spec: LoanSpec): LoanId` (level or generalized seasonal schedule, 11.7; obligations for the next 6 payments, S11-25) | creation stub | §1 N9, fixtures |
| `drawdownDeferredRevenue(draft, claimId, s: Settlement, turn)` (Backed royalty deliveries) | stub | framework 12.1, 12.2 |
| `pendingCostsThisWeek(state, ctx): PendingWeekCosts` · `dueThisWeek(state, pending?: PendingWeekCosts): Cents` (S10-2) | stubs → zeros / 0 | §10 standing orders |
| `cashOnHand`, `availableLiquidity` (= cash on hand in P1) | **real** | everyone |
| `netWorth(state, mode)`, `companyNetWorth(state)` (signature now takes `state`; P1 terms: lots × `netSalePerFineOz`, Σ `resaleEstimate`, claims at cost, debts, §1 waterfall, liquidated-run rule S11-10) | **W0**: P0 body behind the new signature (new terms come from stubs returning 0, so values are unchanged) | §1, §13, history, observer |
| `ownerPersonalCash`, `ownerLoanToCompany`, `ownerPersonalDebt`, `ownerGuaranteeDue`, `ownerTaxDue` `(state): Cents` (owner-book balances, s01#6) | **real** | §1, §13, validators |
| `periodNetIncome(state, fromTurn, toTurn): Cents` (summaries + detail) | **W0**: existing `periodTotals` (detail only; compaction ships with the package) | history, observer, §13 |
| `forecast13Week(state, opts?: { hypothetical?: { cashDeltaCents: Cents; obligations: ObligationSpec[] } }): Forecast13Week` (P1 outflows S11-14; memoized, S11-23) | stub → empty | §13, step 15, bots |
| `costPerOunce(state, period, claimId?)` · `claimPnL(state, period)` · `incomeStatement(state, period)` · `spendByCategory(state, fromTurn, toTurn, claimId?)` (s02#14) · `payrollSummary(state)` · `fundingPreview(state, opts?)` (S13-2) | stubs → empty | §13, history (16.15 week 1), observer |
| `distressStatus(state): DistressStatusP1` (S11-9, S11-17) | stub → stage 0, counter closed, no moves, `liquidation` from the slice | §1 validators, §9 sale tag, §13, bots |
| `onObligationSatisfied(draft, obl)` · `onObligationCancelled(draft, obl)` (cancel the open bill) | stubs | §6 |
| `financeStep` (14.1), `distressStep` (15.1); `pendingDeals` (6.4, fromPhase 4) | stubs | framework |

**Actions:** `finance/payBill`, `finance/prepay` (§5). Every pipeline bill is `allowPartial: true` in P1; settlement
walks past an unfundable non-partial bill (S11-24); bills are due the week issued in P1 (S11-20); owner-category items
never open the counter (S11-8). **Alerts:** `cash.projectedNegative` (step 15, §0.6 item 3), `payroll.missed`,
`loan.paymentMissed`, `distress.stage`. **Hooks:** `finance.lenderSpreadAdd`, `finance.lenderMaxLtvAdd`,
`finance.lenderAppetiteShift`, `finance.lineLimitMult`, `finance.insurancePremiumMult`, `finance.vendor.limitMult`,
`finance.wageLienSweep` (P4). **RNG:** none in P1. **Hidden:** none. **Selectors:** `cashOnHand`,
`availableLiquidity`, `netWorth`, `companyNetWorth`, `dueThisWeek`, `periodNetIncome`, `forecast13Week`,
`costPerOunce`, `claimPnL`, `incomeStatement`, `distressStatus`, `bills(filter?)`, `arrears`, `loans`, `loan(id)`,
`payrollSummary`, `payrollRegister`, `ownerPersonalCash` (+ the other owner balances), `fundingPreview`,
`spendByCategory`, `queryLedger`. **Explainers:** `cash` (exists), `netWorth` (exists; gains the P1 terms),
`statementLine(period, lineKey)`, `forecast13Week()`, `insolvencyCounter()`, `loanPayment(loanId)`,
`costPerOunce(period, claimId?)`, `fundingPreview()`.

### 4.12 §12 events and competitors (`systems/events/`, `systems/competitors/`)

**Slice:** verbatim §12 12.1 `EventsSlice` (S12-4): existing `modifiers`, `modifierIdsByTarget`, `modifiersVersion`
plus `active: {}`, `activeIds: []`, `history: []`, `annualCounts: {}`, `cooldowns: {}`, `categoryBlockedUntil: {}`,
`director: { halfIndex: 0, pointsUsed: 0, catastropheBlockedUntil: 0, acceptedThisWeek: 0, external: [] }`,
`scheduled: []`, `preps: {}`, `prepIds: []`. `CompetitorSlice` unchanged (P5). **Types** verbatim §12 12.1–12.3:
`EventDef`, `EventInstance`, `EffectSpec`, `ResponseSpec`, `EventSeverity`, `EventCategory`, `ScopeKind`, `ScopeRef`,
`PrepDef`, `PrepRecord`, `HookKey` (= the registry's keys), `EffectModifier`/`EffectQuery`/`EffectScope` (exist).

| Function | W0 body | Callers |
|---|---|---|
| `effective(state, key: HookKey, q: EffectQuery): number` (exists) | — | everyone |
| `qDistrict`, `qClaim`, `qBlock`, `qMachine`, `qEmployee`, `qCompany` (§1.9) | **W0 real** | everyone |
| `addModifier(events, m)` / `removeModifier(events, id)` (exist; + registry validation of op and bounds) | W0 adds the validation | §12, §5 (P5 disputes) |
| `onBlockStripped(draft, ctx, { claimId, blockId })` · `onBlockMined(draft, ctx, { claimId, blockId })` · `onCleanup(draft, ctx, { claimId, lineId, cleanup })` | **real** no-ops in P1 | §7, framework 12.1 |
| `competitorLaborDemand(state, districtId)` → 0 · `competitorInterest(state, listingId)` → 0 | **real** (P1 forms) | §8, §5 |
| Rolling and director (pure): `eventProbability`, `windowBase`, `tiltSeverity`, `drawMagnitude`, `drawDuration`, `pickVictim`, `runDirector`, `directorBudget` | stubs (the §12 package) | `eventsStep` |
| `eventsStep` (4.2), `wrapUp` (16.12); `tallyShocks` (10.6, fromPhase 3); `competitors.step` (5.1, fromPhase 5) | stubs | framework |

**Data:** `data/events/catalog.ts` (`EventDef[]`, empty), `data/events/preps.ts` (empty), `data/text/events.ts` (empty).
**Selectors:** `activeEvents` → `[]`, `visibleEffectModifiers`, `scheduledEventEffects` → `[]`. No actions in P1.

### 4.13 §13 inbox (`systems/inbox/`)

**Types:** existing `Severity`, `ALERT_KINDS`, `AlertKind`, `AlertSignal`, `InboxMessage`, `InboxSlice`,
`SuggestedAction`; `AlertSignal.decisionId?: DecId` (S12-2); `InboxMessage.action?: SuggestedAction`,
`InboxMessage.explain?: ExplainRef` copied from the latest signal (S12-11). New `systems/inbox/taxonomy.ts`:
`ALERT_TAXONOMY: Record<AlertKind, { owner: number; severity: Severity | 'rule'; trigger: 'level' | 'edge'; phase:
RulesPhase; thresholdKeys: TuningKey[] }>` (S12-12) for every kind (P1 rows in §6 of this contract).

| Function | W0 body | Callers |
|---|---|---|
| `collateAlerts(draft, signals: AlertSignal[], turn, mode: 'week' \| 'action'): StopCandidate[]` (S12-3; full 13.10 collation, obligation ladder and grouping, S13-13) | stub → P0 behaviour (no messages; blocking decisions created this turn) | 16.14, `applyAction` |
| `emitAlert(ctx, signal)` (validates kind against `ALERT_KINDS` and the taxonomy, pushes to the report) | **W0 real** | every pipeline part |
| `obligationAlertSeverity(obl, turn, tuning): Severity \| null` | stub → `null` | §6 sub-step j |
| `needsAction(obl): boolean` (= statutory and not auto-paid; false for every P1 obligation) | **W0 real** | stops, §6 |
| `upcomingDeadlines(state)` (exists; gains obligations), `evaluateStops`, `defaultStopRules` (exist) | inbox package extends | §2.7, UI |

**Selectors:** `inboxMessages(filter?)`, `openDecisionsWithMessages`, `obligationGroupMembers(msgId)`.

### 4.14 §2 history (`systems/history/`) and framework selectors

`companySnapshot(state, ctx)`, `yearRollup(state, year)` and `HISTORY_METRIC_INFO` as in §1.8. Snapshot sources: cash
and NW from §11 selectors; `payWashedBcy` and per-claim bcy from `ctx.week.ops.results`; `weighedRawOz` from
`ctx.week.cleanup.results`; `sampleRawOz` from `ctx.week.knowledge.sampleLots`; `fineOzRecovered` from both (weighed
raw × lot `estFineness`); `soldFineOz` from `gold.weekSales` (then `gold.resetWeekSales`); in-kind fields from the
cleanup results' settlements. `claimsHeld` in the rollup = §5 `controlledClaimCount`.

---

## 5. Action catalog (P1)

Every row is registered in Wave 0 with `stubActionDef` (`fromPhase: 1`, the flags shown) and its payload type in the
family union; the owner package replaces the row. R = reveals, C = commits (`markCommits()` where conditional). Money in
actions is intent: `…Usd` numbers where DESIGN wrote them, `…Cents` integers otherwise. `INSUFFICIENT_FUNDS` means the
action-time `finance.pay` failed (no state change). Framework codes (`ACTION_MALFORMED`, `GAME_OVER`,
`ACTION_NOT_IN_PHASE`, `NOT_IMPLEMENTED`) apply to all rows.

### 5.1 Payloads

```ts
type CompanyAction =
  | { type: 'owner/setAssignment'; assignment: OwnerAssignment } | { type: 'owner/setSalary'; usdPerWeek: number }
  | { type: 'owner/draw'; amountUsd: number } | { type: 'owner/inject'; amountUsd: number; form: 'equity' | 'loan' }
  | { type: 'community/sponsor'; amountUsd: number } | { type: 'game/retire' };
type WorldAction =
  | { type: 'world/siteVisit'; claimId: ClaimId; ownerTime?: 'queue' | 'now' }
  | { type: 'world/setWatch'; target: { districtId: DistrictId } | { claimId: ClaimId }; on: boolean };
type ProspectAction =
  | { type: 'prospect/panSurvey'; claimId: ClaimId; people: (EmployeeId | 'owner')[]; stations: number; ownerTime?: 'queue' | 'now' }
  | { type: 'prospect/createProgram'; claimId: ClaimId; methodId: MethodId; delivery: 'own' | 'contractor';
      targets?: SampleTarget[]; preset?: 'everyBlock' | 'fences' | 'voiTop'; sampleBcy?: number; crew?: (EmployeeId | 'owner')[];
      machines?: MachineId[]; geologist?: GeologistRef | null; daysPerWeek: number; hoursPerDay: number;
      budgetCapCents: Cents; order: 'asListed' | 'voi' }
  | { type: 'prospect/modifyProgram'; programId: ProgramId; patch: ProgramPatch }   // plan, crew, machines, geologist, days, hours, cap
  | { type: 'prospect/pauseProgram' | 'prospect/resumeProgram' | 'prospect/cancelProgram'; programId: ProgramId }
  | { type: 'prospect/bookContractor'; contractorId: ContractorId; methodId: MethodId; claimId: ClaimId; programId: ProgramId; earliestTurn: number }
  | { type: 'prospect/recordsReview'; target: { claimId: ClaimId } | { creekId: CreekId }; reviewer: ReviewerRef }
  | { type: 'prospect/engageConsultant'; tier: 'budget' | 'standard' | 'premier'; scope: 'supervision';
      target: { claimId: ClaimId } | { listingId: ClaimListingId }; days?: number }
  | { type: 'prospect/setPlanning'; claimId?: ClaimId; assumptions: Partial<PlanningAssumptions> | null };
type LandAction =
  | { type: 'land/acceptAsk'; listingId: ClaimListingId; structure: 'sale' | 'lease' }
  | { type: 'land/buyDownRoyalty'; interestId: ProductionInterestId; points: number }      // 0.5 steps
  | { type: 'land/exerciseOption' | 'land/quickSell'; tenureId: TenureId }
  | { type: 'land/setLeaseRenewal'; tenureId: TenureId; renew: boolean }
  | { type: 'land/surrenderLease' | 'land/relinquish'; tenureId: TenureId; confirmUnreclaimed?: boolean };
type PermitsAction =
  | { type: 'permits/payObligation'; obligationId: ObligationId } | { type: 'permits/payObligations'; obligationIds: ObligationId[] }
  | { type: 'permits/setAutoPay'; obligationId: ObligationId; on: boolean };
type OpsAction =
  | { type: 'ops/setMinePlan'; claimId: ClaimId; plan: MinePlan } | { type: 'ops/setPlanActive'; claimId: ClaimId; active: boolean }
  | { type: 'ops/cleanupNow' | 'ops/tailingsAudit'; claimId: ClaimId; lineId?: LineId }
  | { type: 'ops/movePlant'; claimId: ClaimId; toBlockId: BlockId; lineId?: LineId }
  | { type: 'ops/mobilizeSite' | 'ops/winterize' | 'ops/startup' | 'ops/demobilizeSite' | 'ops/drillWell'; claimId: ClaimId };
type PayOffer = { kind: 'hourly'; centsPerHour: Cents } | { kind: 'salary'; centsPerYear: Cents };
type StaffAction =
  | { type: 'staff/hire'; candidateId: CandidateId; role?: Role; pay: PayOffer; startTurn: number; assignment: Assignment; flyInIfClosed?: boolean }
  | { type: 'staff/cancelHire'; employeeId: EmployeeId }
  | { type: 'staff/useRecruiter'; role: Role; districtId: DistrictId; count: 1 | 2 | 3 }
  | { type: 'staff/assign'; employeeId: EmployeeId; assignment: Assignment; flyInIfClosed?: boolean }
  | { type: 'staff/setPay'; employeeId: EmployeeId; pay: PayOffer }
  | { type: 'staff/giveBonus'; employeeIds: EmployeeId[]; cents: Cents }
  | { type: 'staff/fire'; employeeId: EmployeeId; cause: 'none'; severanceWeeks: number }
  | { type: 'staff/layoff'; employeeIds: EmployeeId[]; recall: boolean }
  | { type: 'staff/recall'; employeeIds: EmployeeId[]; startTurn: number; flyInIfClosed?: boolean };
type FleetAction =
  | { type: 'fleet/buy'; listingId: EquipListingId; payment: 'cash'; deliverTo: { kind: 'claim'; id: ClaimId }; options?: MachineOption[] }
  | { type: 'fleet/move'; machineIds: MachineId[]; to: { kind: 'claim'; id: ClaimId }; mode: 'auto' | 'road' }
  | { type: 'fleet/sell'; machineId: MachineId; channel: 'dealerCash' };
type GoldAction =
  | { type: 'gold/sellLocal'; lotIds: LotId[]; buyerId: LocalBuyerId; rawOz?: number }   // partial: one lot, multiple of 0.001
  | { type: 'gold/setStandingOrder'; order: StandingSaleOrder };
type FinanceAction =
  | { type: 'finance/payBill'; billId: BillId; amountUsd?: number }
  | { type: 'finance/prepay'; loanId: LoanId; amount: { usd: number } | 'payoff' };
type Action = DecisionAnswerAction | CompanyAction | WorldAction | ProspectAction | LandAction | PermitsAction
  | OpsAction | StaffAction | FleetAction | GoldAction | FinanceAction;
```

### 5.2 Rows, codes and warnings

| Type | § | R / C | Error codes (beyond framework) | Warnings |
|---|---|---|---|---|
| `owner/setAssignment` | 1 | – / – | `CLAIM_NOT_ACTIVE`, `ASSIGNMENT_INVALID`, `ROLE_NOT_AVAILABLE`, `PROGRAM_NOT_ACTIVE`, `MACHINE_NOT_ON_CLAIM`, `OWNER_INJURED`, `FOREMAN_SLOT_TAKEN` | `SMALL_CREW_ENDS` |
| `owner/setSalary` | 1 | – / – | `NEGATIVE_AMOUNT`, `ABOVE_CAP_INVESTOR`, `DISTRESS_BLOCKED` (increase while the counter is open) | |
| `owner/draw` | 1 | – / – | `NEGATIVE_AMOUNT`, `INSUFFICIENT_FUNDS` (draw + pro-rata), `DISTRESS_BLOCKED` | |
| `owner/inject` | 1 | – / – | `NEGATIVE_AMOUNT`, `INSUFFICIENT_PERSONAL_CASH`, `EQUITY_LOCKED` | |
| `community/sponsor` | 1 | – / C | `BELOW_MINIMUM`, `CAP_REACHED`, `INSUFFICIENT_FUNDS` | |
| `game/retire` | 1 | – / C | `SCENARIO_ACTIVE` | |
| `world/siteVisit` | 3 | – / – | `CLAIM_UNKNOWN`, `ACCESS_CLOSED`, `OWNER_INJURED`, `VISIT_ALREADY_BOOKED`, `INSUFFICIENT_FUNDS` | `DESK_DAYS_QUEUED` |
| `world/setWatch` | 3 | – / – | `UNKNOWN_TARGET`, `WATCH_LIMIT` | |
| `prospect/panSurvey` | 4 | – / – | `NO_ACCESS`, `NOT_IN_SEASON`, `ACCESS_CLOSED`, `OWNER_INJURED`, `VISIT_ALREADY_BOOKED`, `CREW_UNAVAILABLE`, `INSUFFICIENT_FUNDS` | `DESK_DAYS_QUEUED` |
| `prospect/createProgram` | 4 | – / – | `NO_ACCESS`, `METHOD_NOT_AVAILABLE`, `MACHINE_UNSUITABLE`, `MACHINE_NOT_ON_CLAIM`, `CREW_UNAVAILABLE`, `GEOLOGIST_REQUIRED`, `GEOLOGIST_AT_CAPACITY`, `INVALID_TARGET`, `BLOCK_BEING_MINED` | `NOT_IN_SEASON`, `PERMIT_REQUIRED` (program waits) |
| `prospect/modifyProgram` | 4 | – / – | `PROGRAM_NOT_FOUND`, `PROGRAM_CLOSED` + the create codes | as create |
| `prospect/pauseProgram`, `resumeProgram`, `cancelProgram` | 4 | – / – | `PROGRAM_NOT_FOUND`, `PROGRAM_CLOSED` | |
| `prospect/bookContractor` | 4 | – / C | `NO_RIG_AVAILABLE`, `METHOD_NOT_AVAILABLE`, `PROGRAM_NOT_FOUND`, `INSUFFICIENT_FUNDS` | |
| `prospect/recordsReview` | 4 | – / C if consultant | `REVIEW_IN_PROGRESS`, `GEOLOGIST_AT_CAPACITY`, `INVALID_TARGET`, `INSUFFICIENT_FUNDS` | `DESK_DAYS_QUEUED` |
| `prospect/engageConsultant` | 4 | – / C | `CONSULTANT_UNAVAILABLE`, `INVALID_TARGET`, `INSUFFICIENT_FUNDS` | |
| `prospect/setPlanning` | 4 | – / – | `INVALID_VALUE` | |
| `land/acceptAsk` | 5 | – / C | `LISTING_NOT_OPEN`, `STRUCTURE_NOT_OFFERED`, `INSUFFICIENT_FUNDS` | |
| `land/buyDownRoyalty` | 5 | – / C | `NO_BUYDOWN_CLAUSE`, `BUYDOWN_FLOOR`, `IN_DEFAULT`, `INSUFFICIENT_FUNDS` | |
| `land/exerciseOption` | 5 | – / C | `TENURE_NOT_FOUND`, `NO_OPTION`, `OPTION_EXPIRED`, `IN_DEFAULT`, `INSUFFICIENT_FUNDS` | |
| `land/setLeaseRenewal` | 5 | – / – | `TENURE_NOT_FOUND`, `NO_RENEWAL_RIGHT`, `IN_DEFAULT` | `RENEWAL_OPT_OUT_SITE_ACTIVE` |
| `land/surrenderLease` | 5 | – / C | `TENURE_NOT_FOUND`, `NOT_LEASED`, `SURRENDER_PENDING`, `SITE_ACTIVE` | |
| `land/quickSell` | 5 | – / C | `TENURE_NOT_FOUND`, `TENURE_NOT_OWNED`, `QUICK_SALE_PENDING`, `SITE_ACTIVE` | |
| `land/relinquish` | 5 | – / C | `TENURE_NOT_FOUND`, `TENURE_CANNOT_RELINQUISH`, `SITE_ACTIVE` | |
| `permits/payObligation` | 6 | – / – | `OBLIGATION_NOT_FOUND`, `OBLIGATION_NOT_OPEN`, `NOT_PAYABLE`, `INSUFFICIENT_FUNDS` | |
| `permits/payObligations` | 6 | – / – | `EMPTY_BATCH`, `OBLIGATION_NOT_FOUND` | `BATCH_PARTIAL` |
| `permits/setAutoPay` | 6 | – / – | `OBLIGATION_NOT_FOUND`, `NOT_AUTOPAY_ELIGIBLE` | |
| `ops/setMinePlan` | 7 | – / – | `CLAIM_NOT_HELD`, `FOREMAN_REQUIRED`, `LINE_LIMIT`, `LINE_INVALID`, `BLOCK_NOT_IN_CLAIM`, `CUT_NOT_CONTIGUOUS`, `CUT_EMPTY`, `BLOCK_RECLAIMED`, `BLOCK_OCCUPIED`, `BLOCK_EXCLUDED`, `MACHINE_NOT_ON_CLAIM`, `ASSET_DOUBLE_BOOKED`, `ROLE_INCOMPATIBLE`, `EMPLOYEE_NOT_AVAILABLE`, `SCHEDULE_INVALID`, `FEED_TARGET_TOO_HIGH`, `PLANT_NO_FEED`, `BULK_SAMPLE_LIMIT`, `LINE_NEEDS_PLANT_OPERATOR` (P3) | = `projectOpsVisible(…).warnings`: `TRUCKS_UNDERMATCHED`, `WATER_SHORT`, `POWER_SHORT`, `FUEL_SHORT`, `ONE_PLANT_OPERATOR_TWO_SHIFTS`, `STRIP_BELOW_NEED`, `PILE_STRIPPED_AS_WASTE`, `SMALL_CREW_NO_FOREMAN`, `FIELD_IGNORED_THIS_PHASE`, `LINE_LEAD_HAND` (P3) |
| `ops/setPlanActive` | 7 | – / – | `CLAIM_NOT_HELD`, `SITE_NOT_READY`, `FOREMAN_REQUIRED`, `CUT_EMPTY` | |
| `ops/cleanupNow` | 7 | – / – | `NO_PLANT`, `SITE_NOT_RUNNING`, `LINE_INVALID` | |
| `ops/movePlant` | 7 | – / – | `BLOCK_NOT_IN_CLAIM`, `BLOCK_OCCUPIED`, `BLOCK_EXCLUDED`, `LINE_INVALID` | `PAY_UNDER_PLANT_SITE` |
| `ops/mobilizeSite` | 7 | – / C | `CLAIM_NOT_HELD`, `SITE_EXISTS`, `ACCESS_CLOSED`, `INSUFFICIENT_FUNDS` | |
| `ops/winterize` | 7 | – / – | `SITE_NOT_RUNNING` | |
| `ops/startup` | 7 | – / – | `SITE_NOT_WINTERIZED`, `NO_CREW_ON_SITE` | |
| `ops/demobilizeSite` | 7 | – / C | `SITE_NOT_READY`, `ACCESS_CLOSED` | `MACHINES_ON_SITE` |
| `ops/drillWell` | 7 | – / C | `SITE_NOT_READY`, `WELL_LIMIT`, `NOT_ARID`, `INSUFFICIENT_FUNDS` | |
| `ops/tailingsAudit` | 7 | R / C (draws `ops-audit`) | `NO_PLANT_OPERATOR`, `LINE_INVALID`, `INSUFFICIENT_FUNDS` | |
| `staff/hire` | 8 | – / C | `CANDIDATE_GONE`, `ROLE_NOT_ELIGIBLE`, `START_TOO_SOON`, `PAY_BELOW_ASK`, `BELOW_MIN_WAGE`, `SALARY_NOT_EXEMPT`, `ASSIGNMENT_INVALID`, `ROLE_INCOMPATIBLE` | `CAMP_FULL`, `SMALL_CREW_ENDS` |
| `staff/cancelHire` | 8 | – / C | `EMPLOYEE_NOT_FOUND`, `NOT_PENDING` | |
| `staff/useRecruiter` | 8 | – / C | `ROLE_NOT_ELIGIBLE`, `INSUFFICIENT_FUNDS` | |
| `staff/assign` | 8 | – / – | `EMPLOYEE_NOT_FOUND`, `EMPLOYEE_NOT_AVAILABLE`, `ROLE_INCOMPATIBLE`, `FOREMAN_SLOT_TAKEN`, `COVERAGE_ROLE_ONLY`, `ASSIGNMENT_INVALID` | `SMALL_CREW_ENDS`, `CAMP_FULL` |
| `staff/setPay` | 8 | – / – | `EMPLOYEE_NOT_FOUND`, `BELOW_MIN_WAGE`, `SALARY_NOT_EXEMPT` | |
| `staff/giveBonus` | 8 | – / – | `EMPLOYEE_NOT_FOUND`, `NEGATIVE_AMOUNT`, `INSUFFICIENT_FUNDS` | |
| `staff/fire` | 8 | – / C | `EMPLOYEE_NOT_FOUND`, `CAUSE_NOT_DOCUMENTED` | |
| `staff/layoff` | 8 | – / C | `EMPLOYEE_NOT_FOUND`, `EMPLOYEE_NOT_AVAILABLE` | |
| `staff/recall` | 8 | – / C | `NOT_ON_RECALL_LIST`, `START_TOO_SOON` | `SMALL_CREW_ENDS` |
| `fleet/buy` | 9 | – / C | `LISTING_GONE`, `NOT_FOR_SALE`, `DESTINATION_INVALID`, `OPTION_INVALID`, `ACCESS_CLOSED`, `INSUFFICIENT_FUNDS` | `TRANSPORT_WINDOW_RISK`, `TRANSPORT_UNFUNDED` |
| `fleet/move` | 9 | – / C | `MACHINE_NOT_FOUND`, `MACHINE_IN_TRANSIT`, `DESTINATION_INVALID`, `ACCESS_CLOSED`, `INSUFFICIENT_FUNDS` | `TRANSPORT_WINDOW_RISK`, `MACHINE_IN_PLAN` |
| `fleet/sell` | 9 | – / C | `MACHINE_NOT_FOUND`, `MACHINE_IN_TRANSIT` | `MACHINE_IN_PLAN` |
| `gold/sellLocal` | 10 | – / C (draws `buyer`) | `LOT_NOT_HELD`, `BUYER_NOT_IN_DISTRICT`, `AMOUNT_INVALID` | |
| `gold/setStandingOrder` | 10 | – / – | `BUYER_NOT_FOUND`, `REFINERY_NOT_AVAILABLE`, `AMOUNT_INVALID` | |
| `finance/payBill` | 11 | – / – | `BILL_NOT_FOUND`, `AMOUNT_INVALID`, `INSUFFICIENT_FUNDS` | |
| `finance/prepay` | 11 | – / – | `LOAN_CLOSED`, `AMOUNT_INVALID`, `INSUFFICIENT_FUNDS` | |
| `decision/answer` | 13 | (option's) | exists; + the linked message → `answered` | |

Decisions created in P1: `land.leaseRenewal` (§5), `staff.layoffDecision`, `staff.recallDecision` (§8); all non-blocking
with `defaultOptionId`. Codes not in DESIGN (added by rulings or this contract): `NOT_IMPLEMENTED`,
`ACTION_NOT_IN_PHASE`, `VISIT_ALREADY_BOOKED` (s03#8), `BELOW_MINIMUM` (s01#26), `BLOCK_BEING_MINED` (s07#26),
`CUT_EMPTY` (s07#5), `SITE_ACTIVE`, `NOT_LEASED`, `SURRENDER_PENDING`, `QUICK_SALE_PENDING` (s05#13, digest),
`TENURE_NOT_FOUND`, `PROGRAM_NOT_FOUND`, `EMPLOYEE_NOT_FOUND`, `MACHINE_NOT_FOUND`, `OBLIGATION_NOT_FOUND`,
`OBLIGATION_NOT_OPEN`, `NOT_PAYABLE`, `EMPTY_BATCH` (lookup codes) and every warning code except `SMALL_CREW_ENDS`,
`CAMP_FULL`, `TRANSPORT_WINDOW_RISK`, `TRANSPORT_UNFUNDED`, `BATCH_PARTIAL`, `LINE_LEAD_HAND` (rulings). Each folder's
`errors.ts` lists its codes; the UI text catalog needs a reason string for each (T24).

---

## 6. Alert kinds in P1

Emitters push `AlertSignal`s with `emitAlert`; §13's collation turns them into messages. W0 adds the new kinds to
`ALERT_KINDS` and writes `ALERT_TAXONOMY` rows for every P1 kind. Severity and trigger are §13 13.10's except where
marked.

| Kind | Owner (emitting part) | Severity · trigger | Change in P1 |
|---|---|---|---|
| `season.phaseChange` | §1 (1.2) | info · edge | **was warning for held districts** (S12-8) |
| `season.forecastUpdate` | §1 (1.2) | info · edge | |
| `weather.severe` | §1 (1.2) | info / warning · edge | trigger rule s01#10 |
| `listing.new`, `listing.priceChanged`, `siteVisit.report` | §3 (16.5) | info · edge | |
| `prospect.resultsReady`, `prospect.classChanged` | §4 (16.6) | warning on owned or watched claims, else info · edge | |
| `prospect.programPaused` / `prospect.sellerContradicted` | §4 (16.6) | warning / info · edge | |
| `lease.anniversarySoon` | §5 (16.7) | info · **level** (≤ 4 wk) | S12-13 |
| `lease.defaultNotice` | §5 (13.1 via `land.onObligationMissed`) | critical · edge | **new** (s05#20) |
| `lease.terminated` | §5 (6.1) | warning · edge | **new** |
| `lease.ended` | §5 (6.1) | info · edge (surrender or expiry) | **new** |
| `land.quickSaleClosed` | §5 (6.1) | info · edge | **new** |
| `land.interestChanged` | §5 (12.1 settlement: step-down or cap) | info · edge | **new** |
| `obligation.dueSoon` | §6 (13.1, sub-step j) | ladder, capped at info in P1 · level | S12-9 |
| `obligation.missed` | §6 (13.1) | critical · edge (§6, §5, §1 items only) | S12-9 |
| `ops.plantIdleHigh` | §7 (16.8) | warning · level (dedupe per line) | |
| `ops.stripCoverageLow`, `ops.waterLimited`, `ops.cleanupOverdue`, `ops.padFull` | §7 (16.8) | warning · level | |
| `ops.freezeUpNotWinterized` | §7 (16.8) | **info** while auto-winterize applies · level | s07#24 |
| `ops.cleanupDone` | §7 (16.8) | info · edge (per line) | |
| `crew.noForeman` | §8 (16.9) | warning · level (one per claim) | §8 only emitter (S08-20) |
| `employee.quit` | §8 (16.9) | warning; critical for the only foreman, plant operator or mechanic · edge | |
| `crew.moraleLow` | §8 (16.9) | warning · level | |
| `crew.leadHand` | §8 (16.9) | info · level | |
| `staff.layoffDecision`, `staff.recallDecision` | §8 (16.9) | warning · edge, with `decisionId` | S12-2 |
| `delivery.arrived` | §9 (16.10) | info · edge | |
| `transport.stalled`, `transport.windowClosing` | §9 (16.10) | warning · level | |
| `cash.projectedNegative` | §11 (**15.1**) | warning (P50 < 0 within `finance.distress.watchWeeks`) · level | emitted in step 15 (§0.6 item 3) |
| `payroll.missed`, `loan.paymentMissed` | §11 (14.1, 14f) | critical · edge | |
| `distress.stage` | §11 (15.1) | critical on entering a higher P1 stub stage · edge | |

Not in P1: `company.welcome` (rejected, §0.6 item 1), every other 13.10 kind (their owners' phases). Templates live in
`data/text/alerts.ts` (`alert.<kind>[.<variant>]`, S13-14); T21 cross-checks kinds ↔ taxonomy ↔ templates ↔ emitters.

---

## 7. Hook registry rows (`src/data/events/hooks.ts`, S12-5, S12-14)

The registry holds the union of every owner's published hooks; each owner's `hooks.ts` exports its keys and a test checks
the union both ways. `base: 'tuning'` rows resolve from the named tuning key (difficulty-scaled), else from `neutral`.
P1 readers must read through `effective()` (lint rule `no-raw-hook-read`, live once rows exist). Scope dims are the
query fields a modifier may target.

| Key | Owner | Ops (bounds) | Neutral / base | Scope dims | Consumer phase |
|---|---|---|---|---|---|
| `season.breakupShiftWeeks`, `season.freezeUpShiftWeeks` | §1 | add | 0 | district | 1 |
| `access.roadOpen`, `access.airOpen` | §1 | set {0, 1} | 1 | district | 1 |
| `geology.access.closed` | §3 | set {0, 1} | 0 | district, claim | 1 |
| `geology.supply.listingHazardMult` | §3 | mul | 1 | district | 1 |
| `prospect.rateMult` | §4 | mul | 1 | claim | 1 |
| `prospect.pitStopProbMult`, `prospect.recordsFindMult`, `prospect.consultantLeadMult`, `prospect.contractorCostMult` | §4 | mul | 1 | district, claim | 1 |
| `prospect.contractorLeadTimeMult` | §4 | mul | 1 | district | 1 |
| `prospect.labTurnaroundWeeksAdd` | §4 | add | 0 | company | 3 |
| `land.askPriceMult`, `land.rivalSaleMult` | §5 | mul | 1 | district | 1 |
| `land.sellerMotivationAdd` | §5 | add | 0 | district | 1 |
| `land.distressedShareMult` | §5 | mul | 1 | district | 5 |
| `land.titleDefectRateMult` | §5 | mul | tuning `land.titleDefectRateMult` | district | 5 |
| `land.stakeConflictMult` | §5 | mul | 1 | district | 2 |
| `permits.reviewTimeMult` | §6 | mul | tuning (P2 key) | district, regime, claim | 2 |
| `permits.inspectionRateMult`, `permits.complaintRateMult`, `permits.detectionMult`, `permits.exceedanceMult`, `permits.maxWaterGpmMult`, `permits.agencyWorkloadMult`, `permits.bondRateMult` | §6 | mul | 1 | district, claim / regime | 2 |
| `permits.feeAdd.maintenance` | §6 | add [0, 300] | 0 | regime | 2 |
| `permits.noticeMaxAcresSet` | §6 | set [0, 160] | baseKey `permits.noticeMaxAcres` | regime | 2 |
| `permits.yukon.securityFracMult` | §6 | mul | 1 | regime | 6 |
| `ops.hoursMult` | §7 | mul, set | 1 | district, claim | 1 |
| `ops.productivityMult`, `ops.plantCapacityMult`, `ops.thawMult`, `ops.recoveryLossExpMult` | §7 | mul | 1 | district, claim | 1 (s07#14) |
| `ops.haulCycleMult`, `ops.campCostMult`, `ops.campCapacityMult` | §7 | mul | 1 | claim | 1 |
| `ops.waterAvailableMult`, `ops.waterTruckCostMult` | §7 (read also by §3) | mul | 1 | district, claim | 1 |
| `ops.fuelAdderMult` | §7 | mul [1, 4] | 1 | district, claim | 1 |
| `ops.blockLocked` | §7 | set {0, 1} | 0 | claim, block | 1 |
| `ops.fuelSupplyFrac` | §7 | set | 1 | district, claim | 3 |
| `ops.freezeDamageProbMult` | §7 | mul | 1 | district | 3 |
| `ops.highGradeProbMult` | §7 | mul | 1 | company, claim | 5 |
| `staff.wageAskMult`, `staff.poolSizeMult` | §8 | mul | tuning (difficulty) | district | 1 |
| `staff.crewAvailableFrac` | §8 | set | 1 | company, claim | 1 |
| `staff.quitHazardMult` | §8 | mul | tuning (difficulty) | district, claim, employee | 1 |
| `staff.moraleTargetAdd` | §8 | add [−10, 10] | 0 | district, claim, employee | 1 |
| `staff.injuryHazardMult` | §8 | mul | 1 | claim | 2 |
| `fleet.rateMult`, `fleet.fuelBurnMult` | §9 | mul | 1 | district, claim, machine, model, brand | 1 |
| `fleet.transportCostMult`, `fleet.usedPriceMult` | §9 | mul | 1 | district | 1 |
| `fleet.newLeadAddWeeks` | §9 | add | 0 | company, brand | 1 |
| `fleet.machineGrounded` | §9 | set {0, 1} | 0 | model, machine | 3 |
| `fleet.failureHazardMult` | §9 | mul | tuning `fleet.failureHazardMult` (P3 key) | model, machine | 3 |
| `fleet.partsLeadTimeMult` | §9 | mul | 1 | company, brand, claim | 3 |
| `fleet.partsPriceMult` | §9 | mul | 1 | company, brand | 3 |
| `fleet.wearMult`, `fleet.fieldServiceDelayMult`, `fleet.auctionSupplyMult`, `fleet.rentalAvailMult` | §9 | mul | 1 | district / machine | 3 |
| `market.localBuyerDiscountAdd` | §10 | add [−0.05, 0.15] | 0 | company, district, claim | 1 |
| `market.theftHazardMult`, `market.shippingCostMult`, `market.localBuyerCapMult` | §10 | mul | 1 | district | 5 |
| `market.refineryTransitWeeksAdd` | §10 | add | 0 | company | 5 |
| `finance.lenderSpreadAdd`, `finance.lenderMaxLtvAdd`, `finance.lenderAppetiteShift` | §11 | add | 0 | lender, company | 4 |
| `finance.lineLimitMult`, `finance.insurancePremiumMult`, `finance.vendor.limitMult` | §11 | mul | 1 | lender / company | 4 |
| `finance.wageLienSweep` | §11 | set {0, 1} | 0 | company | 4 |

§14's `hardrock.*` rows join with §14 (P6). Bounds not shown use §2.10's defaults (mul [0, 5], add per unit, set any).

---

## 8. RNG streams and id prefixes

**No new stream names and no new id prefixes.** P1 uses registered streams only. Changes:

| Item | Kind | Class |
|---|---|---|
| `prospect` gains the key shape `(claimId, 'assay', n)`, `n = knowledge.assayCount[claimId]` (s04#4) | new key shape on a registered stream | **OWNER Q1** (default adopted) |
| `land-market` keyShape documented `turn, listingId`; `land-buyers` `turn, tenureId` (P4) (s05#27) | registry documentation | integrator |
| `staff-market` keyShape adds `'former', empId` (S08-5) | documentation (8.4 already fixes it) | integrator |
| `supply` `'init'` selection and per-candidate `(0, claimId)` draws (s03#1) | uses the registered shapes | integrator |
| Fixed draw orders: `seller (claimId, holderId)` s03#4; `site (turn, claimId)` s03#7; `land-list (listingId)` s05#8 (all draws taken, buy-down always); `staff-cand (candId)` S08-6; `market-buyers (districtId)` S10-14; `fleet-listing (listingId)` S09-5/S09-18; `weather-init (districtId)` s01#12 | owners document them in their DESIGN tables and add a stream-order test | integrator |
| `setup` sub-keys `'inheritor'`, `'pits'`, `('fleet', i)`, `'hand'` built only by §1 `inheritorStreams` (D-1.65) | existing | — |

Composite references (not minted): `'<listingId>/<tellKind>'` (found tells), `${claimId}/${lineId}` (plant lines).
`lst` stays shared: §5 mints claim listings before §9 mints equipment listings in N5/N6 and in step 3 (3.1 before 3.4).

---

## 9. Tuning keys

**Rule (contract).** Wave 0 adds (a) every key read outside its owning section, (b) every P1 difficulty-scaled key, (c)
every hook base key with consumer phase 1, (d) every key a ruling introduced, (e) every `game.*` P1 key (game.ts is
shared by §1, §2 and §13). Each owning package then adds the rest of its DESIGN table (the rows its P1 code reads; later
rows may ship early with DESIGN values) in its own namespace file and schema file. Every value goes into DESIGN's table
and `src/data/tuning/CHANGELOG.md` in the same commit; `TuningKey` is derived from `baseTuning`, so a cross-owner key
must exist before its reader compiles. Object-valued keys need a zod shape in `tests/data/schemas/tuning/<ns>.ts` (W0
splits today's `TUNING_KEY_SCHEMAS` into one file per namespace and composes them).

### 9.1 Keys Wave 0 adds

**`game.*`** (§1 1.20 and rulings; §13 13.25 for `game.alerts.*`)

| Key | Value |
|---|---|
| `game.season.northernInterior.{breakupMean, breakupSd, breakupMin, breakupMax, breakupDurMean, breakupDurSd, freezeMean, freezeSd, freezeMin, freezeMax, freezeDurMean, freezeDurSd, minOperatingWeeks, maxOperatingWeeks}` | 18.5, 1.0, 16, 22, 1.4, 0.6, 42.0, 1.4, 38, 46, 2.0, 0.6, 17, 27 |
| `game.season.aridDesert.{monsoonStartMean, monsoonStartSd, monsoonStartMin, monsoonStartMax, monsoonEndMean, monsoonEndSd, monsoonEndMin, monsoonEndMax}` (s01#3) | 27, 1.2, 24, 30, 38, 1.5, 35, 41 |
| `game.season.sigmaMult` / `game.season.freezeUpMeanShift` / `game.season.expectedActiveWeeks.aridDesert` | 1.0 / 0 / 46 |
| `game.weather.{tempPersistence, moistPersistence, wetnessWeight, wetnessYearPersistence, flowPersistence, flowPrecipGain, flowAnomSens, flowWetnessSens, droughtDecay}` | 0.55, 0.5, 0.4, 0.4, 0.75, 0.25, 0.30, 0.20, 0.8 |
| `game.weather.stormSpike` | `{ northernInterior: 1.6, temperateMountain: 1.8, aridDesert: 4.0 }` |
| `game.weather.fireLevelThresholds` | `[0.40, 0.60, 0.75, 0.92]` |
| `game.weather.fireSeasonFactor` (s01#4; replaces `game.weather.aridFireFactor`) | `{ <template>: 12 monthly F_m values }` copied from §1 1.5.1 |
| `game.access.{winterTrailOpenWeek, winterTrailCloseLeadWeeks, winterTrailFreezeLagWeeks, aridWashoutWeeks}` | 2, 5, 8, 1 |
| `game.entity.{soleProp, llc, corp}.formationUsd` / `.annualUsd` | 0 / 1,200 / 2,500 · 0 / 550 / 850 |
| `game.owner.deskDaysOffice` / `deskDaysField` | 5 / 2.5 |
| `game.ownerLoanRate` / `game.ownerReasonableSalaryCapUsd` | 0.06 / 150,000 |
| `game.start.backed.ownerCapitalUsd` / `.personalCashUsd`; `game.start.inheritor.companyCashUsd` / `.personalCashUsd` | 200,000 / 50,000; 300,000 / 40,000 |
| `game.start.{bootstrapper, backed, inheritor}.personalCreditScore` | 760, 720, 680 |
| `game.start.{bootstrapper, backed, inheritor}.reputation` | 45, 50, 55 |
| `game.start.regulatorStandingStart` / `game.inheritor.regulatorStandingStart` | 60 / 55 |
| `game.investor.{equityContributionUsd, equityPct, prefRate, royaltyContributionUsd, royaltyRate, royaltyPaybackMultiple, royaltyTailRate, royaltyMinimumUsd, approvalThresholdUsd}` | 1,300,000, 0.40, 0.08, 900,000, 0.10, 2.0, 0.03, 100,000, 100,000 |
| `game.inheritorTierWeights` / `game.inheritorDepletionAdd` / `game.inheritorDebtMult` | `{ excellent: 0.07, good: 0.30, marginal: 0.38, uneconomic: 0.25 }` / 0.10 / 1.0 |
| `game.inheritor.{preStrippedBlocks, noteSchedule, notePrincipalUsd, noteRate, noteTermMonths, notePayMonths, fuelApUsd, fuelApDueWeek, estateAppraisalUsd, formerHandAskUsdPerHr, planHeadroomAcres}` | 2, `'seasonal'`, 320,000, 0.085, 84, `[6, 7, 8, 9, 10, 11]`, 12,000, 4, 120,000, 34, 5 |
| `game.reputation.{decayPerWeek, sponsorUsdPerPoint, sponsorCapPerYear, sponsorMinUsd}` | 0.005, 5,000, 2, 2,500 |
| `game.reputation.delta` (§1 1.12 as data: `{ [kind]: { delta; cap?: { amount; period: 'week' \| 'month' \| 'year' } } }`) | every 1.12 row: `missedPayroll` −8 (1/wk), `partialPayroll` −4 (1/wk), `seasonProduction` +3 and `recordYear` +2 (1/yr), `royaltyPaidInFull` +0.5 (+3/yr), `missedAdvanceRoyalty` −5, `leaseTerminatedDefault` −8, `dealClosed` +1 (+3/yr), `acceptedThenFailed` −5, `lowballWalk` −0.5, `firings3InWeek` −2, `bonusesPaidInFull` +1, `bonusCutMidSeason` −1, `layoffWithoutProRata` −1 (−3/yr), `sponsorship` +1 (+2/yr), and the P2+ rows (vendor, loan, reorganization, reclamation, injury, violation, §12) with their 1.12 values |
| `game.scoreMult` | 1.0 |
| `game.endReport.timelineMinUsd` / `game.endReport.timelineMaxEntries` (s01#20) | 50,000 / 200 |
| `game.alerts.{dedupeWindowWeeks, obligationInfoWeeks, obligationWarnWeeks, obligationCriticalWeeks, moraleWarnAvg, moraleWarnKey}` | 4, 8, 4, 1, 40, 30 |

**Other namespaces** (cross-owner, difficulty, hook-base and ruling keys only)

| Key | Value | Why W0 |
|---|---|---|
| `ops.goldRoomDirtFrac.noTable` / `.table` | 0.04 / 0.02 | read by §4, §10 |
| `ops.noForemanEfficiency` / `ops.p1MechAvailability` | 0.92 / 0.92 | §1 text, bots, fixtures |
| `ops.heat.{thresholdF, slopePerF, floor, nightMult}` (s07#18) | 80, 0.03, 0.55, 0.95 | §1 `weatherHoursMult` |
| `ops.fireLevelHoursMult` / `ops.fireLevel3DayShiftMaxHours` (s07#18; missing levels = 1) | `{ 1: 0.97, 2: 0.97, 4: 0 }` / 8 | §1 `weatherHoursMult`, `shiftHoursCap` |
| `staff.{ownerOpsSkillByBackground, ownerMechanicSkill, ownerShopHoursPerWeek, ownerInspectionsPerWeek, ownerLandSpecialistSkill, ownerSafety}` | `{ operator: 85, default: 40 }`, 85, 50, 2, 80, 60 | `ownerSkill` (W0 real) |
| `staff.{foremanMaxLines, smallCrewMaxNoForeman, noForemanIncidentMult, crewPerCook}` | 2, 3, 1.15, 12 | §1, §7 editor, bots |
| `staff.{poolSizeMult, wageAskMult, quitHazardMult, resumeBiasMult}` | 1.0 each | difficulty + hook base |
| `staff.safetyRecord.start` / `staff.absence.base` | 50 / 0.02 | §1 slice init / fixture override (S08-21) |
| `fleet.p1MaintUsdPerHr` (9.15: ex20 24 · ex30 33 · dz6 40 · dz8 78 · ld950 25 · ld966 33 · adt30 38 · grz40 5 · tr50 11 · tr75 15 · tr150 28 · dw20 6 · jigS 3 · cenM 6 · pmp6 4 · gen100 3) | table | §4 previews; the §9 package adds the phase-3 fixture models (S09-1) |
| `fleet.toolRentUsdPerDay` | `{ rocker: 25, drywasherHand: 40, testPlant: 150 }` | §4 |
| `fleet.p1GradeRateMult` / `p1GradeMaintMult` / `p1GradePriceMult` | A 1/1/1.20 · B .96/1.15/1.05 · C .91/1.25/.90 · D .85/1.60/.70 | §1 preview, bots |
| `fleet.p1InHouseMaintMult` / `p1OwnerShopMaintMult` / `p1DealerCashShare` | 0.70 / 0.70 / 0.80 | §1, §11 counter moves |
| `land.askMarkup` / `land.leaseCureWeeks` | 0.30 / 4 | difficulty |
| `land.quickSaleFrac` / `land.valCapitalChargePerBcy` / `land.p1LandmanPriceMult` / `land.p1LandmanRoyaltyPointsOff` | 0.6 / 4.00 / 0.925 / 0.01 | §11, §4, §1 |
| `permits.fed.{processingFeeUsd, locationFeeUsd, maintenanceFeePerUnitUsd, countyRecordingFeePerClaimUsd, transferFeePerClaimUsd, affidavitFeePerClaimUsd, recordingWindowWeeks, unitAcres}` (s05#27) | 25, 49, 200, 12, 15, 15, 13, 20 | §5 closings (county fee) |
| `finance.{p1InsolvencyGraceWeeks, distress.watchWeeks}` | 6 / 4 | difficulty; §13, bots |
| `finance.{p1PayrollTaxRate, p1WcRate, primeSpread, defaultOperatingTargetUsd}` | 0.14, 0.08, 0.030, 25,000 | §8 displays, §1 N9, slice init |
| `finance.{p1BankerLoanUsd, p1BankerLoanSpread, p1BankerLoanTermMonths}` (§0.6 item 2) | 150,000, 0.020, 60 | §1 N9 |
| `events.{frequencyMult, severityMult, budgetPerHalf, catastropheEarliestTurn, distressMercyMult}` | 1.0, 1.0, 24, 26, 0.6 | difficulty |

### 9.2 Difficulty rows Wave 0 adds (`src/data/difficulty.ts`, all `{ set }`, values of §1 1.11)

`game.season.sigmaMult` 0.8 / 1.0 / 1.2 · `game.season.freezeUpMeanShift` +0.5 / 0 / −0.5 · `game.inheritorDebtMult`
0.75 / 1.0 / 1.25 · `game.scoreMult` 0.75 / 1.00 / 1.35 · `land.askMarkup` 0.25 / 0.30 / 0.35 · `land.leaseCureWeeks`
6 / 4 / 3 · `staff.poolSizeMult` 1.3 / 1.0 / 0.75 · `staff.wageAskMult` 0.95 / 1.0 / 1.08 · `staff.quitHazardMult`
0.7 / 1.0 / 1.3 · `staff.resumeBiasMult` 0.6 / 1.0 / 1.3 · `finance.p1InsolvencyGraceWeeks` 8 / 6 / 4 ·
`finance.distress.watchWeeks` 6 / 4 / 3 · `events.frequencyMult` 0.6 / 1.0 / 1.4 · `events.severityMult` 0.7 / 1.0 / 1.3
· `events.budgetPerHalf` 16 / 24 / 34 · `events.catastropheEarliestTurn` 30 / 26 / 20 · `events.distressMercyMult`
0.4 / 0.6 / 0.8. Existing rows stay. Deferred (keys ship with their phase; the 1.11 test allows a row whose key does
not exist yet): `land.titleDefectRateMult`, `land.resMotivationDisc`, `land.negConcession`, `market.volMult`, `ai.*`
(P5); `fleet.privateLemonShare`, `fleet.failureHazardMult` (P3); `finance.paymentGraceWeeks`,
`defaultTimelineMult`, `covenantCureWeeks`, `covenantStrictnessMult`, `appetiteScoreShift`, `repoLagWeeks`,
`game.investor.penaltyMult` (P4); `permits.*` (P2); `hardrock.*` (P6).

### 9.3 Keys the owning packages add (with the shape decisions the rulings fixed)

| Namespace | Package adds | Fixed shapes and new keys |
|---|---|---|
| `geology.*` (§3) | §3 3.16 P1 rows not yet present | `geology.siteVisit.{driftDetectP 0.9, snowFindMult 0.4, permafrostIndicatorP 0.8, flowNoiseFrac 0.10, boulderNoiseSd 0.10}` (s03#7); `geology.water.aridSpringListingSigma` 0.30; prose constants as `geology.seller.*` and `geology.inheritor.*` (s03#16) |
| `geology.*` (§4) | §4 4.20 P1 rows not yet present | `geology.method.<methodId>.<field>` for P1 cost and rate fields (s04#11); `geology.pilePrior.{logSd 0.7, volumeFrac 0.30}` (s04#3); `geology.sample.activeLayerFt` stays §3's (s04#12) |
| `land.*` | §5 5.19 P1 rows | one key per value; the P5 site-sampling probability gets its own key read behind `rulesAtLeast(5)` |
| `ops.*` | every §7 7.21 row | split formula rows per s07#18 (`ops.freezeupPlantMult` 0.6 and `ops.freezeupPlantMultByBand` P5; `ops.nightLightFreeWeeksNorth` `[22, 30]`); `ops.cementationStripSlope` 0.5 (s07#19); nested tables as readonly objects |
| `staff.*` | §8 8.18 rows (keys written there without the prefix) | `staff.p1RecallProb` 0.75 inside `staff.rehire.*`; S08 keys |
| `fleet.*` | §9 9.15 P1 rows | S09-8: `p1GradeShares`, `p1GradeAgeYears`, `p1UsedListingLifeWeeks` 6, `p1UsedArrivalsPerWeek` 1, `lightPlantHoursMult` 0.6, `listingSizeWeights`, `newOrderHoldWeeks` 4, `depositRefundWeeks` 2, `p1DealerUsedAgeYears`, `p1UsedRipperShare` 0.5; `ripperUsd` 35,000 (S09-5) |
| `market.*` | §10 10.19 P1 rows | `market.localBuyer.{discount, smallLotOz, smallLotAdd, midLotOz, midLotAdd, remoteAdd, repHighAdj, repLowAdj, biasMean, biasSd, claimErrSd, errLo, errHi}` + `repHighMin` 70, `repLowMax` 30 (S10-11); `market.retention.{terminalWeeks 104, sliceBudgetKb 200}` |
| `finance.*` | §11 11.25 P1 rows (`ledger.detailWeeks` 52, `payroll.registerWeeks` 13) | — |
| `events.*` | §12 12.22 framework rows | shapes for `events.severityPoints`, `events.categoryCooldownWeeks` |
| `permits.*` | nothing else in P1 | — |

---

## 10. Data files

Wave 0 creates each file with its exported type, an empty (or placeholder, marked) value and its zod schema in
`tests/data/schemas.ts`; the named package fills it.

| File | Content | Package |
|---|---|---|
| `src/data/calendar.ts` | §1 1.3 key dates, 1.4.4 forecast issue weeks and variances, 1.5.1 climatology for `northernInterior` and `aridDesert` (Tclim, sdT, precip mix by month, monsoon row, H, storm spike, scores, band edges); no F_m (it is tuning, s01#4) | §1 climate |
| `src/data/scenarios/inheritor.ts` | `InheritedFleetSpec` (eight items with model, age, hours, options; S09-6), the former hand's spec | §1 company (with §9) |
| `src/data/equipment/models.ts`, `packages.ts`, `classes.ts`, `brands.ts` | 21 P1 rows (18 machines + 3 tools) + phase-3 fixture rows (`ex45`, `dz9`, `ld980`, `adt40`, `tr300`, `cenL`, `pmp10`, `gen300`, `campM25`, the `pkg300` items; S09-1, S09-2); 12 classes; 9 brands with `p1DefaultBrandId` per model (S09-18); transport data per S09-22 | §9 |
| `src/data/staff/roles.ts`, `classMap.ts`, `crossRole.ts`, `names.ts` | role catalog (P1 flag, exempt, field/office, pay kind, wcClass, `Role` order), the role ↔ assignment table (S08-17), §9 class → `OpClass` map, cross-role cover, name lists | §8 |
| `src/data/market/buyers.ts` | local-buyer name pool | §10 |
| `src/data/prospecting/contractors.ts` | one pitting contractor per region (P1) | §4 |
| `src/data/finance/lenders.ts` | two display rows (the estate note's family bank, the banker stub's community bank) | §11 |
| `src/data/balance/fixtures.ts` | the BALANCE §2.1 `FixtureSpec` rows (`starterNorth`, `refSmallNorth` (+`Royalty`, +`Debt`), `matureNorth`, `starterArid` (+`WellOnly`, +`Well300`), `inheritorNorth`) | sim fixtures |
| `src/data/events/catalog.ts`, `preps.ts`; `src/data/text/events.ts` | empty in P1 | §12 |
| `src/data/text/alerts.ts`, `decisions.ts`, `glossary.ts`, `tutorial.ts`; additions to `ui.ts` | alert and decision templates for every P1 kind and decision; tutorial steps; every P1 error and warning code's reason text (T21, T24) | UI foundation |

The contractor list is filled by init part N8b `knowledge.initContractors` (§1.5).

---

## 11. Simulator-facing contract

1. **Observer wiring** (`sim/metrics/observe.ts`, Wave 0, to the stub selectors so P1 runs never throw
   `ObservationNotWiredError`): `fineOz` ← snapshot `fineOzRecovered`; `claimsHeld` ← `select.controlledClaimCount`;
   `fleetWashBcyHr` ← `select.fleetWashCapacityBcyHr`; `distressFleetSale` ← `select.distressFleetSale(state, turn)`;
   `unsoldGoldValueCents` ← `select.heldGoldValue(state).expectedNetCents`; `heldClaims` ← `select.tenures`; net income ←
   `select.periodNetIncome`; O-08 and M-CLAIMPROFIT inputs ← `select.spendByCategory`, `select.machinesOnClaim`
   (s02#14); distress ← `select.distressStatus` (s02#18).
2. **Start NW** = `select.netWorth(newGame(...), 'scoring')` before any action (s02#15); delete the tuning table in
   `sim/metrics/startNetWorth.ts`; a test checks `previewStart` against it.
3. **BotView** gains read-only access to the P1 selectors bots need (listings view, tenures, `knownEstimate` for at most
   `geology.maxTrackedClaimsSim` claims, fleet and equipment listings, roster and candidates, lots and quotes,
   `forecast13Week`, `distressStatus`, `seasonView` per district, `select.tuning`, `effective`); never a state field.
4. **Scramblers** (D-2.58, S13-12): `sim/bots/scramblers/{s01,s03,s04,s05,s07,s08,s10}.ts`, composed in
   `sim/bots/scramble.ts`; plus `scrambleReportHidden(report, seed)` for retained `WeekReport`s. W0 creates them as
   identity functions with the marker; `s03` wraps the existing `scrambleWorldTruth`.
5. **Fixtures:** `npm run sim -- --fixture <id>` builds the game with `newFixtureGame(spec, seedBase)` and runs the
   scripted runner in `sim/fixtures/<id>.ts`; fixtures run with staff noise off through `spec.tuningOverrides` (S08-21).
6. **Bots:** `BOT_VERSION '1.0'` is the first P1 definition (S08-21 cooks, S09-24 fleet tiers, s04#16 cautious
   sequence); `--bot-variant r6` is sim-only, recorded as `'1.0+r6'`, never a baseline (s02#16).

---

## 12. Wave 0 conformance tests (added under `tests/contracts/`)

| Test | Checks |
|---|---|
| `parts.test.ts` | `PIPELINE_PARTS` sorted by `(step, order)` equals §3's table (ids, sections, `fromPhase`); every part id unique; init parts equal §1.5's order |
| `actions.test.ts` | every §5 type registered once, under its owner's section, with §5's R/C flags and `fromPhase`; every code a validator can return is in the folder's `errors.ts`; every `ActionErrorCode` and `ActionWarningCode` has UI text |
| `stubs.test.ts` | `CONTRACT-STUB` markers and `stubbedActionTypes()` ⊆ `stubAllowlist.ts` (§0.2) |
| `composition.test.ts` | no selector or explainer name in two folders; every explainer callable on a fresh P1 state |
| `hooks.test.ts` | registry = union of owners' `hooks.ts`; ops and bounds; `base: 'tuning'` keys exist when `consumerPhase ≤ BUILD_RULES_PHASE` |
| `slices.test.ts` | every slice of §2 present with its initial value; every `Record` + `…Ids` pair mirrored; no `undefined` property |
| `alerts.test.ts` | `ALERT_KINDS` ⊇ §6's P1 kinds; every kind has a taxonomy row and (from the UI foundation package) a template |
| `tuning.test.ts` (extended) | §9.1 keys present with their values; difficulty rows of §9.2; per-namespace schema files cover every object-valued key |
| `scramble.test.ts` | every scrambler registered; each changes only fields its owner marks hidden (W0: identities pass trivially) |
| goldens | `p0-passive-52w` regenerated under `rulesPhase: 0`; new `p1-passive-52w` under `rulesPhase: 1`; Node ≡ Chromium e2e unchanged |
| saves | v2 round trip identical hash; a v1 file fails `SAVE_TOO_OLD` |

---

## 13. Integrator notes

- **Stub-to-real dependencies of the vertical slice** (lease a claim → buy a fleet → hire → mine → clean up → sell →
  ledger; T-06 `refSmallNorth`): real bodies needed in §5 (`createListings`, `land/acceptAsk`, `createTenure`,
  `samplingAccess`, `settleProductionInterests`), §9 (catalog data, `fleet/buy`, transports, `machineEffectiveRate`,
  `fuelBurnGalHr`, `campSummary`, availability, meters, shop), §8 (pools, `staff/hire`, availability, `foremanFor`,
  `prospectiveSupervisorKind`, payroll), §7 (plan, site, flow, cleanup functions), §10 (`addLot`, standing orders,
  `gold/sellLocal`), §11 (settlement in 14.1, `createLoan` for fixtures, counter), §1 climate (phase, weather, access),
  §3 (`claimAccess`, `waterAvailableGpm`), and the fixture builders of §1.6. §4 can stay stubbed for T-06 (the fixture
  runs with the owner's estimate absent: `defaultMinePlan` on `null` estimates must use the claim prior, s07#16).
- **Loud failures by design:** creation stubs throw `ContractStubError`; the first package to call another's creation
  function before it lands sees the failure in its tests and either waits for the merge or tests through a fixture.
- **Rulings that change DESIGN text** must be written into the owning section in the same commit as the code
  (CLAUDE.md rule 3); this contract's §0.6 choices are recorded as D-x.n by the integrator.
- **OWNER questions raised here:** Q1 (assay key shape, default adopted), Q2 (OQ-3.4 lever, calibration only). Everything
  else in this contract is integrator-class.
