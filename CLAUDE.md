# CLAUDE.md — Gold Mining Tycoon

Single-player browser business simulation: the player founds and runs a small **placer gold mining company** as its Owner. Weekly turns, owner-level decisions, no equipment-driving. The simulation resolves what the crew produced, what broke, what it cost, and what the gold was worth. Target: depth and realism (thin margins, big capital bets, incomplete information about the ground, cash flow that can kill a profitable operation).

**Source documents (read before any work):**

| File | What it is | Authority |
|---|---|---|
| `docs/BRIEF.md` | The owner's original brief, verbatim | Source requirements |
| `DESIGN.md` | Full game design: §0 open questions, §1–§14 systems (rules, formulas, data shapes, tuning tables, phase plans, tests, decisions), §15 decision index. §2 is the technical contract | How the game works. Implement what it says; change it before changing behavior |
| `BALANCE.md` | Economic targets (`T-xx`, `O-xx`), metric definitions, bot rules, simulator protocol, per-phase gating (§7) | Tuning acceptance criteria. Owns no tuning values |
| `CLAUDE.md` | This file: conventions, commands, architecture rules, phase plan | How we build |
| `CHANGELOG.md` | One entry per phase (and per notable change) | History |
| `src/data/tuning/CHANGELOG.md` | Every tuning or bot change: date, key, old → new, owner §, target ID, before → after, SHA | Tuning history |

## Current status

- **Phase:** Phase 1 (Core loop) in progress since 2026-10-06. Phase 0 was reviewed and approved on 2026-10-06 (DESIGN §0 rulings 0.13–0.17: D-4.47's calibration cells confirmed; P0's one estimator miss accepted and carried to P1 as OQ-4.3; the full estimator calibration caps claims per world at 2 per cell from P1; D-14.41 confirmed; BALANCE T-01 (a) aligned with §3.18 at p90 ≤ 0.045). If a new expensive-to-reverse question arises, add it to DESIGN §0 and implement its stated default until the owner answers.
- **P0 result:** 1,119 unit and property tests and 20 e2e tests green; advanceWeek 0.43 ms mean per simulated week (stub pipeline); §3 world calibration and §4 estimator calibration as in `docs/balance/phase-0.md`.
- **Carried into P1:** OQ-4.3 (arid recent-operator over-coverage; drift removal mismatch), OQ-3.4 (hand-cut parcels that work no block), the estimator's incremental path (§4.19; the estimator is ≈ 10× over its §2.13 time budget without it), BALANCE T-01 (b) arid at its 40% line.
- Update this block at the end of every phase (phase, date, sim headline numbers, known gaps).

## Working rules

1. **Phases are sequential, with an owner review between them.** A phase is done only when it passes the phase-exit gate below. Then stop: report to the owner and do not start the next phase until the owner has reviewed this one and said to go on.
2. **Ask before expensive-to-reverse decisions:** state shape changes that break saves without a migration, pipeline steps or their order, RNG stream names or key shapes, money/gold/units representation, removing a system, changing a scenario's win condition, changing a BALANCE band. Otherwise decide, record it in the owning DESIGN section's *Decisions* (`D-<section>.<n>` — decision — rationale; §15 indexes it), and keep moving.
3. **Design first, then code.** Each concept has one owning section; other sections refer to it. If implementation shows the design is wrong or incomplete, update the owning section in the same change as the code. Code and design must not drift.
4. **Content and tuning live in `src/data/`**, never in logic. A number a designer might change belongs in a tuning file under the key named in the owning section's *Tuning* table; change the value in both places in one commit.
5. **Never skip, disable, or weaken a test to get green.** Fix the code or, if the rule changed, change the test and the design together.
6. **Never retune by changing a bot.** Bots are frozen within a phase; a bot change bumps `BOT_VERSION`, is logged in the tuning changelog, and needs a fresh baseline.
7. **No model names or AI identifiers** in code, comments, commits, or docs.
8. **No deployment setup until the owner asks.** The game runs locally (`npm run dev` / `preview`); add no hosting, deploy targets, domains or deploy CI. The UI calls no network service: fonts, icons and textures ship in the build.

## Commands

> All of these exist from Phase 0.

