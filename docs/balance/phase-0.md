# Balance report: phase 0 (Foundation)

Phase 0 builds the deterministic engine frame, the §3 world generator, the §4 estimator, the headless simulator and the UI shell. It has no gameplay economics yet: no operations, purchases, staff or loans, so no BALANCE target gates P0 (BALANCE §7 lists P1–P6). This report therefore covers the run identity, the empty scorecard, the P0 exit gates of CLAUDE.md's phase plan and DESIGN §1 1.19, the §3 world calibration and the §4 estimator calibration, which is P0's statistical gate.

## 10.1 Run identity

- git SHA: `cbc87a35dc06219748ef541ecc18f29961e9879d`; tuningHash: `bc461e9c17708d43`; BOT_VERSION: `1.0`; seedBase: `1000` (`src/data/balance/seeds.json`, `p0`); games per cell: 500; rules: p0.
- Matrix blocks run (BALANCE §6.4): the world block only. P0's catalog has one bot (`passive`) and no block uses it in P0, so the scorecard has no bot cells. World block: 500 worlds (`newGame`, no weeks), 28 s wall time on 4 cores.
- `summary.json` is byte-identical with 4 and 2 workers (sha256 `c2378ede…1afa7`); it is committed as `docs/balance/baseline-phase-0.json`.
- Engine time per game-week, explanations off (DESIGN §2.13, D-2.15: ≤ 3.5 ms mean, ≤ 8 ms p95): `npm run sim -- --games 40 --strategy passive --years 5` measured 10,360 weeks at a mean of **0.425 ms**, p95 **0.621 ms**. The P0 week is mostly stubs (steps 2–15); the figure is the frame's cost, not P1's. `npm run test:perf` passes.
- Baseline compared against: none (first phase).

## 10.2 Scorecard

`npm run sim:balance -- --phase 0` scores all 134 target clauses that `sim/balance/targets.ts` transcribes from BALANCE §2.2, §3 and §7. Every clause is N/A in P0: no target is active before P1 (BALANCE §7), and none of their inputs exist yet. Clauses: 134 · PASS 0 · AT-RISK 0 · FAIL 0 · N/A 134.

## 10.3 Gating summary

- FAIL among gating targets: none (none are active in P0).
- AT-RISK among gating targets: none.
- DESIGN §1 1.19 / CLAUDE.md P0 exit gates:

| Gate | Status | Evidence |
|---|---|---|
| A P0 game advances 52 weeks to a golden hash | PASS | `tests/golden/p0-passive-52w`: 53 per-week hashes, turn 52 `acf8ffe640996e4b` |
| …identical in Node and Chromium | PASS | `tests/e2e/determinism.spec.ts` replays the golden log in Node and in Chromium 141 through an esbuild bundle of the engine; both match the committed hashes |
| Save, load and export round-trip with identical hashes | PASS | engine `save.test.ts`, `tests/scenarios/save-codec.test.ts`, UI T11 tests and `tests/e2e/saves.spec.ts` (export → import → same state hash; SAVE_TOO_NEW rejected; corrupt import changes nothing) |
| `npm run sim -- --games 10 --strategy passive --years 1` runs | PASS | exit 0; S1 0.0%, B1 100.0%, owner NW $520,000 at p10/p50/p90, 0 rejected actions |
| §4 calibration passes (P10–P90 coverage 0.72–0.88, median ln(P50/truth) within ±0.10, block z sd 0.85–1.15) | **AT-RISK** | 29 cells × 8 mixes at 1,000 claims per cell: every gated cell × mix passes except arid recent-cat ground at sonic + bulk, coverage 0.886 ± 0.011 (see "§4 estimator calibration" below) |
| §13 T1, T11, T18 (and T20, T28 on the shell, both themes) | PASS | `src/ui/format` table tests incl. de-DE/ar locales; T11 unit + e2e; `tests/property/explainInvariance.test.ts` (20 seeds × 52 weeks); `src/ui/theme/tokens.test.ts`; `tests/e2e/theme.spec.ts`; axe-core zero serious/critical on every P0 route in both themes |
| `npm run check` | PASS | lint, three typechecks, 105 test files / 1,119 tests |
| `npm run test:e2e` | PASS | 20 Playwright tests |
| `npm run test:perf` | PASS | advanceWeek mean and p95 within `sim.perf.*` |

## 10.4 Start, bot and background tables

