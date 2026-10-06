# Changelog

One entry per phase, plus notable changes in between. Balance reports live in `docs/balance/`.

## Phase 1: Core loop (in progress)

Status: being built in waves per `docs/build/p1/plan.md`; entries collect here until the phase exit.

**Golden replays**
- `tests/golden/p0-passive-52w` regenerated for the P1 framework (saves schema 2, rules version 0.2.0, new history fields that are zero or null in a P0 game: weekly `fineOzRecovered` and `sampleRawOz`, annual cash cost, AISC and per-claim rows). A field-by-field diff of all 53 weekly states against the P0 base shows no other change. Turn 52 `0981c636abe30a57`.
- P1 wave 0: goldens regenerated for `fleet-catalog` and `contracts-data` (the new `fleet.*` and P1 tuning keys in `meta.tuning` move `meta.tuningHash` only; a field diff of all 53 weekly states after each merge shows no other change). Turn 52 `8b0c327ac09c4221`.
- P1 wave 0: the build phase is now 1. `p0-passive-52w`'s log pins `"rulesPhase": 0`; regenerated for `contracts-engine` (every P1 slice at neutral values and `meta.calendarMode`; a field diff of all 53 weekly states under rules p0 shows added neutral fields only, nothing changed or removed). Turn 52 `ea8c6643fbf12191`. New `p1-passive-52w` (the same passive game under rules p1). Turn 52 `b6afa02e619a03f0`.

## Phase 0: Foundation (2026-10-06)

Status: implemented; awaiting the owner's review before Phase 1. Balance report: [`docs/balance/phase-0.md`](docs/balance/phase-0.md); baseline: `docs/balance/baseline-phase-0.json`.

**Built**
- Toolchain: TypeScript 6 (strict), Vite 8, Vitest 5 (engine and UI projects), React 19, Tailwind 4, Immer, zod, Playwright 1.56 (Chromium 141), ESLint 9 with a local `gmt` plugin (registered RNG streams and id prefixes, raw hook reads) and architecture tests (layering, banned APIs, registries).
- Engine core (`src/engine/core`): keyed stateless RNG with an 87-stream registry, fdlibm-based `dmath`, integer cents and milli-ounces, ids and `compareIds`, sorted iteration, memo caches, the §1 calendar, `CalcNode`, `effective()`, canonical-JSON hashing.
- Engine framework: `GameState` with every slice, `newGame` (resolved tuning stored in `meta.tuning`), actions and validators, `decision/answer`, the 17-step weekly pipeline as ordered stubs with turn semantics, `WeekReport`, `runToNextDecision` and stop rules, the history ring, a minimal double-entry ledger, selectors and explainers, saves (v1 schema, migrations, load validation, TUNING_DIFFERS), golden replays.
- §3 world generator: districts, creek network, towns, access, water, parcel layout, hidden block truth with packing, old-timer workings, records, holders, `drawSample` with its closed forms, visible priors and the reference-economics yardstick, calibrated on the engine generator.
- §4 estimator: the full statistical layer of §4.4–4.8 (measurement model, small-count table regenerated from the engine's draw, paystreak hypotheses, posterior, coarse Gamma–Poisson, geometry, aggregation, confidence classes), the method catalog, and the calibration harness.
- Simulator: CLI with every documented flag, a worker-process pool with output independent of worker count, the `passive` bot and the full bot catalog by phase, BALANCE §5 metrics, summary JSON and CSV, `sim:balance` with all 134 target clauses, the §6.4 matrix and baseline comparison, `--world-only` with §3 statistics.
- UI: themed shell (Daylight and Lamplight tokens, bundled Besley and Inter, grain), hash router, top bar, Advance Week, `ui/format`, `<Num>` with the explain popover and drawer down to ledger postings, the Saves screen (slots, per-game autosave rotation and year-start snapshots, gzip export and import with typed errors), Settings, the wizard stub, the dev reveal (compiled out of production).

**Verified**
- `npm run check`: 105 test files, 1,119 tests; `npm run test:e2e`: 20 Playwright tests (T11, T20, T28, axe-core in both themes, keyboard path, Node-vs-Chromium replay identity); `npm run test:perf` within budget (advanceWeek 0.43 ms mean, 0.62 ms p95 per simulated week).
- P0 exit gates: see `docs/balance/phase-0.md` §10.3. All pass except the §4 calibration, which is AT-RISK on one cell (arid recent-cat ground at sonic + bulk, coverage 0.886 ± 0.011 against 0.88).
- An adversarial review of the merged code found 34 defects that independent checks confirmed (draw-order dependence in world generation, dredge effects on unworked blocks, exact true depths in a visible sample field, per-year autosave keys shared between games, swallowed storage errors, an empty difficulty table, simulator metric edge cases, vacuous tests); all are fixed with regression tests.

**Golden replays and fixtures**
- `tests/golden/p0-passive-52w` was regenerated four times, each for an intentional change: the real world generator replacing the stub (turn 52 `06952f3af6246bfd`), the review's world fixes (`834f66159360f90f`), the §4 tuning keys (tuning hash only, `d1902a720c81cb4c`) and the final §4 valves (tuning hash only); final turn 52 hash `acf8ffe640996e4b`. The v1 save fixture is rebuilt by `tests/fixtures/make-save-v1.ts`.

**Tuning**
- Every new key and changed value is in `src/data/tuning/CHANGELOG.md` and its DESIGN tuning table; the main calibrations are summarized in the balance report §10.6.

**Decisions and open questions**
- DESIGN records the implementation decisions in each owning section (D-1.63–1.67, D-2.35–2.59, D-3.49–3.61, D-4.47 and later, D-10.46, D-11.74–11.75, D-13.69–13.84). Open questions for the owner are listed in DESIGN §0.

**Known gaps (by design for P0, or carried to P1)**
- No gameplay economics yet (P1). The estimator is not wired into the weekly pipeline or the UI (P1), and it is over its §2.13 per-week time budget until §4.19's incremental path (P1).
- BALANCE T-01 (a)/(b) sit at their lines (P1 gates).

## Unreleased