| Command | Does |
|---|---|
| `npm install` | Install dependencies (Node ≥ 22) |
| `npm run dev` / `build` / `preview` | Vite dev server / typecheck + production build to `dist/` / serve the build |
| `npm test` | Vitest, all projects, once (includes golden replays and data validation) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:engine` | Engine, data and sim tests only (fast; no DOM) |
| `npm run test:e2e` | Playwright: explain-coverage crawler, axe-core accessibility, keyboard path, Node-vs-Chromium replay hash |
| `npm run test:perf` | DESIGN §2.13 time and year-10 save-size budgets on fixed fixtures (separate CI job; a miss fails it, not the unit suite) |
| `npm run lint` / `typecheck` / `format` | ESLint (incl. engine purity and determinism rules) / `tsc --noEmit` / Prettier write |
| `npm run check` | lint + typecheck + test — **must pass before every commit** |
| `npm run sim -- [opts]` | Headless simulator (below) |
| `npm run sim:balance -- [--phase N] [--quick]` | BALANCE §6 matrix for the phase: scorecard, JSON/CSV, baseline comparison; exits non-zero on any new FAIL |
| `npm run replay -- <log.json>` | Replays an action log and prints per-week state hashes |
| `npm run goldens:update` | Regenerates golden replay hashes (only for intentional rule changes; same commit, note in `CHANGELOG.md`) |

Simulator (DESIGN §2.12, BALANCE §6):

```
npm run sim -- --strategy <botId> [--games N] [--start <bootstrapper|backedEquity|backedRoyalty|inheritor>] [--years Y]
               [--difficulty <easy|standard|hard>] [--background <none|operator|mechanic|geologist|banker|landman>]
               [--entity <soleProp|llc|corp>] [--seed-base S] [--rules p0..p6] [--tuning overrides.json] [--workers N] [--out dir]
npm run sim -- --fixture <id> [--breakeven] | --world-only [--econ <fixtureId>] [--calendar] | --market-only | --events-only  [common flags]
```

- Defaults: `--games 500`, `--years 5`, `standard`, `bootstrapper`, background `none` (simulator-only, no edge), entity `llc`, `--rules` = the build's phase, `--seed-base` from `src/data/balance/seeds.json`, workers = CPU cores (forked child processes with `--import tsx`; `--workers 1` runs in-process). There is no default bot: a bot run needs `--strategy`, and the modes take none. `--seeds N` (used in DESIGN §10.21) is an alias of `--games N`. Game *i* uses seed `seedBase + i`; output is identical for any worker count. A Y-year game ends after the pipeline of turn 52Y − 1 (DESIGN D-2.52). Exit codes: 0 done, 1 bot defect or failed run, 2 usage error or "available from Pn" (D-2.51).
- Bot ids (§2.12.1): `cautious`, `balanced`, `aggressive`, `undercap` (Bootstrapper only); test bots `noTest`, `heavyProspector`, `leaseOnly`, `buyOnly`, `gradeDFleet`, `gradeAFleet`, `maxHours`, `noStripAhead`, `passive` (P1); `exceeder`, `abandoner` (P2); `noMaintenance`, `auctionOnlyFleet`, `newOnlyFleet`, `rentOnlyFleet`, `brandOnly(brandId)` (P3); `allHardMoney`, `royaltyEveryWinter` (P4); `hedge50`, `noHedge`, `alwaysLocalBuyer` (P5); `hardrockSeeker` (P6); option bots `smallCrewNoForeman` (P1), `multiLine`, `poolMechanics` (P3). Every other bot keeps one plant line, a foreman on every claim and site mechanics (D-2.32). Fixture ids are BALANCE §2's (`starterNorth`, `refSmallNorth`, `matureNorth`, `starterArid`, `inheritorNorth` and variants).
- Outputs go to `out/` (gitignored); `sim:balance` writes `out/balance/<phase>/<sha>/{summary.json,games.csv,weekly-sample.csv}`. Every output records git SHA, `tuningHash`, `BOT_VERSION` and `seedBase`. `--quick` (100 games per cell) is for development, never for sign-off.

## Tech stack

TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · React 19 · Vite (module worker for multi-week runs) · Zustand · Recharts · TanStack Table + Virtual · Tailwind CSS (two-theme tokens, Daylight and Lamplight, DESIGN §13.20) · self-hosted Besley and Inter WOFF2 fonts (SIL OFL; no runtime font service) · Immer (engine reducers) · zod (data validation) · Vitest + fast-check · Testing Library + jsdom · Playwright + axe-core · `idb-keyval` (IndexedDB) · ESLint (flat config) + Prettier · tsx for Node scripts.

## Repository layout

```
docs/                 BRIEF.md; research/ (R1–R5 fact sheets DESIGN cites); prototypes/ (design-time models behind cited numbers;
                      port into sim/ in P0); balance/phase-N.md reports and baseline-phase-N.json (committed at each phase exit)