P0 runs only the `passive` bot on the Bootstrapper start (the P0 build accepts only that start; other starts and bots exit 2 with "available from P1"). Over 40 games × 5 years: S_N 0.0% and B_N 100.0% in every year (a passive owner never washes, so every run "retreats": B_N − S_N = 100%), RS_N 0.0%, BK_N 0.0%, owner NW $520,000 at p10, p50 and p90 (NW ratio 1.00), 0 stops (P0 has no stop sources), 0 rejected actions. Every other metric is n/a until P1 supplies its inputs; `sim/metrics/observe.ts` throws rather than read zero once a later rules phase runs without the input wired.

## 10.5 Fixtures

None in P0: BALANCE §2.1's fixtures need §7 operations (P1). `--fixture` exits 2 with "available from P1".

### §3 world calibration (sim:balance world block, 500 worlds per template, seed base 1000)

| Measure | North | Arid | Band (§3.7 / §3.18) |
|---|---|---|---|
| Listing pool U / M / G / E % | 65.8 / 24.2 / 8.7 / 1.3 | 63.5 / 26.5 / 8.9 / 1.1 | 60–72 / 18–30 / 5–10 / 0.7–2.5 (BALANCE T-02) |
| All parcels | 69.1 / 20.3 / 8.9 / 1.7 | 67.4 / 23.0 / 8.4 / 1.2 | reported |
| Held parcels | 60.7 / 25.1 / 11.9 / 2.3 | 58.3 / 27.3 / 12.2 / 2.1 | reported |
| Open ground | 87.4 / 10.0 / 2.4 / 0.2 | 79.6 / 17.0 / 3.2 / 0.1 | reported |
| Held share | 0.685 | 0.576 | 0.65–0.75 / 0.52–0.62 |
| Parcels per district, mean (min) | 69.4 (60) | 68.1 (60) | 65–75; ≥ 55 in ≥ 99% |
| Held median paystreak grade p50 (oz/bcy) | 0.0062 | 0.0045 | 0.004–0.009 |
| Mined-block grade p90 (oz/bcy) | 0.0346 | 0.0375 | ≤ 0.045 (§3.18); BALANCE T-01 (a) ≤ 0.035 |
| Whole-claim strip ratio p50 | 4.12 | 1.67 | 3–5 / 1–2 |
| Paystreak blocks in 0.005–0.03 oz/bcy | 52.4% | 40.0% | BALANCE T-01 (b) ≥ 45% / ≥ 40% |

All 44 gating band checks pass; of the 8 non-gating checks, the one miss is BALANCE T-01 (a) for arid (0.0375 against 0.035), which gates from P1 (see 10.8). The generator was calibrated on the engine itself (DESIGN D-3.49 – D-3.51): the creek network was enlarged, benches and arid trail degradation got per-template values, and arid `gMed` stepped from 0.0062 to 0.0056.

### §4 estimator calibration (1,000 claims per cell, seed base 1000, 1,713 worlds)

Cells follow DESIGN D-4.47 (an owner-review item, see 10.8): cells defined by player-visible information gate at every evidence mix; cells defined by a hidden attribute (the true old-timer kind, a true deep-muck deposit) are reported at prior, records, pans and fences and gate from the pit grid on. The full table is `docs/balance/estimator-calibration-phase-0.txt` (`npm run calibrate:estimator -- --claims 1000`, 619 s on 4 workers).

