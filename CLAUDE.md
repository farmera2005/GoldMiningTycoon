# CLAUDE.md — Gold Mining Tycoon

Single-player browser business simulation: the player founds and runs a small **placer gold mining company** as its Owner. Weekly turns, owner-level decisions, no equipment-driving. The simulation resolves what the crew produced, what broke, what it cost, and what the gold was worth. Target: depth and realism (thin margins, big capital bets, incomplete information about the ground, cash flow that can kill a profitable operation).

**Source documents (read before any work):**

| File | What it is | Authority |
|---|---|---|
| `docs/BRIEF.md` | The owner's original brief, verbatim | Source requirements |
| `DESIGN.md` | Full game design: rules, formulas, data shapes, decisions log, open questions | How the game works. Implement what it says; change it before changing behavior |
| `BALANCE.md` | Economic targets and how the simulator verifies them | Tuning acceptance criteria |
| `CLAUDE.md` | This file: conventions, commands, architecture rules, phase plan | How we build |
| `CHANGELOG.md` | One entry per phase (and per notable change) | History |

## Current status

- **Phase:** planning complete, awaiting owner review. **Do not start Phase 0 until the owner approves `DESIGN.md`, `CLAUDE.md`, and `BALANCE.md`.**
- Update this block at the end of every phase (phase, date, sim headline numbers, known gaps).

## Working rules