src/
  engine/             PURE TypeScript simulation. No DOM, no Node APIs, no React.
    core/             rng.ts, streams.ts (stream registry), dmath.ts, money.ts (Cents, MilliOz), ids.ts (prefix registry,
                      compareIds), iter.ts (sorted-key helpers), memo.ts, calendar.ts, calc.ts (CalcNode),
                      effective.ts (effective(), EffectModifier), hash.ts (canonical-JSON state hash), assert.ts
    state/            GameState frame and slice types, newGame(), rulesAtLeast()
    systems/          one folder per owner (DESIGN section): climate/ company/ investors/ (§1) world/ (§3) knowledge/ (§4)
                      land/ negotiation/ (§5; resolveOffer, reused by fleet/ and finance/) permits/ (§6) ops/ (§7)
                      staff/ (§8) fleet/ (§9) gold/ (§10) finance/ (§11) events/ competitors/ (§12)
                      inbox/ (§13 alert collation and stops) history/ (§2) hardrock/ (§14, P6 optional)
    actions/          Action union and registry (reveals/commits flags), validators, handlers (one file per family)
    turn/             advanceWeek steps 0–16 (one file per step, DESIGN §2.6), runToNextDecision, evaluateStops
    explain/          explainers: (state, args) → CalcNode
    select/           selectors (pure derived views; never read hidden fields)
    save/             schema versions, migrations, serialize/deserialize
    index.ts          the only public engine surface
  data/               Typed content & tuning (pure data, zod-validated in tests)
    tuning/           one file per namespace (geology.ts … hardrock.ts); ui.ts (outside TuningResolved); CHANGELOG.md
    difficulty.ts calendar.ts regions/ prospecting/ equipment/ staff/ permits/ market/ finance/ events/ scenarios/ text/
    balance/          seeds.json, fixtures.ts (BALANCE reference fixtures; read by sim/ only)
  ui/                 React app: app/ store/ engine/ (engine client, run worker) explain/ format/ components/ charts/ screens/ tutorial/
  persistence/        IndexedDB slots, autosave rotation, gzip export/import (browser-only, engine-free behind an injected SaveCodec;
                      the UiPersisted shape and its migration live in ui/store/persisted.ts, D-13.74)