| Cell | Pop. | Worlds | Gated mixes passing | Coverage range | Worst \|bias\| (mix) | Block z sd range | Status |
|---|---|---|---|---|---|---|---|
| north.valleyBottom | held | 35 | 8/8 | 0.768–0.869 | 0.068 (bulk) | 0.89–1.01 | PASS |
| north.bench | held | 97 | 8/8 | 0.775–0.834 | 0.068 (prior) | 0.93–0.99 | PASS |
| north.dredgedGround | held | 325 | 8/8 | 0.808–0.850 | 0.087 (prior) | 0.87–0.92 | PASS |
| north.noVisibleWorkings | held | 36 | 8/8 | 0.775–0.861 | 0.067 (bulk) | 0.91–1.00 | PASS |
| north.vis.handCut | held | 647 | 8/8 | 0.760–0.838 | 0.045 (bulk) | 0.96–1.00 | PASS |
| north.vis.recentCat | held | 107 | 8/8 | 0.765–0.845 | 0.058 (bulk) | 0.93–1.00 | PASS |
| north.vis.dredge | held | 325 | 8/8 | 0.808–0.850 | 0.087 (prior) | 0.87–0.92 | PASS |
| north.160ac | held | 339 | 8/8 | 0.723–0.823 | 0.069 (sonic) | 0.92–0.97 | PASS |
| north.deepMuck | held | 251 | 4/4 | 0.712–0.825 | 0.062 (bulk) | 0.98–1.07 | PASS (reported-only miss: records coverage 0.712) |
| north.ot.none | held | 72 | 4/4 | 0.763–0.832 | 0.077 (prior) | 0.94–1.00 | PASS |
| north.ot.drift | held | 111 | 4/4 | 0.777–0.879 | 0.222 (prior) | 0.84–1.00 | PASS (reported-only misses: prior, records) |
| north.ot.handCut | held | 180 | 4/4 | 0.759–0.824 | 0.100 (prior) | 0.93–1.01 | PASS |
| north.ot.recentCat | held | 106 | 4/4 | 0.765–0.847 | 0.058 (bulk) | 0.93–1.00 | PASS |
| north.ot.dredge | held | 325 | 4/4 | 0.808–0.850 | 0.087 (prior) | 0.87–0.92 | PASS |
| arid.fan | held | 67 | 8/8 | 0.824–0.859 | 0.048 (records) | 0.89–0.95 | PASS |
| arid.gulch | held | 87 | 8/8 | 0.813–0.849 | 0.050 (prior) | 0.91–0.99 | PASS |
| arid.bench | held | 184 | 8/8 | 0.803–0.844 | 0.035 (sonic) | 0.93–0.98 | PASS |
| arid.dredgedGround | held | 340 | 8/8 | 0.802–0.863 | 0.080 (prior) | 0.89–0.93 | PASS |
| arid.noVisibleWorkings | held | 70 | 8/8 | 0.820–0.842 | 0.035 (prior) | 0.93–0.97 | PASS |
| arid.vis.dryWash | held | 104 | 8/8 | 0.804–0.849 | 0.059 (records) | 0.88–0.96 | PASS |
| arid.vis.recentCat | held | 169 | 7/8 | 0.833–0.886 | 0.087 (pans) | 0.93–0.96 | **FAIL at sonic + bulk (coverage 0.886)** |
| arid.vis.dredge | held | 340 | 8/8 | 0.802–0.863 | 0.080 (prior) | 0.89–0.93 | PASS |
| arid.160ac | held | 343 | 8/8 | 0.774–0.822 | 0.062 (sonic) | 0.90–0.97 | PASS |
| arid.ot.none | held | 70 | 4/4 | 0.821–0.841 | 0.038 (prior) | 0.93–0.97 | PASS |
| arid.ot.dryWash | held | 104 | 4/4 | 0.804–0.849 | 0.059 (records) | 0.88–0.96 | PASS |
| arid.ot.recentCat | held | 167 | 3/4 | 0.834–0.886 | 0.088 (pans) | 0.92–0.96 | **FAIL at sonic + bulk (same claims as above)** |
| arid.ot.dredge | held | 340 | 4/4 | 0.802–0.863 | 0.080 (prior) | 0.89–0.93 | PASS |
| north.listed | listed | 27 | 8/8 | 0.785–0.858 | 0.091 (prior) | 0.92–1.00 | PASS; teeth 0.0815 PASS |
| arid.listed | listed | 33 | 8/8 | 0.832–0.864 | 0.082 (records) | 0.90–0.97 | PASS; teeth 0.0794 PASS |

The one remaining miss is on the conservative side: at sonic + bulk, 6.6% of truths fall below P10 and 4.8% above P90 (coverage 0.886 against the 0.88 ceiling, world-bootstrap SE 0.011), so the band edge lies inside the 95% interval: AT-RISK by BALANCE §3.0's rule, but the harness counts it as a gated failure and exits 1. Bias (−0.019) and block z sd (0.95) are in band, so the extra width sits in a claim-level variance term. Candidate fix (not built under the time box): the configuration mixture around recent operators' cuts.

Engine performance of the estimator (DESIGN §2.13; measured on an idle machine): 20-acre solve 21.7 ms cold and 11.4 ms with the prior model cached (budget 10 ms); 160-acre 61.2 ms cold (60 ms); economic-layer rerun 0.13 ms mean, p95 0.22 ms (0.5 ms, within); refresh per game-week with 8 tracked claims and new evidence every week 14.7 ms (1.5 ms). The estimator does not run in the P0 weekly pipeline, so P0's week budget is unaffected.