1. **Phases are sequential.** Each phase ends with: a playable game, all checks green (`npm run check`), a `CHANGELOG.md` entry, and a simulator report against `BALANCE.md` saved to `docs/balance/phase-N.md` listing every constant tuned. Do not start the next phase until the current one is solid.
2. **Ask before expensive-to-reverse decisions** (state shape changes that break saves without a migration path, pipeline order, RNG stream layout, money/units representation, removing a system, changing a scenario's win condition). Otherwise decide, record it in `DESIGN.md` → *Decisions* (`D-<section>.<n>` — decision — rationale), and keep moving.
3. **Design first, then code.** If implementation reveals the design is wrong or incomplete, update the relevant `DESIGN.md` section in the same change as the code. Code and design must not drift.
4. **Content and tuning live in `src/data/`**, never in logic. If you are typing a number that a designer might want to change, it belongs in a tuning file with a named key.
5. **Never skip, disable, or weaken a test to get green.** Fix the code or, if the rule changed, change the test and the design together.
6. **No model names or AI identifiers** in code, comments, commits, or docs.

## Commands

> Phase 0 creates these. Until then the repo contains only planning documents.

| Command | Does |
|---|---|
| `npm install` | Install dependencies (Node ≥ 22) |
| `npm run dev` | Vite dev server for the UI |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest, all projects, once |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:engine` | Engine + data tests only (fast; no DOM) |
| `npm run lint` | ESLint (includes engine purity and determinism rules) |
| `npm run typecheck` | `tsc --noEmit` for all projects |
| `npm run format` | Prettier write |
| `npm run check` | lint + typecheck + test — **must pass before every commit** |
| `npm run sim -- [opts]` | Headless simulator (see below) |
| `npm run sim:balance` | Runs the full `BALANCE.md` suite and prints pass/fail per target |
| `npm run replay -- <log.json>` | Replays an action log and prints per-week state hashes |
| `npm run goldens:update` | Regenerates golden replay hashes (only for intentional rule changes; note it in `CHANGELOG.md`) |

Simulator options: `--games N` (default 200) · `--strategy cautious|aggressive|undercapitalized|balanced|all` · `--years N` (default 5) · `--difficulty easy|standard|hard` · `--start bootstrapper|backed|inheritor` · `--seed-base N` · `--tuning overrides.json` · `--out results.json` · `--csv dir/` · `--workers N`.

## Tech stack

TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · React 19 · Vite · Zustand · Recharts · Tailwind CSS · Immer (engine reducers) · zod (data validation) · Vitest + fast-check · `idb` (IndexedDB) · ESLint (flat config) + Prettier · tsx for Node scripts.

## Repository layout

```
docs/                 BRIEF.md, balance/phase-N.md reports
src/
  engine/             PURE TypeScript simulation. No DOM, no Node APIs, no React.
    core/             rng.ts, dmath.ts, money.ts, ids.ts, calendar.ts, calc.ts (CalcNode), assert.ts
    state/            GameState and slice types, newGame()
    systems/          one folder per DESIGN.md system: world/ knowledge/ land/ permits/ ops/ staff/ fleet/ gold/ finance/ events/ competitors/
    actions/          Action union, validators, handlers (one file per action family)
    turn/             advanceWeek pipeline steps (one file per step, ordered as DESIGN.md §2.6)
    explain/          explainers: (state, args) → CalcNode
    select/           selectors (pure derived views)
    save/             schema versions, migrations, serialize/deserialize
    index.ts          the only public engine surface
  data/               Typed content & tuning (pure data, validated by zod in tests)
    tuning/ difficulty.ts calendar.ts regions/ equipment/ staff/ permits/ finance/ events/ scenarios/ text/
  ui/                 React app: store/ (Zustand), screens/, components/, charts/, format/
  persistence/        IndexedDB save slots, autosave, file export/import (browser-only)
sim/                  Headless simulator: cli.ts, runner.ts, bots/, report.ts (Node-only)
tests/                Cross-cutting tests: golden replays, property tests, data validation, scenario tests
```

Unit tests are colocated (`foo.ts` → `foo.test.ts`). Cross-system tests live in `tests/`.

## Architecture rules (non-negotiable)

**Engine purity**
- `src/engine/**` and `src/data/**` must not import from `ui/`, `persistence/`, `sim/`, React, or any browser/Node API. ESLint enforces it; a test scans the import graph.
- Public surface is `src/engine/index.ts`: `newGame`, `applyAction`, `advanceWeek`, `runToNextDecision`, `validateAction`, `select`, `explain`, save helpers. UI, bots, and tests use only this.
- State is plain serializable data (no classes, Maps, Sets, Dates, functions, or `undefined`-vs-missing ambiguity). Collections are `Record<Id, T>` plus a sorted `ids` array where order matters.
- Reducers are pure; use Immer `produce`. Never mutate input state.

**Determinism** (same seed + setup + action log ⇒ identical game, in Node and every browser)
- Randomness only via `rng(seed, streamName, ...keys)` from `engine/core/rng.ts`. Never `Math.random`. Each system uses its own named stream; per-entity streams append the entity ID. Adding a draw in one system must not change any other system's results.
- Transcendental math only via `engine/core/dmath.ts` (`exp`, `log`, `pow`, `sin`, `cos`, `normInv`, …). `Math.exp/log/pow/sin/cos/tan/atan/…` are lint errors in the engine. `Math.sqrt/floor/ceil/round/abs/min/max` are fine.
- No wall clock, no locale, no `Intl` in the engine. Iterate entities in sorted-ID order. Never iterate object keys for logic.
- The weekly pipeline order is fixed (DESIGN.md §2.6). Changing it is an expensive decision: ask first.

**Units and money**
- Money is **integer cents** in state (`Cents` branded type). Compute in floats, round once at ledger posting with `roundCents`. Cash changes only through ledger postings.
- Gold in troy ounces, always labeled **raw** or **fine** in names (`rawOz`, `fineOz`). Volumes in **bank cubic yards** (`bcy`); loose yards only inside haulage math. Grades in raw oz per bcy. Area in acres. Annual rates as decimals.
- Name variables with units when ambiguous: `haulDistanceFt`, `feedRateBcyHr`, `priceUsdPerFineOz`.

**Hidden information**
- True geology, true machine component health, true employee attributes, and true seller honesty live in state but are never read by UI code or bots except through knowledge selectors. A test runs every bot against scrambled hidden state and asserts identical decisions.

**Actions and validation**
- Every player decision is a serializable `Action` with a `type` discriminant, handled by `applyAction`. Actions carry intent, never derived numbers (no "price I saw").
- Every handler has a pure validator returning typed error codes; the UI uses `validateAction` to disable controls with a reason.
- Blocking `PendingDecision`s stop `advanceWeek` until answered.

**Explainability**
- Formula functions return `{ value, calc }` where `calc` is a `CalcNode` tree built only when explanations are enabled. Anything shown in the UI must be explainable, either from the `WeekReport` (dice-dependent results) or via `explain.*` (pure derived values). Calc nodes cite tuning keys and entity IDs.

**Content and tuning**
- All catalogs, tables, and constants live in `src/data/` as `as const satisfies Schema`. Every data file is zod-validated and cross-reference-checked in tests.
- Tuning keys are namespaced (`geology.*`, `ops.*`, `fleet.*`, `staff.*`, `land.*`, `permits.*`, `market.*`, `finance.*`, `events.*`, `ai.*`, `game.*`) and match the names in `DESIGN.md` tuning tables.
- Tuning resolves once at `newGame` (base → difficulty → scenario → overrides) and its hash is stored in the save. Don't read raw tuning files from systems; read `state`-resolved tuning via the context object.

**Saves**
- Save files carry `schemaVersion`. Any breaking state change bumps it and adds a pure migration in `engine/save/migrations.ts` with a fixture test. Never break loading of the previous version.

## Coding conventions

- Discriminated unions for variants; exhaustive `switch` with `assertNever`. No `any`; `unknown` + narrowing at boundaries.
- Small pure functions named for what they compute (`recoveryRate`, `amortizationSchedule`). One system per folder; a system exposes `types.ts`, its pipeline step(s), its action handlers, its selectors, and its explainers.
- Comments explain *why* (real-world rationale, design reference like `// DESIGN §7.4`), not *what*.
- UI components are thin: read via selectors, dispatch actions, format numbers with `ui/format`. No game math in components.
- Formatting: USD with thousands separators (cents hidden above $1,000), ounces to 2–3 decimals, yards as integers, percentages to 1 decimal, negatives in parentheses in financial reports.

## Testing rules

- **Every economic formula has unit tests with hand-computed fixtures**: amortization, interest accrual, royalty math (in-kind and cash, minimum/advance recoupment), wear and failure hazard, recovery by size class, cost per ounce, tax by entity type, depreciation, depletion, covenant ratios, borrowing base, payable/fineness math, estimate statistics, permit review time distributions.
- **Property tests** (fast-check): ledger balances; cash changes only via ledger; gold conservation (contained = recovered + lost; recovered = royalties + sold + inventory); no negative inventories or hours; determinism under replay; RNG stream isolation.
- **Golden replays** in `tests/golden/`: recorded action logs with per-week state hashes. Regenerate only for intentional rule changes.
- **Data validation**: zod over every data file plus cross-reference checks.
- **Scenario tests**: short scripted games with expected outcome bands.
- **Bot honesty test**: bots make identical decisions with scrambled hidden state.

## Balance workflow

- `BALANCE.md` lists the targets, the bot strategies, and the pass/fail bands. `npm run sim:balance` evaluates all of them.
- After every phase: run the suite, write `docs/balance/phase-N.md` (results table vs targets, what was tuned with old → new values and why, what is still out of band), and summarize it in the `CHANGELOG.md` entry.
- Tuning changes go in `src/data/tuning/` (or difficulty/scenario files) only. If a target cannot be reached by tuning, that is a design problem: raise it with the owner.

## Phase plan

Each phase's exit criteria are in addition to the standing ones (playable, `npm run check` green, changelog, balance report).

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Foundation** | Vite + React + TS scaffold; ESLint purity/determinism rules; `rng` (xoshiro128\*\* + keyed streams), `dmath` with golden tests; money/ids/calendar core; GameState skeleton; `newGame`/`applyAction`/`advanceWeek` with an empty ordered pipeline; `CalcNode`; IndexedDB slots + autosave + export/import; save schema v1 + migration harness; Vitest + fast-check harness; golden replay harness; sim CLI skeleton with a do-nothing bot and report printer; minimal UI shell (nav, top bar, advance week). | A blank company can be created, advanced 52 weeks, saved, reloaded, exported/imported; replay of a recorded log is byte-identical in Node and Chromium (Playwright smoke); sim runs 500 empty games. |
| **1 — Core loop** | Setup (entity, background, start — simplified per DESIGN); P1 districts (northern + arid federal), claim generation & market (buy and lease, fixed terms); basic prospecting (panning, test pits) with estimates; small cash-only equipment catalog (flat maintenance $/hr, no breakdowns); hiring with visible attributes; mine plan, weekly capacity/bottleneck/recovery model, cleanup; flat gold price; local-buyer sales; single bank account; ledger; basic P&L; simple insolvency. Dashboard, claims, operations, equipment, staff, gold sales, bank, P&L screens. | A full game from setup to bankruptcy or profit is playable in the UI; bots (cautious, aggressive, undercapitalized) run in the sim; first balance report. |
| **2 — Licensing** | U.S. federal regime in full: claim fees, small miner waiver, deadlines and forfeiture; casual/notice/plan tiers; ancillary permits; permit pipeline; bonds (cash/surety); compliance calendar; inspections, violations, stop-work, regulator standing; reclamation liability and reclamation work. | Cannot mine without authority; missing Sept 1 forfeits claims; a Plan of Operations timeline matches DESIGN examples; reclamation liability on the balance sheet. |
| **3 — Equipment depth** | Full catalog and brands; new/certified/private/auction markets with gold-price ripple; hidden condition and inspections; component wear, failures, downtime; mechanics, shop capacity, backlog, PM; parts inventory and lead times; field service; rental, operating/finance leases, rent-to-own; mobilization; cost-per-hour report. | Fleet degrades without maintenance at the rates in DESIGN; bottleneck view shows breakdown-driven idle time; cost-per-hour report reconciles to the ledger. |
| **4 — Finance depth** | Owner and company credit; all lenders and products; amortization and seasonal structures; revolver/borrowing base; cards and vendor credit; gold loans; streams/royalty deals; equity partners; covenants; distress ladder with default, repossession, renegotiation, bankruptcy; personal guarantees by entity; insurance; taxes; full reports, 13-week forecast, debt schedule. | Statements tie out (BS balances, CF reconciles to cash) in property tests; distress ladder playable end to end; balance targets for survival within band. |
| **5 — Living market** | Dynamic gold price (regimes, GARCH, jumps) with macro drivers and news; refinery, holding inventory, forwards/hedging; ripple effects everywhere; event director and full event catalog; AI competitors; negotiation for land, equipment, loans; auctions. | Price-model statistics within BALANCE bands over 1,000 seeds; competitors go bust in downturns and their assets reach the market; no single strategy dominates. |
| **6 — Expansion** | Alaska-style and Yukon-style regimes and districts; multi-claim delegation (foreman, controller); joint ventures and investor depth; goal scenarios and difficulty presets; then the optional hard-rock track. | Each scenario winnable by at least one bot strategy on standard; difficulty presets move survival rates in the expected direction. |

## Git

- Work on the branch you were given; commit in small, reviewable steps with messages that say what changed and why (`ops: add water-limited plant capacity (DESIGN §7.3)`).
- Run `npm run check` before committing. Never commit failing tests, generated `dist/`, or local sim outputs (they go in `.gitignore`; curated balance reports go in `docs/balance/`).