sim/                  Node-only: cli.ts, runner.ts (worker pool), bots/ (catalog.ts, shared helpers), fixtures/ (scripted runners), balance/ (matrix, scorecard), report.ts
tests/                Cross-cutting: golden/ replays, property tests, data validation, scenarios, perf/, e2e/
```

Unit tests are colocated (`foo.ts` → `foo.test.ts`). A system folder exposes `types.ts`, its pipeline step parts, its action handlers, its selectors and its explainers. Do not add a system folder that no DESIGN section owns, and add none unless it is needed: bankruptcy reorganization lives in `finance/`, plant lines in `ops/`, small crews and shop modes in `staff/` and `fleet/`.

## Architecture rules (non-negotiable)

**Engine purity**
- `engine/` imports only `engine/` and `data/`; `data/` imports only `data/` and engine types (`import type`). No React, `window`, `document`, `indexedDB`, `fetch`, `Date`, `performance`, `setTimeout`, `process`, `fs`, `Intl`, `localeCompare`, `toLocaleString`, `Math.random`. ESLint enforces it; a test scans the import graph.
- Public surface is `src/engine/index.ts`: `newGame`, `applyAction`, `validateAction`, `canAdvance`, `advanceWeek`, `runToNextDecision`, `evaluateStops`, `defaultStopRules`, `effective`, `select`, `explain`, save helpers. UI, bots and tests use only this.
- State is plain serializable data (no classes, Maps, Sets, Dates, functions, or `undefined`-vs-missing ambiguity). Collections are `Record<Id, T>`; an optional sorted `…Ids` array must equal the sorted key set.
- Reducers are pure; use Immer `produce` (auto-freeze on in dev and tests, off in the simulator). Never mutate input state.
- Memo caches live only in `engine/core/memo.ts` (module scope, never in state, never saved or hashed); the key covers everything the value depends on, and a cold cache never changes a result.

**Determinism** (same seed + setup + action log ⇒ byte-identical state and reports, in Node and every evergreen browser)
- Randomness only via `rng(seed, streamName, ...keys)`; key parts are strings or safe integers. Every stream is registered in `engine/core/streams.ts` with one owning section (lowercase, hyphenated, the system's prefix: `fleet-fail`, `permits-app`). Only the owner draws on it; others call the owner's function.
- Weekly draws key on `turn`; generation draws on entity ids; action-time draws on the subject plus a per-subject counter stored in state, never `clock.actionSeq`. The `action` stream is for flavor text only. Take every documented draw in its fixed order, even when unused, so retuning a probability never shifts later draws.
- Transcendental math only via `engine/core/dmath.ts`; `Math.exp/log/pow/sin/cos/tan/atan/…` are lint errors in the engine. `Math.sqrt/floor/ceil/round/abs/min/max` are fine.
- Iterate Records only through `engine/core/iter.ts` (`sortedKeys/Values/Entries`; ids in `compareIds` order). `Object.keys/values/entries`, `for…in`, and Map/Set iteration are lint errors in the engine.
- The weekly pipeline (DESIGN §2.6, steps 0–16 with each step's section sub-order) is fixed; entities run in ascending id order. Step 0 increments `turn`, so a pipeline runs *as* the new week; the player's last chance before a deadline at turn d is turn d − 1. Changing the order is an expensive decision: ask first.
- Obligation timing (§2.6, §6 6.9): a **statutory** obligation unsatisfied at the end of step 13 of `dueTurn + graceWeeks` takes its consequence (cash arriving in step 14 cannot save it); a **billable** one is billed and paid in step 14 and judged missed only at `dueTurn + graceWeeks + 1`.
- Phase rules are a runtime switch: `meta.rulesPhase`, read via `rulesAtLeast(state, n)`. When a later phase replaces a stub, keep the stub path behind the check so `--rules pN` still reproduces earlier phases.

**Units, money, IDs** (DESIGN §2.4)
- Money is **integer cents** in state (`Cents`). Compute in floats, round once at ledger posting with `roundCents` (half away from zero). Cash changes only through ledger postings.
- Gold has three kinds, never mixed: **metal oz** (in the ground: grades, estimates, box, losses), **weighed raw oz** (the scale: metal ÷ (1 − dirtFrac)), **fine oz** (weighed raw × `fineness`; `alloyFineness` is fine per metal oz). Gold that changes hands moves in integer milli-ounces (`MilliOz`); weighing floors to 0.001 oz. Every displayed ounce says raw or fine.
- Volume in **bank cubic yards** (`bcy`); loose yards (`lcy`) only in haul math and dump/void capacity. Grade in metal ("raw") oz per bcy. Area in acres; water in gpm and acre-feet. Hard rock (§14 only) in short tons and oz per st.
- Time is `turn` (turn 0 = year 1 week 1; 52-week years; calendar dates map via `weekOf`). Annual rates are decimals compounded weekly via dmath, except loans and cards (APR/12 per reporting month).
- IDs are `prefix_000123` from per-prefix counters; every prefix is registered in `engine/core/ids.ts` with one owner and a branded type; compare with `compareIds` (numeric-aware). `emp_owner` is the only non-counter id (composite references such as `clm_000042/L2` are built from ids, never minted); `lst` is one counter shared by §5 and §9.

**Hidden information**
- Hidden fields: true geology (placer and lode), component health, candidate and employee attributes, seller honesty, counterparties' reservation values and motivation, title defects, true fineness of unassayed lots, season drivers and unrevealed season dates, the price regime and fair value, news truthfulness, competitors' private state. Selectors, validators, bots, UI and `netWorth(state, 'scoring')` never read them; they see only the player's knowledge (estimates with ranges, inspection reports, résumés).
- Calc nodes built from hidden fields are tagged `hidden: true` where created, with a `knownAlt`. Tests: bots and every rendered screen give identical output under scrambled hidden state. The dev reveal is compiled out of production; the end-of-run reveal renders only when `runStatus ≠ 'active'`.

**Actions and validation**
- Every player decision is a serializable `Action` with a `type` discriminant (`family/verb`, e.g. `land/acceptAsk`), handled by `applyAction`. Actions carry intent, never derived numbers (no "price I saw").
- Every handler has a pure validator returning typed error codes (`PERMIT_REQUIRED`); the UI uses `validateAction` to disable controls with a reason.
- Actions resolve at once where the real world would (cash purchase, hire, local sale); anything that takes time creates a pending record the pipeline advances. The engine sets `undoable: false` when a handler drew from a stream, revealed hidden information, or committed to a counterparty.
- Blocking `PendingDecision`s stop the next `advanceWeek` (`canAdvance`); non-blocking ones carry a `defaultOptionId` applied at their deadline.

**Explainability**
- Formula functions return `{ value, calc }` where `calc` is a `CalcNode` tree built only when `explain` is on. The flag never changes state (hashes identical on and off). Dice-dependent results are explained from the `WeekReport`; pure derived values via `explain.*`. Calc nodes cite tuning keys, entity refs and RNG streams.

**Content and tuning**
- All catalogs, tables, and constants live in `src/data/` as `as const satisfies Schema`, zod-validated and cross-reference-checked in tests (models → brands/classes, event effects → hooks, difficulty keys ↔ §1 1.11, alert kinds → templates).
- Tuning keys are namespaced (`geology.*`, `ops.*`, `fleet.*`, `staff.*`, `land.*`, `permits.*`, `market.*`, `finance.*`, `events.*`, `ai.*`, `game.*`, `hardrock.*`) and match the DESIGN tuning tables. `ui.*`, `sim.*` and `save.*` are app configuration, outside `TuningResolved` and its hash.
- Tuning resolves once at `newGame` (base → difficulty `{ mul }`/`{ set }` → scenario → sim overrides); `meta.tuningHash` stores its hash and a game keeps its tuning until the player migrates. Systems read resolved tuning from the step context, never raw tuning files. Every value an event may change is a registered hook read through `effective(state, key, q)` from P1; reading a hook key raw is a lint error.

**Saves and budgets**
- `SaveFile` carries `schemaVersion`. Any breaking state change bumps it and adds a pure migration in `engine/save/migrations.ts` with a fixture test; from P1 on, never break loading of the previous version. `SaveFile.ui` holds presentation state outside `GameState`, never hashed.
- Every growing collection follows its owner's retention rule. Year-10 budgets: `GameState` ≤ 3,500 kB, `SaveFile` ≤ 4,000 kB uncompressed, per-slice limits in §2.13. Time: `advanceWeek` ≤ 3.5 ms mean in the simulator (explain off), ≤ 8 ms p95 for a mid-game week; UI week ≤ 20 ms engine + 50 ms render.

## Coding conventions

- Discriminated unions for variants; exhaustive `switch` with `assertNever`. No `any`; `unknown` + narrowing at boundaries.
- Small pure functions named for what they compute (`recoveryRate`, `amortizationSchedule`).
- Names carry units when ambiguous: state money ends in `Cents` (`cashCents`), tuning money in dollars ends in `Usd` (`companyCashUsd`), turns in `Turn` (`dueTurn`), durations in `Weeks`; `haulDistanceFt`, `feedRateBcyHr`, `spotUsdPerFineOz`, `weighedRawOz`.
- Naming: error codes `SCREAMING_SNAKE`; alert kinds and tuning keys dotted camelCase (`cash.projectedNegative`); bot and fixture ids camelCase; streams and id prefixes as registered.
- Comments explain *why* (real-world rationale, design reference like `// DESIGN §7.4`), not *what*.
- UI components are thin: read via selectors, dispatch actions, wrap every displayed number in `<Num>` so it opens its explanation. No game math in components; tables sort and filter only on visible fields.
- Formatting lives only in `ui/format` (locale fixed to en-US; DESIGN §13.2 is the table): cents hidden at or above $1,000 except in the ledger and unit costs; statements in whole dollars with negatives in parentheses; gold 3 dp below 100 oz else 2 dp, always raw or fine; grade 4 dp; bcy as integers; percentages 1 dp.