## 10.6 Tuning changes this phase

Every change is in `src/data/tuning/CHANGELOG.md` and the owning DESIGN tuning table. In summary:

- New P0 keys with no DESIGN value before (start cash, history retention, and §3 prose constants registered as keys, D-3.56): logged as "— → value" rows.
- §3 world calibration on the engine generator (seed bases 1000 and 90000, 400 worlds per template): `geology.world.nTrib` U{3..6} → U{5..8}, `tribLengthMi` U(1.5, 4) → U(2.5, 5), `branchP` 0.4 → 0.5 (parcels per district 61–62 → 69.5 / 68.1); `benchSideP` per template, north 0.5 and arid 0.25 (benches 26–28% → 18.5% / 10.3%); arid `trailDegradeMi` 12 / 30 (highway 21.7% → 39.3%); arid `gMed` 0.0062 → 0.0056 (pool good 10.5–10.9% → 8.8–9.3%).
- §4 estimator calibration: `geology.estWorkedOffStreakLik` 1e-3 → 0.1; hand-cut worked records offset −0.47 → −0.84; `geology.estPriorMedianAdj` north 0 (net), arid −0.05; new keys `estStreakMisfitScale` 0.5, `estClaimSharedLogSd` 0.05, `estWorkedCountSlackBlocks` 2, `estWorkedSetTemper` 1, `estThinCoverSiteWeight` 0.05.
- §1 1.11 difficulty rows now in `src/data/difficulty.ts` (honesty mix, tell detection, start cash, records find, pit stops, contractor lead); standard is unchanged.

## 10.7 Bot changes this phase

- BOT_VERSION 1.0 (first version). Only `passive` is implemented; the rest of the catalog is registered with its phase. No bot change.

## 10.8 Open risks for the next phase

- **§4 arid recent-cat over-coverage** (0.886 vs 0.88 at sonic + bulk): owner review asked below; a targeted fix is a P1 item.
- **Calibration cell definition (D-4.47)** is an integrator ruling made in P0: gated cells are defined by what the player can see; hidden-attribute cells gate only from the pit grid on. It needs the owner's confirmation because it changes which cells the P0 gate counts.
- **Calibration protocol:** a big cell's 1,000 claims come from ≈ 35 worlds (claims within a district share grade effects), so the ±0.10 bias band is under 2 SE for those cells. Sampling at most k claims per world per cell (as the fast test now does) would make the gate far more powerful; it is a protocol change for the owner.
- **Estimator performance** is 10× over its per-week budget until §4.19's incremental path (P1) is built; P1's bots track up to 8 claims, so without it O-13's 3.5 ms mean per week would fail.
- **BALANCE T-01** (P1 gate): mined-block p90 0.0346 north / 0.0375 arid against 0.035; arid paystreak blocks in band 40.0% against ≥ 40%. Expected to stay at risk; DESIGN §3.17 names the levers.
- **north.ot.drift** prior bias +0.22 (reported only) comes from a mismatch between §3's drift removal (−1.34 in log terms) and §4's records table (−0.87); P1 should reconcile them (DESIGN §4 open question).
- **Hand-cut ground (OQ-3.4):** 84.9% of hand-cut parcels work no block, against §4's records share 0.30; a P1 check.
- **World size and generation time (OQ-3.3):** a five-district world is 1,252 kB at generation (budget 1,000 kB) and takes ≈ 151 ms (target < 60 ms); a P6 item.

## 10.9 Sign-off checklist

- [x] no FAIL among gating targets (none active in P0); every AT-RISK explained (the §4 cell above)
- [ ] O-01 reported on both clauses: not applicable in P0 (no operating bot)
- [x] the same four identifiers (SHA, tuningHash, BOT_VERSION, seedBase) reproduce the summary JSON byte for byte (4 and 2 workers)
- [x] every tuning change is in CHANGELOG.md and in the owning section's tuning table
- [x] baseline-phase-0.json committed
- [x] every BALANCE target that DESIGN §1.19 names for P0 gates in P0 in BALANCE §7 with the same band (none: P0's gates are the engine, world and estimator gates above)
- reviewer: the owner, at the P0 review