## Testing rules

- **Every economic formula has unit tests with hand-computed fixtures**: amortization (incl. seasonal schedules), interest accrual, royalty math (in-kind and cash, minimum/advance recoupment), wear and failure hazard, recovery by size class, cost per ounce, tax by entity type, depreciation, depletion, covenant ratios, borrowing base, payable/fineness math, estimate statistics, permit review time distributions; plus dmath golden values, `rng` key encoding, `compareIds`, unit conversions.
- **Property tests** (fast-check): ledger balances; cash changes only via ledger; gold conservation identity (§2.14, ±1e-6 oz) every step; no negative inventories or hours; determinism under replay; stream isolation; explain-flag invariance; memo transparency; iteration-order independence; declared sub-order independence; undo restores deep-equal state; registries complete; no look-ahead (scrambling hidden fields changes no visible selector).
- **Fixtures**: obligation timing (statutory vs billable), each section's worked examples, BALANCE reference operations.
- **Golden replays** in `tests/golden/`: recorded action logs with per-week state hashes. Regenerate only for intentional rule changes.
- **Saves**: round trip gives an identical hash; every migration has a fixture; `SaveFile.ui` changes never alter the hash; per-slice year-10 size.
- **Bots**: identical decisions under scrambled hidden state; zero validator rejections over 20 seeds × 2 years per catalog bot.
- **UI** (DESIGN §13.27): scrambled-truth DOM identity, explain coverage of every number, worker run ≡ `runToNextDecision`, accessibility, for every screen shipped so far.

## Balance workflow

- BALANCE.md owns targets, metrics, bots and protocol; values live in the owning section's tuning table. If a section and BALANCE disagree, the brief decides, then BALANCE.
- Survival is gated both ways (BALANCE O-01): going-concern **S_N** (§5.2) and no-bankruptcy **B_N** (§5.1); a bankruptcy filing of either kind (liquidation or reorganization) fails both for its window. Always print the reorganization share RS_N and the retreated share B_N − S_N beside them.
- Cadence: per-PR CI runs fixtures and `--world-only` checks (< 2 min); nightly runs full `sim:balance`, §4 estimator calibration and (from P5) `--market-only`; phase exit runs the full matrix, including the backgrounds block (plus events-only from P3, the entity block from P4, market-only from P5, and the difficulty block, reported from P1 and gating at P6; BALANCE §6.4).
- Tune one lever at a time with the owning system's keys, at full sample on common seeds; keep a change only if the paired effect exceeds 2 standard errors and no gating target leaves its band. A non-§3 change must leave the world hash unchanged. Log every change in `src/data/tuning/CHANGELOG.md`. If tuning cannot reach a target, raise it with the owner as a design problem.
- After every phase: write `docs/balance/phase-N.md` from the BALANCE §10 template (results vs targets, what was tuned old → new and why, every AT-RISK explained), commit `docs/balance/baseline-phase-N.json`, and summarize both in the `CHANGELOG.md` entry.

## Phase plan

**Phase-exit gate (every phase; mirrors DESIGN §2.15).** (1) The game is playable from start to bankruptcy or profit with the phase's features. (2) `npm run check` and `npm run test:e2e` are green, including golden replays and the §13 UI tests for every shipped screen. (3) `npm run sim:balance -- --phase N` has run, `docs/balance/phase-N.md` is written, and no target BALANCE §7 marks gating for the phase, and no gate in DESIGN §1 1.19, is FAIL (BALANCE O-13 pacing gates every phase from P1). (4) Every tuning change is in the tuning changelog and the phase has a `CHANGELOG.md` entry. (5) `npm run test:perf` passes. Each section's phase plan (§N "Phase plan") is the detailed scope.

**P0 — Foundation.** Scaffold and ESLint rules (layering, banned APIs and `Math.*` transcendentals, raw iteration, registered streams and prefixes, raw hook reads); engine core (`rng` + stream registry, `dmath`, ids, iter, `Cents`/`MilliOz`, memo, §1 calendar, `CalcNode`, `effective()` with an empty hook registry, `TuningResolved` + `tuningHash` + difficulty entries); GameState with every slice; `advanceWeek` steps 0–16 as ordered stubs with guard and turn semantics, `WeekReport`, `runToNextDecision` + `evaluateStops`, `PendingDecision` + `decision/answer`, history ring; `SaveFile`, IndexedDB slots, autosave, gzip export/import, migration harness; Vitest, fast-check, golden-replay, zod and perf harnesses; §3 world generator, packing, `drawSample` and its calibration harness, with §4's estimator calibrated against it; sim worker pool, seeds, `passive` bot, JSON output, `sim:balance` printing an empty scorecard; UI shell (§13 P0: nav, top bar, Advance Week, Saves, Settings, minimal explain, wizard stub, dev reveal, `ui/format`, theme tokens, fonts and grain).
*Exit:* a P0 game advances 52 weeks to a golden hash, identical in Node and Chromium; save, load and export round-trip with identical hashes; `npm run sim -- --games 10 --strategy passive --years 1` runs; §4 calibration passes for every template × setting, old-timer kind and 160-acre claims (P10–P90 covers truth in 72–88% of claims, median ln(P50/truth) within ±0.10); §13 T1, T11, T18.

**P1 — Core loop.** Two districts (northern and arid federal) with full seasons, weather, forecasts and access; setup with every entity, background and start; full world, block model, old-timers and seller honesty; pans, hand pits/dry washers, excavator pits, records review and the full estimator except pooling; buy or lease at the ask with the full ProductionInterest waterfall, quick sale and lease surrender; the obligation store with the billable rule; full mine plan, flow model, thaw, water, recovery, cleanup, cost lines and what-if hints; seven staff roles with hourly pay, morale, quits, fatigue, layoff and recall; the foreman rule (every active claim needs a hired foreman or the owner, D-8.18, except a small crew of ≤ 3 hands on one line and one shift, D-8.48); the 18-model catalog, new and graded used, transport; lots and the local buyer; company and owner books, ledger, bills, P1 payroll, fixed loans, P1 P&L, per-claim P&L, cash cost/oz, 13-week projection, insolvency counter; the §12 framework with empty event tables; the §13 P1 screens, tutorial and end report; the P1 catalog bots, `sim:balance` core and ablation blocks, `--fixture`, `--world-only`, `--rules`.
*Stubs:* flat $4,200 gold, no macro or news; local buyer only; cash purchases plus two fixed loans (Inheritor note, banker stub); no permits (authority `plan`, `activityAllowed` passes, $6,000/acre liability stub); flat maintenance by visible grade A–D, availability 0.92, no wear or breakdowns; visible staff attributes, no injuries or training; fixed asking terms (no negotiation, staking, auctions or claim fees); no events or competitors; sandbox and Standard only in the UI; Mechanic, Banker and Landman edges as §1 1.7 stubs.
*Exit:* every BALANCE §7 P1 gate (T-01–T-07, T-08 a–b, T-09 b–c, T-10 a and c, T-12, T-16; O-01 interim S2 55–75% and B2 ≥ 70%, O-02 interim 20–45%, O-03 (S2 2–40%), O-06 a (45–85%) and c (Inheritor season-1 attempt ≥ 80%), O-07 ±7 pp, O-08, O-13, O-14 P1 band, O-16; G-01–G-03), incl. T-06 `refSmallNorth` 55–65k bcy and 450–650 raw oz in an established season; gold conservation with cleanup and sample lots; §3 class shares and §4 calibration on held and listed pools; billable obligation-timing fixtures.

**P2 — Licensing.** The U.S. federal regime in full under the real agencies (§6: the agency map, `agencyFor`, the disclaimer): claim fees, recording, Small Miner's Waiver, Sept 1 forfeiture; casual, notice and plan tiers; ancillary approvals; the permit pipeline; conditions and exceedance; RCE, cash and surety bonds; reclamation liability and ARO; auto-pay and auto-file; inspections, violations, orders, standing; permit transfers. Also staking, patented and permitted listings, the starter permitted lease, records check and inspection period (§5); NPC forfeiture and staking (§3); trench, bulk sample, geophysics, pooling, PER, verification, VOI (§4); permit-gated plans, ponds and reclamation work (§7); training, injuries, safety record (§8); restricted cash, bond deposits, GL stub (§11); the Permits screens, custom stop rules and muting (§13); `exceeder`, `abandoner`.
*Exit:* no mining without authority; an unpaid Sept 1 fee forfeits even when cash arrives in step 14 (statutory fixtures); liability and ARO on the balance sheet; BALANCE §7 P2 gates (O-01 S2 55–72% and B2 ≥ 70%, O-02 10–35% with permitting delay, O-15); 35–45% of standing-60 plans filed in January approved before the next breakup; `exceeder` beats `cautious` 5-year median NW by ≤ 10% with no lower bankruptcy rate; `abandoner` ends year 3 with lower NW than `cautious` in ≥ 95% of seeds; ≥ 8% of northern listings carry transferable plan authority and every starting district has a starter permitted lease.

**P3 — Equipment depth.** Full catalog and brands; certified, private and auction channels; hidden condition and inspections; components, wear, failures and the step-10 re-resolve; PM, shop capacity and backlog, parts and lead times, field service, warranty; rental, leases and rent-to-own; cost per hour; district shop pools (§9). Several plant lines per claim (§7). Also drilling and lab turnaround (§4); frozen damage, winter ops, fuel stock (§7); hidden staff attributes, résumés, welder, driller (§8); lease accounting and parts inventory (§11); §12's equipment events and director; Inheritor hidden condition and the full Mechanic edge (§1); `noMaintenance` and the fleet bots; `--events-only`.
*Exit:* BALANCE §7 P3 gates (T-04–T-07 with wear, T-09 full catalog, O-01 S2 58–72% and B2 ≥ 73%, O-02 12–35%, O-06 a 50–80% per start, O-07 ±5 pp, O-09: `noMaintenance` loses ≥ 8 pp S2 and ≥ 0.10 NW ratio over 5 years yet has the higher season-1 operating margin); reference-fleet R&M + PM + parts $130–180 per fleet hour; the brand-mix check, and `auctionOnlyFleet` does not dominate `cautious`; T-14 equipment part reported; breakdown idle time shows in the bottleneck view; the cost-per-hour report reconciles to the ledger.

**P4 — Finance depth.** The rest of §11: reserve and sweeps, priority reordering, credit profiles, every lender and product (bank, SBA, equipment and captive finance, hard money, cards, MCA, seller carry, revolver, LOCs, royalty sales, streams, prepays, equity, rescue partner), covenants, default, repossession, workout, the full distress ladder with Chapter 11 Subchapter V reorganization, guarantees, insurance, taxes, full reports and the banded 13-week forecast. Also entity taxes, PGs, owner personal finance, investor check-ins and ouster, the full Banker edge (§1); claim sales and forced sales (§5); payroll taxes, bonuses, gold share, bookkeeper and controller (§8); equipment finance (§9); finance and labor events (§12); `allHardMoney`, `royaltyEveryWinter`.
*Exit:* statements tie out in property tests (balance sheet balances, cash flow reconciles to cash); the distress ladder plays end to end with every fight-back lever; BALANCE §7 P4 gates (O-01 S2 60–70% and B2 ≥ 75%, O-02 15–35%, O-04 no strict dominance, O-06 a–d (S2 50–80% per start; b and d start gating: year-5 owner-ahead share within 20 pp between starts, the Backed-equity loss calibration), O-18 (sole-prop `cautious` S2 within 5 pp of LLC), T-08 c–d (debt variant, M-FLIP 15–35%), T-10 b (mature ÷ reference break-even ≤ 0.85 on thawed ground), T-11 trough, G-08); §1 1.22 investor fixtures incl. the Backed-loss calibration; the §11 11.16.7 reorganization worked example; walkout, `lenderPolicy` and `taxAudit` fixtures.

**P5 — Living market.** In §10's order: macro layer, regime/GARCH/jump price with pre-history, index and ripples, news (P5a); refineries, metal accounts, shipments and assays, storage and theft (P5b); forwards, prepay forwards, margin (P5c); puts as stretch (P5d). Also the full event catalog, preps, director budget and AI competitors (§12); the negotiation model for land, equipment and loans, estate, distressed and auction channels, title defects (§5); gold-driven lender appetite, gold loans, hedging covenants (§11); ripples in §4, §8, §9; skim and theft (§7); `hedge50`, `noHedge`, `alwaysLocalBuyer`; `--market-only`.
*Exit:* §10.6 statistics in band over 2,000 seeds × 10 years (T-13, O-11); BALANCE §7 P5 gates (T-14 in full, O-01 S2 60–70% and B2 ≥ 75% re-baselined, O-10, O-12, O-14 P5 band, O-17 ≤ 35%); competitors win 35–60% of contested listings; median auction hammer ÷ V_claimed 0.45–0.70 and median accepted private price 75–85% of ask.

**P6 — Expansion.** Alaska-style and Yukon-style regimes, tenure and districts (plus the temperate template; 4–6 districts); multi-claim delegation depth (a foreman auto-plans, a staff geologist runs programs by VOI, a land specialist auto-files, a controller reports across claims; the foreman rule itself ships in P1); JVs and investor depth; goal scenarios with medals; Easy and Hard in the UI; portfolio view; the difficulty block of the matrix becomes gating. Last and optional: the §14 hard-rock track behind `game.hardRockEnabled`, in sub-steps P6c (exploration, toll milling), P6d (underground), P6e (own mill), each ending playable; `hardrockSeeker`.
*Exit:* O-05 difficulty ordering (`cautious` S2 easy > standard > hard by ≥ 8 pp per step, no reversal); Alaska-style and Yukon-style regime fixtures; scenario fixtures and medals (§1 1.22); with hard rock on, the §14 14.13 targets (lode class shares, 35–55% of indicated targets reach production, `hardrockSeeker` lifts year-2 survival by ≤ 2 pp and stays ≤ 2× the best placer bot's year-10 median NW).

## Git

- Work on the branch you were given; commit in small, reviewable steps with messages that say what changed and why (`ops: add water-limited plant capacity (DESIGN §7.3)`).
- Run `npm run check` before committing. Never commit failing tests, generated `dist/`, or local sim outputs (`out/` is gitignored; curated reports and baselines go in `docs/balance/`).
