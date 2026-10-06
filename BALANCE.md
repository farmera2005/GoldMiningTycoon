# BALANCE.md — Gold Mining Tycoon economic targets

> **Status:** version 1.1, 2026-10-05. Built from DESIGN §1–§14 and from the preflight model run of 2026-10-04 (`docs/prototypes/preflight/preflight_model.py`, output in `preflight_results.txt`). No game code exists yet. Every number marked "preflight" comes from that model, not from the engine. The owner's rulings of 2026-10-05 are applied (§9.5): R-1 to R-4 and the owner-ahead share (§9.5 item 10), adopted by the integrator on 2026-10-04, are approved by the owner, and so are the recommendations of §9.5 items 5–9; survival is gated both ways, going-concern S2 and no-bankruptcy B2 (O-01, §5.1–5.2); a bankruptcy filing of either kind (liquidation, or a Chapter 11 Subchapter V reorganization) fails the survival window it falls in, a reorganized run is measured normally afterwards, and the bankruptcy rate is reported split by kind (§5.1); the multi-claim options (several plant lines per claim, small crews without a foreman, a district shop pool) add levers and risks but no new targets, and every bot keeps their defaults unless its row says otherwise (§4.0, §8.4). The performance target follows DESIGN §2.13 (D-2.15); annual finance tests end on a per-climate season-year (DESIGN §11, §1 rule 6).
>
> **Owner:** economics. **Readers:** whoever runs `npm run sim:balance` after a phase, whoever changes a tuning value, and the reviewer who signs off a phase.
>
> **Conventions.** "DESIGN §N.M" is a section of DESIGN.md. "§N.M" with no prefix is a part of this file. Tuning keys are written in code font with the DESIGN section that owns them; this file holds none of their values. Money is year-1 USD; gold is troy ounces (raw = weighed metal, fine = pure gold content); volume is bank cubic yards (bcy).

---

## 1. Purpose and how to use this file

The brief asks for a game with "thin margins, big capital bets, incomplete information about the ground, and cash flow that can kill a profitable operation", tuned to real-world magnitudes and checked by a headless simulator. This file turns that request into numbers the simulator can check, and says how the check is run.

| Part | What it holds |
|---|---|
| 2 | Calibration targets (`T-xx`): properties of the generated world and of fixed reference operations ("fixtures"), checked without bots |
| 3 | Outcome targets (`O-xx`): distributions of results when bots play many seeded games, and the section-owned bot gates (`G-xx`) the simulator runs |
| 4 | The bot strategies. Bots see only what a player sees |
| 5 | Metric definitions. Every target names its metric here |
| 6 | Simulator protocol: commands, seeds, games per cell, the matrix, runtime, outputs, regression tracking |
| 7 | Which targets apply and gate in which build phase, with interim bands for phases that lack systems |
| 8 | Tuning levers per target (exact keys, owner, direction), the procedure for changing one, and the levers and risks of the options the owner's 2026-10-05 rulings added |
| 9 | Preflight results against every target, the decisions the owner approved on 2026-10-05, and the owner's rulings of that date as applied here |
| 10 | The template for the report written after every phase (`docs/balance/phase-N.md`) |

**Rules.**

1. BALANCE owns targets, metric definitions, bot behaviour, the simulator protocol and the phase bands. DESIGN §2.12 owns the harness and DESIGN §2.12.1 the code catalog of bots, which implements Part 4. BALANCE owns **no tuning constants**: every key named here lives in the owning section's tuning table, and a change to a value is made there and logged in `data/tuning/CHANGELOG.md` (§8.2).
2. Where a section already publishes its own calibration table, BALANCE points to it instead of restating it: DESIGN §3.7 (world class shares), DESIGN §7.20 (reference operation), DESIGN §10.6 (gold price statistics), DESIGN §12.7 (event frequency and cost), DESIGN §12.15 (competitor busts) and DESIGN §14.13 (hard-rock classes). If a section and BALANCE disagree, the brief decides, then BALANCE, and the losing document is corrected in the same change.
3. Bots are frozen for a phase. A target is never "fixed" by changing a bot. A bot change is a separate, logged change that bumps `BOT_VERSION` and re-baselines every target (§6.7).
4. The brief's survival and profit targets (O-01 to O-03) are measured with the optional hard-rock track off (`game.hardRockEnabled` false), as DESIGN §14 OQ-14.2 sets (D-14.33; default confirmed by the owner on 2026-10-05, DESIGN §0 smaller call 8); O-04's dominance matrix is reported both ways and gates with it off. Hard-rock targets (T-17, O-19) run with it on.
5. **Status words.** Simulator output uses `PASS`, `AT-RISK` and `FAIL` (rules in §3.0). The preflight summary (§9) uses on-track, at-risk and off.
6. **Season-year.** DESIGN §11 ends the finance season-year per climate (`finance.seasonYearEndWeek`: northern week 52, arid week 26, because the arid prime season runs October–April) and dates its annual finance tests (the D-11.13 DSCR covenant, the revolver clean-up) by the company's primary climate. BALANCE's annual windows (B_N, S_N, the NW ratio by year, FSP, per-year tables and fixture seasons) stay game years, weeks 1–52, in every climate: the horizon must not depend on the district a bot picks, and on the mean calendar an arid game year holds the same weeks of each kind as an arid season-year. Only M-FLIP (T-08 d), which mirrors the annual DSCR test, counts season-years (§5).

---

## 2. Calibration targets

These are checked on generated worlds (500 seeds, no bots, `--world-only`) and on **reference fixtures**: fixed operations on fixed ground, run by the engine on the mean calendar with no events. Fixtures make production and cost targets deterministic, so bot noise cannot hide a broken constant.

### 2.1 Reference fixtures

Run with `npm run sim -- --fixture <id> --years 2`. Definitions live in `sim/fixtures/` (DESIGN §2.12); BALANCE owns them. Every fixture uses skill-50 operators, a skill-55 plant operator, the owner as a skill-40 foreman (no background edge; `matureNorth` adds a hired skill-70 foreman) and cleanup every 2 weeks, on a 40-block claim (80 for `matureNorth`), seasonal-road access 60 mi from town (25 mi arid). Every fixture runs one plant line per claim, a foreman on every claim (never DESIGN §8's small-crew exception) and any mechanic in site mode, so the multi-claim options of the owner's 2026-10-05 rulings (§8.4) move no calibration target.

**North reference claim:** uniform 0.012 raw oz/bcy in situ over a 5 ft pay + 1.5 ft bedrock-take column, 15 ft of overburden, permafrost 0.8, clay 0.15, boulders 0.20, size mix 25/40/27/8 (coarse/medium/fine/ultrafine), alloy fineness 0.86, creek water 600 gpm. **Arid reference claim:** 0.010 raw oz/bcy over 4 ft pay + 0.7 ft bedrock, 4 ft overburden, no permafrost, clay 0.25, boulders 0.10, cementation 0.3, size mix 10/30/40/20, fineness 0.78, no surface water.

| Fixture id | What it stands for | Fleet (P1 grade; N = new) | Plan | Terms |
|---|---|---|---|---|
| `starterNorth` | Bootstrapper starter | ex30 D, dz6 D with ripper, tr50 D fed directly by the excavator, pmp6 C, campT8 C, pickup D | north claim; 6 d × 11 h; strip 1 block ahead | lease 7% in kind, $2,000 advance royalty, local buyer, cash only |
| `refSmallNorth` | the DESIGN §7.20 reference operation | ex30 C, dz8 C, ld966 C (pad loader), adt30 C, tr75 N, 2 × pmp6 N, campT8 N, pickup C | north claim; 6 × 11 h; strip 1 block ahead | owned claim, local buyer, P1 payroll burden 1.22 |
| `refSmallNorthRoyalty` | Backed-royalty economics | as `refSmallNorth` | as `refSmallNorth` | 11% lease royalty + 10% investor royalty (attributable), $7,000 advance royalty, P1 |
| `refSmallNorthDebt` | DESIGN §11.15's canonical cash curve | as `refSmallNorth` | as `refSmallNorth`; year 2 starts with $400k cash on Jan 1 | $900k fleet debt at 10% / 60 months (level $19,122.34/month; variant `seasonal` Jun–Nov $38,896.80), 10% lease royalty, refinery sales, P4 burden 1.177, insurance, G&A $5,000/month, about $110k of the year's R&M paid as winter rebuilds in January–April |
| `matureNorth` | mature two-shift operation | 2 × ex45 B, dz9 B, dz8 C, 3 × adt40 B, ld980 B, tr300 N + cenL N, 2 × pmp10 N, gen300 N, campM25 N, 2 × pickup B; hired foreman (skill 70), mechanic, cook, 2 laborers per shift | 0.010 in a 6 ft pay column, permafrost 0.7; 2 shifts × 10 h × 6 d | lease 12%, $3.0M debt at 10% / 60 months, refinery, P3 availability by grade |
| `starterArid` | arid starter at typical water (DESIGN §7.20) | ex30 C direct feed, dz6 D, tr50 N + cenM N, gen100 N, pmp6 N, campT8 C, pickup C | arid claim; 6 × 10 h day shift all year; one well at 120 gpm (the median of the arid listing pool, DESIGN §3.2) plus one 4,000-gal water truck (58.5 gpm at an 8-mi fill point, DESIGN §7.6.6) | lease 4%, $2,000 advance royalty, local buyer |
| `starterAridWellOnly` / `starterAridWell300` | arid water sensitivity | as `starterArid` | the 120-gpm well alone / a 300-gpm well, no truck | as `starterArid` |
| `inheritorNorth` | Inheritor start on known ground | the DESIGN §1.8.2 inherited fleet (grade D; D6 with ripper) | north claim with its first 2 blocks pre-stripped (thaw 4.5 ft, the mean of U(3, 6)); 6 × 11 h | $320k estate note at 8.5% / 84 months on the seasonal schedule ($10,281.75 in each of June–November), no royalty |

**Fixtures under P1 rules** (DESIGN D-2.70, D-9.57; owner-confirmed 2026-10-06, DESIGN §0 0.24). Under P1 rules every fixture runs the P1 form of its terms, and the phase report labels each such run "P1 approximation": local buyer instead of a refinery, payroll burden 1.22, flat maintenance by grade with DESIGN §7's 0.92 availability (not P3 availability by grade), debt as fixed DESIGN §11 loans and no insurance. `matureNorth` builds DESIGN §9's phase-3 catalog rows (`ex45`, `dz9`, `adt40`, `ld980`, `tr300`, `cenL`, `pmp10`, `gen300`, `campM25`), which P1 markets never list, and carries its $3.0M as a fixed P1 loan. T-05 and T-07 gate on the P1 run, because they measure throughput and opex shares, which these substitutions do not move; T-08 (c) and T-11 stay reported. Fixtures are built by `newFixtureGame` (DESIGN D-2.69) on the mean calendar (DESIGN D-1.89) and run with staff noise off through fixture-only tuning overrides (`staff.quitHazardMult` 0, `staff.absence.base` 0), as they already run with no events; the bot matrix keeps morale, absences and quits on.

### 2.2 Targets

| ID | Target (source) | Band | Metric (§5) | Measured by | First checkable |
|---|---|---|---|---|---|
| T-01 | Placer grades mostly 0.005–0.03 oz/bcy, with rare rich pockets (brief) | (a) bcy-weighted grade of economically mined blocks (the DESIGN §3 yardstick's mined set on held claims; in game logs, the cautious bot's washed blocks): p10 ≥ 0.005 and p90 ≤ 0.045, per template (owner ruling 2026-10-06: aligned with DESIGN §3.18; was 0.035); (b) share of paystreak (f ≥ 0.4) blocks with in-situ grade in [0.005, 0.03]: ≥ 45% north, ≥ 40% arid; (c) pocket blocks (> 0.1 oz/bcy): 0.05–1.0% of paystreak blocks | M-GRADE | `sim:balance --world-only` (500 worlds) + cautious-bot game logs | P1 |
| T-02 | Most ground offered is marginal or uneconomic once stripping is counted (brief; DESIGN §3.7) | listing pool (steady-state listing weights, DESIGN §3.11), per template: uneconomic 60–72%, marginal 18–30%, good 5–10%, excellent 0.7–2.5% | M-CLASS-Y | `--world-only` | P1 (the P0 full-generator run decides any `gMed` retune, DESIGN §3.7 and D-3.36) |
| T-03 | The same, for the operation a player actually runs | engine EconTest with `refSmallNorth` costs (local buyer, 10% royalty): uneconomic 60–75%, good + excellent 5–12%; reported (no band) for `starterArid` at the median well, 6% royalty | M-CLASS-E | `--world-only --econ refSmallNorth` | P1 |
| T-04 | A small starter operation washes 30–75 bcy/hr (brief) | `starterNorth`, `inheritorNorth` and `starterArid` each 30–75 bcy per plant run hour in season 2; `starterAridWellOnly` reported (DESIGN §7.20 expects 28–30) | M-RATE | fixtures | P1 |
| T-05 | A mature operation washes 150–300+ bcy/hr (brief) | `matureNorth` ≥ 150 bcy per plant run hour and ≥ 250,000 bcy in season 2 | M-RATE | fixture | P1 (P3 with wear) |
| T-06 | Reference-operation anchor (DESIGN §7.20) | `refSmallNorth` season 2 (an established season, at least one block stripped ahead): 55–65k bcy and 450–650 raw oz; season 1 (frozen, nothing stripped ahead): 80–85% of season 2's bcy | M-RATE | fixture | P1 |
| T-07 | Fuel and wages dominate operating cost (brief) | for `starterNorth`, `refSmallNorth`, `matureNorth`, `starterAridWellOnly` and `inheritorNorth` in season 2: fuel + wages (with burden) ≥ 55% of site opex, R&M ≤ 30%, fuel ≥ 12%. `starterArid` is reported only: a trucked arid plant is where water, not fuel and wages, dominates (DESIGN §7.22) | M-OPEX | fixtures | P1, re-checked P3 |
| T-08 | Debt service and royalties decide whether a season was worth it (brief) | (a) `refSmallNorth` season-2 operating margin > 0; (b) `refSmallNorthRoyalty`: royalties ÷ operating margin in 0.5–1.5; (c) `refSmallNorthDebt`: (royalties + debt service) ÷ operating margin in 0.5–1.5; (d) in bot games from P4, 15–35% of the cautious bot's producing season-years (§1 rule 6) are M-FLIP season-years | M-MARGIN, M-FLIP | fixtures; cautious-bot logs | (a, b) P1; (c) P4; (d) P4 |
| T-09 | Equipment prices span $15k (tired small machine at auction) to $1.5M+ (new large dozer or wash plant); mid-size used excavators, loaders and rock trucks in the low-to-mid six figures (brief) | (a) typical tired-auction hammer of the smallest excavator (`ex13`, DESIGN §9.2.2) $10–20k; (b) new `dz9` list ≥ $1.5M and the `pkg300` dealer package ≥ $1.5M (DESIGN §9.2.3), a catalog data test on DESIGN §9's phase-3 data rows with the real brand multipliers (DESIGN D-9.57; P1 rules resolve brand multipliers to 1.0, D-9.71); (c) P1 used asks (FMV at the reference condition × `fleet.p1GradePriceMult`) of `ex30`, `ld966` and `adt30` at grades B and C each in $100–500k, evaluated on the hub dealer's standing graded-used offers (grade-midpoint age, hours = age × the median 1,150 h a year; DESIGN D-9.58, D-9.72; owner-confirmed 2026-10-06, DESIGN §0 0.25); from P3, the median private-listing ask of each of those models in $100–500k | M-PRICE | `vitest` catalog test; 500-world equipment-market sample from P3 | (b, c) P1; (a) and the market sample P3 |
| T-10 | Thin margins: the median paystreak block does not pay; good ground does | (a) `refSmallNorth` break-even in-situ grade at strip ratio 3, permafrost 0.8, 10% royalty, local buyer: 0.009–0.013 oz/bcy; (b) `matureNorth` ÷ `refSmallNorth` break-even with royalty at SR 3 on thawed ground (p 0), both at a refinery, each with its own fixture royalty: ≤ 0.85 (the definition is thawed ground because an established mature operation strips a season or more ahead, so its pay is thawed; R-4, approved by the owner on 2026-10-05); the same ratio at p 0.8 is reported and carried as a named O-04 risk (preflight 1.02: on frozen ground the mature fleet has no unit-cost edge); (c) frozen ÷ thawed opex-only break-even of `refSmallNorth` at strip 3 = 1.38 ± 0.05, and DESIGN §3's yardstick ratio within ± 0.05 of the engine's (DESIGN §7.23, §3.7) | M-BE | fixtures (`--breakeven`) | (a, c) P1; (b) tracked from P1, gating with O-04 at P4 |
| T-11 | Cash flow can kill a profitable operation (brief; DESIGN §11.15) | `refSmallNorthDebt` year 2, level schedule: lowest month-end cash falls in May–July; drawdown from Jan 1 to that low ≥ 20% of the year's ops outflows; the year nets > 0 | M-TROUGH | fixture | P1 (fixed loan), gating P4 |
| T-12 | Season lengths (brief: northern 20–26 weeks; DESIGN §1.4, D-1.3) | over 500 seeds: north site season (operating weeks) median 20–24 with P5 ≥ 19 and P95 ≤ 25; north full-rate sluicing weeks median 18–22; arid effective day-shift weeks median 44–49 | M-SEASON | `--world-only --calendar` | P1 |
| T-13 | Gold price statistics (brief; DESIGN §10.6) | every row of DESIGN §10.6 inside its pass band, at standard and per difficulty | DESIGN §10.6 | `npm run sim -- --market-only --games 2000 --years 10` | P5 |
| T-14 | Event frequency and cost (DESIGN §12.7) | at `refSmallNorth` with events on: 3–6 player-affecting events per year; a major or external shock in 40–55% of years; a catastrophic event in 5–12% of years; unprepared, uninsured event cost 3–6% of gross revenue; prepared and insured 1.5–3% | M-EVENT | `sim:balance --events-only` (500 × 5 years) | P3 (equipment events, reported), P5 (all, gating) |
| T-15 | Permitted ground is scarce but reachable (DESIGN §3.11, §5.20, §6.20) | (a) every starting district's initial market holds a starter permitted lease; (b) ≥ 8% of northern listings carry true transferable plan authority, measured on the steady-state listing pool | M-PERMIT | `--world-only` | P2 |
| T-16 | Owner-background and difficulty knobs resolve as specified (DESIGN §1.11, §1.22) | every difficulty-scaled key resolves exactly once to its DESIGN §1.11 value; setup books the DESIGN §1.22 balance sheets (e.g. owner NW $520k Bootstrapper, $250k Backed, ≈ $280k Inheritor in P1 and ≈ $238k from P2, with R-3's $300k Inheritor company cash) | unit test | `vitest` | P1 |
| T-17 | Hard-rock targets are as rare as placer ones (DESIGN §14.13; optional track) | lode-system class shares under `refEconomicsLode` (uneconomic / marginal / good / excellent) 65–78 / 15–25 / 5–10 / 0.5–2.5%; reference projects R1–R3 cash costs within ±15% of DESIGN §14.13 | M-CLASS-L | `--world-only` with `game.hardRockEnabled` (200 worlds) | P6 |

---

## 3. Outcome targets

### 3.0 Pass rules (all outcome targets)

- Proportions carry a 95% Wilson interval. Medians, other quantiles and ratios carry a 95% percentile-bootstrap interval of 1,000 resamples (`sim.bootstrapResamples`), seeded by the cell label and the metric, so a rerun reproduces it. Quantiles are Hyndman–Fan type 7 (linear interpolation between order statistics, the R and NumPy default). A pooled value that is an equal-weight mean of start proportions (O-01, O-02) and a difference of two proportions (O-18) carry a normal-approximation interval, because Wilson's interval is defined for a single proportion. summary.json's `methods` names the proportion, quantile and bootstrap methods (DESIGN D-2.56).
- **PASS:** the point estimate is inside the band.
- **AT-RISK:** the point estimate is outside the band but the band edge lies inside its 95% interval; or, for a target checked under two rule sets or start types, it passes in one and not the other.
- **FAIL:** the band edge lies outside the 95% interval.
- A one-sided band ("≥ 75%") has one edge; a target with several clauses (O-01's S2 band and B2 floor, for example) takes the status of its worst clause, and the scorecard prints every clause.
- A phase is signed off with no FAIL among the targets §7 marks gating for that phase and no FAIL among DESIGN §1.19's exit gates. Every AT-RISK needs a sentence in the phase report.
- Default sample: **500 seeded games per cell** (§6.3). A cell is bot × start × difficulty × background × entity × rule phase.

### 3.1 Brief targets

| ID | Target | Metric | Band | Sample | Pass rule |
|---|---|---|---|---|---|
| O-01 | A careful player on standard difficulty survives the first two seasons about 60–70% of the time; gated both ways (owner ruling 2026-10-05; DESIGN D-1.49, D-2.16) | going-concern S2 (§5.2) **and** no-bankruptcy B2 (§5.1), `cautious`, standard, background `none`; a bankruptcy filing of either kind (liquidation or reorganization) in seasons 1–2 fails both; the reorganization share RS2 and the retreated share B2 − S2 are printed beside them | **pooled S2 60–70% and pooled B2 ≥ 75%** (interim bands by phase in §7); pooled = equal-weight mean of Bootstrapper, Backed (equity and royalty averaged) and Inheritor. B2 per start is reported; the pooled B2 gates | 500 per start and term = 2,000 games (pooled interval ±2.1 pp for S2 near 65%, ±1.9 pp for B2 near 75%) | §3.0 on each pooled value; both clauses must pass; each start's S2 is checked by O-06 |
| O-02 | A first-season profit is possible but not typical | FSP (§5.6) | `cautious` pooled 15–35%; every bot ≤ 45%; at least one bot ≥ 10% | O-01's games plus every core-matrix bot | §3.0; "every bot" and "at least one bot" are both scored on the highest FSP among the core block's cells (standard difficulty, background none, LLC, the run's rules; §6.4) |
| O-03 | An undercapitalized, untested-ground strategy usually fails | `undercap` S2 and B2 (§5.1) | S2 3–35% and B2 ≤ 40% (DESIGN §11.27: a bankruptcy filing of either kind, 1 − B2, in ≥ 60% of runs by year 2). "Usually", not "always": a lucky run must stay possible | 500 | §3.0 on both |
| O-04 | No single strategy dominates | dominance matrix (§5.9) per start type over `cautious`, `balanced`, `aggressive`, `undercap` (Bootstrapper) and the named bots active in the phase, on three metrics: S2, median owner NW ratio at year 5, p90 owner NW ratio at year 5 | no bot dominates every other bot; `aggressive`'s year-5 p90 NW ratio ≥ 1.15 × `cautious`'s; `cautious` S2 ≥ `aggressive` S2 + 10 pp; none of `leaseOnly`, `buyOnly`, `gradeDFleet`, `gradeAFleet`, `auctionOnlyFleet`, `rentOnlyFleet`, `allHardMoney`, `royaltyEveryWinter`, `smallCrewNoForeman`, `multiLine`, `poolMechanics` dominates `cautious` (DESIGN §5.20, §9.16, §11.27; the last three test the options of the owner's 2026-10-05 rulings, DESIGN D-2.32, §8.4) | 500 per bot × start, 5 years | FAIL on any strict dominance; AT-RISK when dominance holds within interval overlap |

### 3.2 Design targets

| ID | Target | Metric | Band | Sample | Pass rule |
|---|---|---|---|---|---|
| O-05 | Difficulty ordering (brief: honesty of ground information, lender patience, event severity) | S2, B2 and median NW ratio (years 2 and 5) for `cautious` (Bootstrapper, Backed equity) and `undercap` | easy > standard > hard in `cautious` S2 by ≥ 8 pp per step; NW medians strictly ordered; B2 monotone the same way | 500 per cell on common seeds | paired test per step (McNemar, 95%); FAIL if any step reverses |
| O-06 | Start-type parity (DESIGN §1.21, §1.22, §1.8.1) | `cautious` S2 per start; year-5 owner-ahead share and median owner NW ratio per start; Inheritor season-1 production attempt (§5.7); Backed-equity loss rates | (a) each start's S2 in 50–80% (within 10 pp of 60–70%); (b) the owner-ahead share at year 5 (§5.3, approved) differs by ≤ 20 pp between any two of Bootstrapper, Backed equity, Backed royalty and Inheritor (medians reported; about half the Backed games end on the equity-waterfall floor, so a median test flips on a few seeds); (c) Inheritor attempt ≥ 80%; (d) Backed equity: among runs with two losing seasons (company-book net income < 0 in years 1 and 2), P(ouster, a forced redemption, or a reorganization filed while a redemption demand is open, by the end of season 3) 40–70%, and the two-season loss rate 1 − B2 (a bankruptcy filing of either kind, or ouster) of all runs 8–25%; Backed royalty's loss rate is reported without a band (DESIGN D-1.50); B2 per start is reported beside (a) | 500 per start (× 2 terms for Backed) | §3.0 per start and clause |
| O-07 | Owner-background parity (DESIGN §1.7, §1.22) | `cautious` S2 per background (Operator, Mechanic, Geologist, Banker, Landman) for Bootstrapper and Backed equity; median NW ratio | each background's S2 within ±5 pp of the five-background mean (±7 pp in P1–P2, while the Mechanic, Banker and Landman edges run on stubs); Geologist median NW ratio ≤ 1.15 × the other four backgrounds' median (DESIGN §4), using the owner-ahead share (§5.3, approved) in place of the median for a start whose median sits on the waterfall floor. Bots keep the owner as foreman (§4.0), so this gate reads the defaults; `smallCrewNoForeman` measures the small-crew option (§8.4) | 500 per background × start, 2 years | §3.0, band = mean ± 5 (7) pp |
| O-08 | Value of information: testing pays | `cautious` vs `noTest` on common seeds, Bootstrapper and Backed equity | S2 gain ≥ +10 pp; median NW ratio gain at year 2 ≥ +0.10 (for a start whose median sits on the waterfall floor: owner-ahead share gain ≥ +5 pp, §5.3, approved); `cautious` testing spend (screening + pits in year 1) 3–15% of its first-season capital commitment (land or advance royalty, fleet, mobilization) | 500 pairs per start | paired test, one-sided 95% |
| O-09 | Value of maintenance (P3+) | `cautious` vs `noMaintenance` | over 5 years: S2 loss ≥ 8 pp and median NW ratio loss ≥ 0.10; **and** in season 1 `noMaintenance` has the higher operating margin (skipping PM must tempt) | 500 pairs | both; FAIL if skipping maintenance wins on NW at year 5 |
| O-10 | Hedging trade-off (P5) | `cautious` vs `hedge50` | `hedge50` cuts the p90 − p10 spread of the year-3 NW ratio by ≥ 15%, and cuts the bankruptcy rate (BK_N: a filing of either kind, §5.1) by ≥ 5 pp among seeds whose gold falls ≥ 15% in year 1; its median NW ratio lies within −8% to +3% of `cautious`'s (a cost, not a free lunch) | 500 pairs | all three |
| O-11 | Gold price behaviour (DESIGN §10.6, §10.5) | the DESIGN §10.6 table plus P(gold falls more than 15% in year 1) | DESIGN §10.6 bands; year-1 fall > 15% in 8–16% of seeds (DESIGN §10.5 states 12%) | 2,000 × 10 years, market only | every row in band |
| O-12 | Competitors (DESIGN §12.15, §12.24) | busts per competitor-year by `goldMomentum` bucket; active competitor count; contested-listing win share; auction hammer lift | busts 3–8%/yr when momentum > +0.10 and 20–35%/yr when < −0.15; active count within [0.5, 1.5] × `ai.competitorCount` in ≥ 95% of years; competitors win 35–60% of contested listings; competitor bidding lifts the median auction hammer 5–10% in bull years | 500 × 10 years | §3.0 per clause |
| O-13 | Session length and pacing (DESIGN §2.7, §13.9, §2.13) | stops of `runToNextDecision` per game-year of exposure (§6.6) under `defaultStopRules()` (`cautious`); weeks per stop; engine time per game-week, explanations off | 25–60 stops per year; ≤ 10 stops from freeze-up to breakup (per northern off-season, §6.6); no run of ≥ 26 weeks without a stop in an operating season; engine time ≤ 3.5 ms mean and ≤ 8 ms p95 per game-week, explanations off (DESIGN §2.13, D-2.15; `sim.perf.weekMeanMs`, `sim.perf.weekCeilingMs`) | 500 | §3.0; the two engine-time clauses are scored on the console, not in summary.json (§6.6) |
| O-14 | Cost per ounce is realistic and thin | cash cost/oz and AISC/oz (§5.4) of `cautious` producing seasons, standard, by start | P1 (local buyer, flat $4,200, realized ≈ $3,667 per fine oz): cash cost/oz median $2,600–3,600 and AISC/oz median 75–100% of realized; P5: AISC/oz median 70–90% of realized | all producing seasons in O-01's games, 5 years | §3.0 on medians |
| O-15 | Share of claims that were profitable (brief simulator output) | M-CLAIMPROFIT (§5.5) over 5 years | `cautious` (every claim of the four starts, claim-weighted) 35–60%; `aggressive` Bootstrapper 25–50%; `undercap` ≤ 25% | every claim acquired in O-01, O-03 and O-04 games | §3.0 |
| O-16 | Arid is not easy mode, and is a real option (DESIGN §1.21) | share of `cautious` games whose first claim is arid | 15–70% | 500 per start | §3.0 |
| O-17 | Events are not the main killer (DESIGN §12.23) | share of bankruptcy filings of either kind (liquidations and reorganization filings, one per run, §5.10) preceded by a major or catastrophic event | ≤ 35% | every run with a filing in O-01 to O-04 games | §3.0 |
| O-18 | Entity choice is balanced (DESIGN §1.21, §1.22) | `cautious` S2 as sole proprietor vs LLC, Bootstrapper | within 5 pp | 500 per entity | §3.0 |
| O-19 | Hard rock is a reward, not a default (DESIGN §14.13, §14.20; optional track) | `hardrockSeeker` vs the best placer bot, 10 years, hard rock on | 35–55% of fully explored (`indicated`) lode targets reach production; 25–45% of producing projects fail to repay capital within 5 years; median realized ÷ estimated grade 0.75–0.95; hard rock lifts year-2 S2 by ≤ 2 pp; `hardrockSeeker`'s median year-10 NW ≤ 2 × the best placer bot's | 500 × 10 years | §3.0 per clause |

### 3.3 Section-owned bot gates

The simulator also runs these gates. The owning section sets the band; BALANCE runs the cells and reports them in the phase report.

| ID | Gate (owner) | Band | Phase |
|---|---|---|---|
| G-01 | `leaseOnly` vs `buyOnly` (DESIGN §5.20) | no strict dominance; on the Bootstrapper, leasing survives more often | P1 |
| G-02 | `gradeDFleet` vs `gradeAFleet` vs `cautious` Bootstrapper fleets, 3 seasons (DESIGN §9.16, §9.17) | neither dominates | P1 (full in P3) |
| G-03 | `passive` sanity (DESIGN §2.12.1) | survives 5 years unless the start carries debt: scored as no-bankruptcy B5 = 100% over the debt-free starts (Bootstrapper and both Backed terms), because `passive` never washes, so its S_N is always 0 | P1 |
| G-04 | `exceeder` (DESIGN §6.20) | does not beat `cautious` on 5-year median NW by more than 10%, and its bankruptcy rate (BK_5, either kind, §5.1) is not lower | P2 |
| G-05 | `abandoner` (DESIGN §6.20) | lower 3-year NW than `cautious` on the same seed in ≥ 95% of seeds | P2 |
| G-06 | `auctionOnlyFleet`, `rentOnlyFleet`, `brandOnly` (DESIGN §9.16) | `auctionOnlyFleet` does not dominate `cautious`; renting everything loses over 3 seasons; no brand dominates on every access class | P3 |
| G-07 | Reference-fleet R&M (DESIGN §9.16) | R&M + PM + parts ≈ $130–180 per fleet hour; mechanic load 60–85% with one mechanic | P3 |
| G-08 | `allHardMoney`, `royaltyEveryWinter` (DESIGN §11.27) | neither dominates the matrix | P4 |
| G-09 | Market sanity (DESIGN §5.20) | median accepted private price 75–85% of ask; median auction hammer ÷ V_claimed 0.45–0.70 | P5 |

---

## 4. Bot strategies

DESIGN §2.12.1 implements these rules in `sim/bots/catalog.ts`. Bot version 1.0 (`BOT_VERSION`) carries six rules, each marked *(refined)*, that the preflight model showed the first version of these rules got wrong: the reserve, the owner-foreman, the cautious starter-tier grade, the mechanic hire, the arid water truck and the aggressive bot's affordability test. Without them the bots do not behave as the brief describes. R-2 is approved by the owner (2026-10-05; §8.3, DESIGN D-2.29): DESIGN §2.12.1's catalog carries these six rules in substance and documents bot version 1.0. Version 1.0 also fixes how bots treat what the owner's rulings of 2026-10-05 added: they keep the defaults of the multi-claim options and answer an involuntary petition with a reorganization (§4.0; DESIGN D-2.32, D-2.33). No code exists yet, so these rules are part of version 1.0, not a bump.

### 4.0 Rules common to every bot

- A bot implements `Bot.decide(state, view): Action[]` (DESIGN §2.12) and reads only player-visible selectors: listings and seller evidence, its own estimates (DESIGN §4 P10/P50/P90), DESIGN §7 previews and hints, DESIGN §9 visible condition and prices, DESIGN §10 spot and history, DESIGN §11 forecasts. A test scrambles every hidden field and asserts an identical action stream.
- Bots act at decision points: setup, every operating week, every cleanup, breakup, freeze-up, month end and every stop reason. A quiet week returns no actions. A pending decision gets the option the bot's rules pick, else its default, else (a blocking decision with no default) its lowest option id, the tie-break by id. A blocking decision a bot leaves open stops that game as a bot defect (DESIGN §2.12, D-2.53).
- Shared helpers (one implementation): `evaluateClaim(view, claimId, fleetPlan)` = visible claim value at P10/P50/P90 using the bot's planned fleet costs from DESIGN §7 `projectOpsVisible`; `sizeFleet(view, claimId, budget)`; `cashPlan(view)` = DESIGN §11 `forecast13Week` plus the bot's own season projection.
- **Reserve** *(refined)*: "a reserve of N weeks" means that at season start, company cash plus the owner's personal cash covers the largest cumulative net cash outflow (outflows minus projected gold receipts) over the next N weeks of `cashPlan`. A gross 13-week outflow (≈ $400k for a starter fleet) would stop every Bootstrapper from operating.
- **Crew** *(refined)*: hire at the ask; minimum crew for the fleet (DESIGN §8). The owner is the foreman (ops skill 85 with the Operator background, else 40, `staff.ownerOpsSkillByBackground`); a bot hires a foreman only for a second claim, or when a claim's plant lines exceed `staff.foremanMaxLines`; one foreman, the owner included, covers both shifts (DESIGN §8's foreman rule, D-8.18, D-8.33). The minimum crew includes ceil(people on site ÷ `staff.crewPerCook`) cooks (DESIGN §8 `crewRequirement`, D-8.69); this is version 1.0's first P1 definition, written here before any baseline exists, not a retune (DESIGN D-2.75). The first version hired a $125k foreman for every non-Operator owner, which no starter budget carries.
- **Defaults for the multi-claim options** (owner rulings of 2026-10-05; DESIGN D-2.32). Every bot plans each claim with one plant line (L1) and never adds another; never runs a claim under DESIGN §8's small-crew rule (a claim with no owner-foreman gets a hired foreman, even with three hands or fewer); and posts every mechanic or welder it hires to the site of the claim it serves (site mode), never to a district pool. Only `smallCrewNoForeman`, `multiLine` and `poolMechanics` (§4.5) depart from these, one option each. The preflight bots (§9) had none of these options, so the defaults keep version 1.0 comparable with them.
- Tracked estimates: owned claims plus at most `geology.maxTrackedClaimsSim` (8) others (DESIGN §4).
- Never reads the end-of-run reveal. Bots use no RNG; ties break by entity id.
- **Last resort in P1–P3** (every bot): when DESIGN §11's P1 insolvency counter has been open for `finance.p1InsolvencyGraceWeeks` − 1 weeks, sell the fleet to a dealer at 0.80 × resale (`fleet.p1DealerCashShare`). This is a distress sale (§5.2). Under P1–P3 rules there is no reorganization (DESIGN D-11.73).
- **Bankruptcy from P4** (DESIGN D-2.33). A bot never files on its own initiative, neither `owner/fileBankruptcy` (liquidation) nor `finance/fileReorganization`. When an involuntary trigger fires and DESIGN §11.16.1 offers the blocking `finance.involuntaryPetition` decision, it answers *reorganize* (an LLC or corp owner does not join as guarantor). By the plan deadline it files `finance/fileReorgPlan` with the first terms for which `reorgPlanPreview` shows both confirmation tests passing, tried in this order: 156, 208, then 260 weeks, each with a level schedule and then a seasonal one; reserve 5%; no surrenders, lease rejections or owner contribution. If none passes it files nothing and the case converts to liquidation; after a denial it files the next passing terms as its one amended plan. During the plan it pays installments before any discretionary spend and otherwise plays by its own rules. A company that is not eligible to reorganize is liquidated by the trigger. The rule acts only where a liquidation would otherwise follow, so it fails the same survival window the liquidation would (§5.1) and changes only what is measured afterwards.

### 4.1 `cautious` (the brief's careful player)

| Area | Rule |
|---|---|
| Starts | any |
| Ground | Records review and site visit on the 6 best listings by visible prior (claimed ounces; from P2, verified transferable plan authority ranks first, after a $250 records check on each candidate). Tests the top 2 with its own excavator pits (contractor if it has no machine) until DESIGN §4 class `indicated` (≥ 75 bcy processed, `geology.confIndicatedMinProcessedBcy`; about 15 five-yard pits) before committing more than 25% of company cash. Commits only if P50 claim value > 0 and P10 > −15% of company cash. Prefers a lease or lease-with-option; buys only when the negotiated price is ≤ 35% of company cash. Avoids northern winter-trail and fly-in ground. P2+: without authority in hand it files a plan of operations and waits; it buys iron only when authority is near. |
| Fleet | `sizeFleet` picks the largest tier (reference, mid, starter) whose iron costs ≤ 60% of liquidity (company + personal cash) and whose iron + moves + 13-week reserve fit liquidity. Used grades B–C, except that the starter tier's excavator, dozer and plant are grade D *(refined)*, because B–C would break the 60% cap on a Bootstrapper. **Mechanic** *(refined)*, in site mode at the claim it serves: P1–P2, hires one when 30% of projected season maintenance (`fleet.p1InHouseMaintMult` 0.70) exceeds the mechanic's projected season wages (≈ $115k north at 6 × 11 h, so ≈ $385k of maintenance); from P3, when projected maintenance exceeds $120k a season, because breakdowns, field service and downtime then make the shop pay (DESIGN §9.16). |
| Operations | North 6 × 11 h, arid 6 × 10 h day shift. Strips ≥ 2 blocks ahead before freeze-up when capacity allows. Cleanup every 2 weeks. Takes a DESIGN §7 hint whose payback is < 8 weeks. Arid *(refined)*: one water truck only when the well alone cannot hold 20 bcy/hr (at the median well a truck adds ≈ 11 bcy/hr for ≈ $437k a year and turns a −$28k season into a −$155k one, §9.2). |
| Finance (P4+) | Equipment loans ≤ 50% of fleet cost; a seasonal schedule when offered; no hard money, MCA, or cards beyond float; insurance as lenders require, plus GL. |
| Sales | P1: local buyer every cleanup. P5: refinery whenever a lot meets a refinery minimum (5 raw oz at Northlight, DESIGN §10.11); forwards ≤ 25%, only when a lender requires. |
| Exit | Stands a claim down after two cleanups with negative visible margin and a re-estimate with P50 < 0. At season end, sells idle iron if liquidity < the reserve. Re-enters when cash ≥ fleet cost + reserve. |

**P1 reading of the rules above** (DESIGN D-2.75; version 1.0's first definition, not a retune).
- **Ground in P1.** P1 allows only pans, records and seller claims on listings (DESIGN D-4.29), so `cautious` cannot pit a listing. Its P1 sequence: records review and site visits with pans on the 6 best listings by visible prior → lease the top 2 at low advance (Σ advances ≤ 25% of company cash; a lease or lease-with-option preferred) → own or contractor pits on the leased ground to `indicated` → keep or surrender (surrender if P50 < 0). A top listing offered for sale only is bought only on the commit rule (P50 > 0 and P10 > −15% of cash) on pan and records evidence. O-08's testing-spend denominator stays as written (land or advance royalty, fleet, mobilization).
- **Fleet tiers** (data in `sim/bots/fleetTiers.ts`): **starter** = the `starterNorth` / `starterArid` fleets; **reference** = the `refSmallNorth` fleet; **mid (north)** = `refSmallNorth` without the `adt30`, with a `dz6` (ripper) for the `dz8` and an `ld950` for the `ld966`; **mid (arid)** = `starterArid` with a `tr75` for the `tr50`. Tiers are priced on DESIGN §9's standing dealer graded-used offers (D-9.58) at grades B–C, with the starter tier's excavator, dozer and plant at D. The mid tier was confirmed by the owner on 2026-10-06 (DESIGN §0 0.26).

### 4.2 `balanced`

As `cautious`, except: tests only the best listing, with pits until `inferred` (6 bedrock samples, `geology.confInferredMinBedrockSamples`); commits on P50 > 0 with P10 > −30% of cash; iron ≤ 75% of liquidity; reserve 8 weeks; equipment loans to 70% of cost (P4+).

### 4.3 `aggressive`

Seller evidence plus ≤ 3 pits on each of the top 3 affordable listings by claimed ounces; takes the largest claimed resource it can afford (the pits only veto a listing whose P50 value is below −$250k). *(refined)* A listing is affordable when its price plus the planned fleet fits liquidity (company + personal cash, plus from P4 the financing it can raise); the fleet tier is the largest whose iron + moves + a 4-week reserve fits the same liquidity. The first version bought ground it could not then equip and sold its fleet before mining. Fleet 1.3 × `sizeFleet` plus a second truck, reserve 4 weeks; new or grade A–B when dealer or captive finance is offered (P3+), else B–C. 7 × 12 h with overtime and 15% overfeed. P4+: equipment loans at the maximum LTV and term (the startup cap, `finance.startupCapUsd`), hard money when short. Second claim from year 2 if season 1's operating margin > 0. P5: forwards up to 50% of the next 26 weeks' expected production. Never stands down before the insolvency counter reaches grace − 2 weeks.

### 4.4 `undercap` (the brief's undercapitalized, untested-ground strategy)

Bootstrapper only. No testing: seller evidence and records only. Buys the listing with the best claimed ounces per asking dollar (leases it if the price exceeds half its cash). Cheapest fleet that can wash: grade D, excavator-direct starter, no ripper. No reserve. P4+: equipment finance at the startup cap and hard money when short. Sells iron only when the insolvency counter is open.

### 4.5 Named bots

Each is `cautious` with one change, so its difference from `cautious` on common seeds measures one mechanic. The names match DESIGN §2.12.1.

| Bot | Change | Measures | From |
|---|---|---|---|
| `noTest` | skips pits: seller evidence, records and site visits only | value of information (O-08) | P1 |
| `heavyProspector` | 3 × the testing budget | diminishing value of information (DESIGN §4) | P1 |
| `leaseOnly` / `buyOnly` | only leases / only buys | lease vs buy (G-01) | P1 |
| `gradeDFleet` / `gradeAFleet` | buys only grade D / only grade A or new | cheap-iron trap (G-02) | P1 (full P3) |
| `maxHours` | 7 × 12 h every operating week | overtime, fatigue, wear and morale trade-off | P1 (injuries P2) |
| `noStripAhead` | never strips ahead | first-season thaw constraint (T-06, O-02) | P1 |
| `passive` | never operates; holds cash and the start's assets | fixed and holding costs (G-03) | P1 |
| `exceeder` | exceeds every exceedable permit condition | enforcement deterrence (G-04) | P2 |
| `abandoner` | relinquishes mined-out claims unreclaimed | reclamation liability (G-05) | P2 |
| `smallCrewNoForeman` | runs any claim whose crew (excluding the owner) is 3 or fewer, on one shift and one line, with no foreman under DESIGN §8's small-crew rule; the owner stays in the office and spends the freed desk days on records, permits and site visits | value of a foreman on tiny operations; background parity once the owner need not supervise (O-04, O-07; §8.4) | P1 |
| `noMaintenance` | skips all PM, defers repairs to failure | value of maintenance (O-09) | P3 |
| `multiLine` | on any claim where DESIGN §7 allows a second plant line, adds one once the first line's plant has been feed-limited for 4 operating weeks and the visible water and stripping capacity carry both lines (`projectOpsVisible` with two lines ≥ 1.5 × one line's washed bcy); buys the second plant, its dig–haul–feed spread and pump on the `cautious` fleet rules, and hires its plant operator | several plant lines against duplicated plant capital, shared water and stripping, and supervision (O-04; §8.4) | P3 |
| `poolMechanics` | posts every mechanic and welder to its district's pool once it runs two or more road-access claims in that district, and hires pool mechanics on the `cautious` rule applied to the district's summed maintenance | district shop pool against site shops: fewer mechanics for many claims against travel hours and response delay (O-04; §8.4) | P3 |
| `auctionOnlyFleet` / `newOnlyFleet` / `rentOnlyFleet` / `brandOnly(brandId)` | iron only at auction (bids ≤ 0.85 × visible FMV) / new only / rents everything / one brand only | equipment-market balance (G-06) | P3 |
| `allHardMoney` | funds every shortfall with hard money | expensive-money trap (G-08) | P4 |
| `royaltyEveryWinter` | sells a royalty each winter | selling production (G-08) | P4 |
| `hedge50` / `noHedge` | forwards 50% of the next 26 weeks' production / never | hedging trade-off (O-10) | P5 |
| `alwaysLocalBuyer` | never ships to a refinery | refinery value; the P1 → P5 revenue shift (DESIGN §10.20) | P5 |
| `hardrockSeeker` | pursues the DESIGN §14 track once its develop readiness holds | hard-rock balance (O-19) | P6 |

---

## 5. Metric definitions

All money is nominal unless marked real (÷ `cpiIndex`, DESIGN §10). "Season N" is game year N (weeks 1–52 of year N) in every climate, and a fixture's "season 2" is its game year 2: an arid game year holds one of each part of the arid year (the end of one prime season, the summer low, the start of the next prime season), so on the mean calendar its steady-state totals equal a season-year's (§1 rule 6). A **season-year** is DESIGN §11's finance year: the weeks from one annual finance test to the next (the first runs from the start of the run to the first test), each test falling at `finance.seasonYearEndWeek` of the company's primary climate (northern 52, arid 26; the primary climate is that of the district with the most operated bcy over the trailing 52 weeks, northern if none). Only M-FLIP counts season-years. The simulator computes every metric from engine selectors, never from bot-side estimates.

**5.1 Loss, bankruptcy filings and no-bankruptcy B_N** (owner ruling 2026-10-05: survival is gated both ways, and a filing of either kind fails the window; DESIGN D-1.49, D-2.16).
- A run is **lost** when (a) it is **liquidated**: in P1–P3, DESIGN §11's P1 insolvency counter opens at t0, the first step 15 with an open arrear, and an arrear still remains at step 15 of turn t0 + `finance.p1InsolvencyGraceWeeks` (8 / 6 / 4 by difficulty; DESIGN D-11.84) (cause `p1Counter`); from P4, a Chapter 7 liquidation under DESIGN §11.16: the player files `owner/fileBankruptcy` (cause `filed`), an involuntary trigger fires (3 consecutive short payroll runs, or 13 weeks at stage ≥ 4 with negative distressed asset value) on a company that is not eligible to reorganize or chooses liquidation (cause `involuntary`), or a reorganization case converts (cause `converted`, DESIGN §11.16.5); (b) the investor ousts the owner (DESIGN §1.8.1, `runStatus = 'lost'`, reason `ousted`); or (c) a scenario is lost by a missed deadline or a forfeit (scenario runs only).
- A **reorganization filing** (P4+) opens a DESIGN §11.16.1 Chapter 11 Subchapter V case through `finance/fileReorganization`, filed by the player or in answer to an involuntary petition. It does not end the run: `runStatus` stays `'active'` (DESIGN D-2.30). Under P1–P3 rules there is no reorganization (DESIGN D-11.73), so every P1–P3 bankruptcy is a liquidation.
- A **bankruptcy filing of either kind** is a liquidation or a reorganization filing.
- **B_N** = at the end of week 52 of year N (after the pipeline of turn 52N − 1: turn 0 is `newGame`'s year 1 week 1, so year 1 runs 51 pipelines; DESIGN §2.12, D-2.52) the run is not lost **and** it made no bankruptcy filing of either kind in years 1..N. A filing fails both B_N and S_N (§5.2) for every window that contains it. The windows are cumulative, so a filing in year k fails B_N and S_N for every N ≥ k and for no N < k.
- **A reorganized run keeps playing.** Every other metric (net worth, the NW ratio and owner-ahead share, FSP, cost per ounce, production, claims profitable, M-FLIP) is measured on it as on any active run (§5.3 for its net worth), and it is lost only if its case converts or another loss follows.
- **Reorganization share RS_N** = share of games with a reorganization filing in years 1..N, whatever followed. It is printed beside every B_N and S_N and gates nothing. It is zero under P1–P3 rules.
- **Bankruptcy rate, split by kind** (owner ruling 2026-10-05). **BK_N** = share of games with at least one bankruptcy filing of either kind in years 1..N, each game counted once; for a run with no equity investor and no scenario, BK_N = 1 − B_N. It is always printed with its two parts, which can overlap: the **liquidation rate** L_N (games liquidated by the end of year N, by cause: `filed`, `involuntary`, `converted`, `p1Counter`) and the **reorganization-filing rate** RS_N, with each case's status at the end of year N (completed, converted, or open: filed or confirmed). A case that converts counts in both parts and once in BK_N. Wherever a target says "bankruptcy" (O-03, O-10, O-17, G-04) it means BK_N.

**5.2 Going-concern survival S_N** (the brief's "survives"; canonical here, DESIGN §2.12 and §1.22 cite it). S_N = B_N (so no bankruptcy filing of either kind in years 1..N, §5.1) **and** washed bcy > 0 in at least one of seasons 1..N **and** no distress fleet sale (a dealer or quick sale of fleet while the insolvency counter is open or distress stage ≥ 3; read from DESIGN §9's sale log, `FleetSaleEvent.distress`, and `distressFleetSale`, D-9.69) **and**, at the end of season N, the company either holds at least one claim plus a fleet that can wash ≥ 20 bcy/hr, or has company cash ≥ $150,000 × `cpiIndex`. B_N is always reported next to S_N, with the reorganization share RS_N; B_N − S_N is the "retreated" share.

**5.3 Net worth.** Owner net worth per DESIGN §1.13 (`netWorth(state, 'scoring')`): the owner's share of company NW after the equity waterfall (for Backed equity: the investor's claim is the greater of 1.0 × $1.3M plus unpaid 8% preferred return, or 40% of company NW, capped at company NW), less deferred revenue for an unpaid royalty contribution, plus the owner's personal NW. **NW ratio** = owner NW at the end of year N ÷ owner NW at start. Start NW is `select.netWorth(state, 'scoring')` on the fresh `newGame` state, before any action, for every start (DESIGN D-2.74): $520k Bootstrapper, $250k Backed (either term), ≈ $280k Inheritor in P1 and ≈ $238k from P2 (DESIGN §1.8, with R-3's $300k company cash; ≈ $230k and ≈ $188k before R-3), each scaled by the difficulty cash multipliers; the Inheritor's figure includes the inherited fleet's resale and the note, and any `--tuning` override flows through. From P5 the ratio is real. A lost run's NW is the owner's post-settlement personal NW (DESIGN §11), which can be below zero. A run liquidated by the P1 counter has no settlement postings: its NW is own cash − personal debt − guarantees due − tax due, and the company and the owner's loan to it count 0 (DESIGN D-11.85; owner-confirmed 2026-10-06, DESIGN §0 0.27). A run in or after a reorganization is scored like any active run: `netWorth(state, 'scoring')` keeps pre-filing debts at their allowed amounts until the discharge and then carries the plan's remaining payments (DESIGN §1.13, D-1.60), so a filing alone never raises the ratio. **Owner-ahead share** *(approved by the owner on 2026-10-05, §9.5 item 10)* = share of games whose owner NW at the stated year is at or above its start (NW ratio ≥ 1.0). **Waterfall floor:** a Backed-equity owner whose company NW is below the investor's claim keeps only personal NW, a ratio of $50k ÷ $250k = 0.20; a median within 0.01 of that value "sits on the floor", and the outcome gates that would read it (O-06 b, O-07, O-08) use the owner-ahead share instead. DESIGN §1.22's start-parity and background-parity gates follow the same rule.

**5.4 Cost per ounce.** Cash cost/oz, AISC/oz and AIC/oz exactly as DESIGN §11.19.5: denominator gross recovered fine oz in the period; in-kind royalty ounces valued at spot at cleanup; cash cost includes site insurance, refining and mobilization; AISC adds G&A, reclamation provision and accretion, sustaining exploration and sustaining capex; AIC adds interest, growth capex and other exploration. **Realized price** = net sale proceeds ÷ fine oz sold. Reported per producing season; targets use medians across seasons.

**5.5 Profitable claim (M-CLAIMPROFIT).** For each claim a bot acquired (bought, leased, staked or inherited), over the window (5 years, or to the end of the run): attributable revenue (net sale proceeds of the company's ounces, so after in-kind royalties) − acquisition price and closing costs − holding costs (fees, advance and minimum royalties, lease payments) − prospecting spent on it − site opex (incl. mobilization) − cash royalties − a capital charge for the fleet while assigned (fleet resale value × 15%/yr, pro rata) − reclamation liability for acres left unreclaimed at the window end at DESIGN §6's contractor estimate + residual value (a claim still held: DESIGN §5's background-buyer valuation × `land.quickSaleFrac`; 0 if lost). Profitable if > 0. A surrendered lease counts with its sunk advances.

**5.6 First-season profit (FSP).** Company-book net income for game year 1, the book and tax year in every climate rather than the season-year (§1 rule 6) (DESIGN §11's P1 P&L: revenue at sale, costs as incurred, book depreciation; setup costs, testing and acquisition expensed) plus the change in unsold gold valued at the best visible net sale price, > 0. Owner injections and investor money are not income, and neither is a reorganization's debt-discharge gain (`gain.debtDischarge`, DESIGN §11.16.6); reorganization fees are costs. A run that ends before week 52 of year 1 is measured through its last turn: company-book net income through that turn plus the change in unsold gold at that turn (§5.1: a lost run's other metrics are measured as on any active run). FSP is undefined only for a harness abort (`abortReason`, §6.6; DESIGN D-2.57).

**5.7 Production attempt.** Washed bcy > 0 in the season. "Inheritor season-1 attempt rate" = share of Inheritor games with washed bcy > 0 in year 1.

**5.8 Operating metrics.**
- **M-RATE:** washed bcy ÷ Σ plant `runHours` (DESIGN §7 `MachineWeekHours.runHours`, D-7.55: usable hours in which the plant processed feed at its continuous rate, rated, water-, power- or tailings-limited, excluding cleanup, start-up, plant moves and starved or blocked fractions), season total. A definition fix, no band change.
- **M-OPEX:** site opex = wages with burden, fuel, maintenance and repairs, camp, consumables, site fixed, water trucking, site mobilization and winterizing (DESIGN §11.19.5 "site operating costs" without royalties, insurance and G&A). Shares are of that total.
- **M-MARGIN:** operating margin = net sale proceeds of every recovered ounce, including in-kind royalty ounces at their value − site opex (a margin before royalties). Net = operating margin − royalties (in kind and cash) − debt service − G&A − insurance. In a reorganization case, debt service is the adequate-protection payments during the stay and the plan installments, trustee fee included, after confirmation (DESIGN §11.16.2, §11.16.5).
- **M-FLIP:** a producing season-year (the window of D-11.13's annual DSCR test: to week 52 for a northern-primary company, to week 26 for an arid-primary one; an arid-primary run's first season-year is weeks 1–26 of year 1) whose operating margin, summed over that season-year, is > 0 and whose net is < 0.
- **M-BE:** break-even in-situ grade (raw oz/bcy of the pay column) at which the fixture's season-2 result is zero, on a uniform claim at the given strip ratio SR = (overburden − 0.5 ft) ÷ (pay + bedrock take) and permafrost; three levels: site opex only / + the fixture's royalty / + royalty and debt service (or a 10%/yr capital charge on fleet resale). Computed from the fixture's season at 0.012 by linear scaling of revenue with grade.
- **M-TROUGH:** lowest month-end company cash and its month over the fixture's game year (`refSmallNorthDebt` is northern, so that year is also its season-year); drawdown = Jan 1 cash − that low; ops outflows = payroll with burden, fuel, R&M (incl. winter rebuilds), camp, consumables, site fixed, mobilization, insurance and G&A (debt service excluded).
- **M-GRADE, M-CLASS-Y, M-CLASS-E:** DESIGN §3.7's yardstick classes over the listing pool (steady-state weights, DESIGN §3.11) and the engine EconTest classes: DESIGN §3.7's class thresholds applied to a claim value computed block by block with the fixture's engine season volume and cost at each block's strip ratio and permafrost (steady state, year 2), the fixture's recovery, local-buyer netback, a 10% royalty (6% arid), a capital charge of 20%/yr of fleet resale, and development = site mobilization + fleet transport.
- **M-SEASON:** DESIGN §1 calendar per district-year: site season = operating weeks (operating start to freeze-up); full-rate sluicing weeks = Σ over operating and freeze-up weeks of the plant-hours factor (cool weeks 0.80, `ops.plantHoursMultByBand`; freeze-up 0.6, `ops.freezeupPlantMult`), which counts only those two hour cuts, not the start-up, cold-water and wet-weather losses that DESIGN §1.4.3 includes in its ≈ 20 effective weeks; arid effective weeks = Σ of DESIGN §1's day-shift `weatherHoursMult` (heat × fire level, × precipitation from P5).
- **M-PERMIT:** share of listings, weighted by steady-state listing life (DESIGN §3.11), whose truth `permitStub` is `planApproved` with a transferable bond.
- **M-PRICE:** DESIGN §9.3.2 FMV and P1 asks; T-09 (c)'s P1 asks are the hub dealer's graded-used offers at grades B and C (DESIGN D-9.58, D-9.72); P3 market sample = median ask of live private listings per model over 52 weeks.
- **M-EVENT:** DESIGN §12.7's counts and costs per company-year at the fixture.
- **M-CLASS-L:** DESIGN §14.13's lode classes (CDV = NPV at `hardrock.balance.discountRate` of the best path).

**5.9 Dominance.** Bot A dominates bot B in a start type when A ≥ B on S2, median NW ratio (year 5) and p90 NW ratio (year 5), and A > B by more than the larger 95% half-width on at least one of them.

**5.10 Event-preceded bankruptcy.** A run's first bankruptcy filing of either kind (§5.1; one per run, so a reorganization that later converts counts once, at its filing) with a major or catastrophic event (DESIGN §12 severity) affecting the company within the 13 weeks before the insolvency counter opened (P1–P3) or before the run last entered distress stage 1 or higher ahead of that filing (P4+).

---

## 6. Simulator protocol

**6.1 Commands** (DESIGN §2.12).
- `npm run sim -- --strategy <botId> [--games N] [--start <bootstrapper|backedEquity|backedRoyalty|inheritor>] [--years Y] [--difficulty <easy|standard|hard>] [--background <none|operator|mechanic|geologist|banker|landman>] [--entity <soleProp|llc|corp>] [--seed-base S] [--rules p0..p6] [--tuning overrides.json] [--workers N] [--out dir]` runs one cell; `--fixture <id>`, `--world-only`, `--market-only` or `--events-only` in place of `--strategy` runs one mode. Defaults: 500 games, 5 years, standard, Bootstrapper, background `none`, LLC, the build's phase rules, `seedBase` from `data/balance/seeds.json`, one worker per CPU core. There is no default bot: a bot run needs `--strategy` (DESIGN §2.12, D-2.51).
- `npm run sim:balance [--phase N] [--quick] [--workers N] [--out dir] [--baseline file]` runs the phase matrix (§6.4), computes every target §7 marks active, prints the scorecard, writes JSON and CSV, compares with the committed baseline, and exits non-zero on any new FAIL or worsened gating status (§6.7) or on a bot defect.
- Background `none` is a simulator-only owner with every DESIGN §1.7 edge at its non-background value (DESIGN D-2.27); the core matrix uses it.

**6.2 Seeds and determinism.** Game *i* of a cell uses seed `seedBase + i`. `seedBase` is fixed per phase in `data/balance/seeds.json` (default 100000) and never chosen after seeing results. Every bot, start, difficulty, background and tuning variant uses the same seeds (common random numbers), so differences between cells are paired. DESIGN §3.6.1 keeps the world identical across start types; DESIGN §2's named streams keep exogenous draws (weather, price, events) identical across bots. Every output records the git SHA, `tuningHash`, `BOT_VERSION` and `seedBase`; the same four must reproduce byte-identical JSON.

**6.3 Games per cell.** 500 (`sim.defaultGames`). For a proportion near 65%, the 95% half-width is ±4.2 pp: a true 65% lands inside a 10-pp band 98% of the time, and a true 58% lands outside it 80% of the time. Pooled O-01 (2,000 games) gives ±2.1 pp for S2 and, near the 75% floor, ±1.9 pp for B2. For paired comparisons on common seeds (O-05, O-08, O-09) with about 30% discordant pairs, the standard error of a difference is about 2.4 pp, so 8- and 10-pp effects are detected with power above 0.95. Rare rates (near 5%) get ±1.9 pp. `--quick` runs 100 games per cell (±9 pp, `sim.quickGames`) and is for development only, never for sign-off.

**6.4 Matrix.**

| Block | Cells | Years | When |
|---|---|---|---|
| Core | {`cautious`, `balanced`, `aggressive`} × {Bootstrapper, Backed equity, Backed royalty, Inheritor} + `undercap` × Bootstrapper = 13 cells; standard, background `none`, LLC | 5 | every `sim:balance` |
| Named bots | each §4.5 bot active in the phase × {Bootstrapper, Backed equity} | 5 (G-05: 3) | every `sim:balance` |
| Backgrounds | `cautious` × 5 backgrounds × {Bootstrapper, Backed equity} = 10 cells | 2 | phase exit, from P1 |
| Entity | `cautious` × {sole proprietor, LLC} × Bootstrapper | 2 | phase exit, from P4 |
| Difficulty | {`cautious` (Bootstrapper, Backed equity), `undercap`} × {easy, hard}; standard reused from the core | 5 | reported from P1, gating at P6 |
| World and fixtures | 500 worlds (no bots); every fixture | 2 | every `sim:balance`; per-PR CI |
| Market only | 2,000 × 10 years | 10 | phase exit from P5; nightly CI per DESIGN §10.21 |
| Events only | `refSmallNorth` with events, 500 × 5 years | 5 | phase exit from P3 |
| Hard rock | `hardrockSeeker` × {Bootstrapper, Backed equity}, hard rock on; lode world-only (200 worlds) | 10 | phase exit, P6 |

Each seed is one world, and every bot in a block plays the same worlds. The named-bot block also runs `passive` × Backed royalty, so G-03 covers all three debt-free starts; the `g03.passiveB5` extractor returns N/A unless all three are present (DESIGN D-2.71; owner-confirmed 2026-10-06, DESIGN §0 0.29). District choice is a bot decision, not a matrix axis; O-16 reads it. The three option bots of the owner's 2026-10-05 rulings (`smallCrewNoForeman` from P1, `multiLine` and `poolMechanics` from P3) run in the named-bot block like any other §4.5 bot; the multi-claim options add no block.

**6.5 Runtime budget.** DESIGN §2.13 (D-2.15) budgets ≤ 3.5 ms mean and ≤ 8 ms p95 per game-week with explanations off (`sim.perf.weekMeanMs`, `sim.perf.weekCeilingMs`); O-13 gates both. A 500-game, 5-year cell is ≤ 130,000 weeks (fewer, because lost runs stop): at the mean budget ≤ 7.6 CPU-minutes, ≤ 2 minutes on 4 cores. The P1 core plus named bots is about 33 cells (13 core and 10 P1 named bots × 2 starts), ≈ 4.2 CPU-hours, ≈ 63 minutes on 4 cores (≈ 32 on 8). `sim:balance` runs nightly and at phase exit; `--quick` on the core block takes ≤ 6 minutes; per-PR CI runs only fixtures and world-only checks (< 2 minutes). If the engine misses either budget, the phase report states the measured mean and p95 and the matrix is not cut: the job runs longer.

**6.6 Output.**
- **Console:** the scorecard (ID, target, band, measured ± interval, status, change since baseline; one line per clause of a multi-clause target such as O-01), then per-cell tables: S_N, B_N, the reorganization share RS_N and the retreated share B_N − S_N by year, side by side; the bankruptcy rate BK_N by year split into liquidations by cause (filed, involuntary, converted, P1 counter) and reorganization filings by status (completed, converted, open); FSP, production-attempt rate, NW ratio p10/p50/p90 by year, cash cost and AISC/oz, claims profitable, district split, owner injections, causes of loss; use of the multi-claim options (most plant lines on any claim, claim-weeks run under the small-crew rule, mechanic-weeks in pool mode; zero for every bot that keeps the defaults, §4.0).
- **JSON** `out/balance/<phase>/<sha>/summary.json`: `{ sha, tuningHash, botVersion, seedBase, gamesPerCell, rulesVersion, methods, cells: [{ bot, start, difficulty, background, entity, rules, n, years, seedBase, tuningHash, metrics: {…with ci} }], targets: [{ id, target, applicability, band, value, ci, status, note }], blocks: {…} }`; a multi-clause target has one `targets` entry per clause (`O-01.S2`, `O-01.B2`); `blocks` holds the matrix layout, the world-only collectors' results and the dominance matrix. Engine timings are not deterministic, so they never enter summary.json (§6.2): they go to the console and to `timing.json`. O-13's engine-time clauses (`O-13.weekMeanMs`, `O-13.weekP95Ms`) are therefore N/A in summary.json, with the note `timing: see timing.json`; they are scored on the console and count toward the exit code.
- **CSV** `out/balance/<phase>/<sha>/games.csv` (RFC 4180, CRLF line ends, an empty field for a value the build cannot measure), one row per game: seed, bot, start, difficulty, background, entity, rules, district, B1..B5, S1..S5, lostWeek, lossCause (liquidated, ousted, scenario), liquidationCause (filed, involuntary, converted, p1Counter), reorgFiledWeek, reorgStatus at the end of the run (none, filed, confirmed, completed, converted), reorgConsensual, net income by year (the year a run ended in: through its last turn, as §5.6), owner NW by year, washed bcy and fine oz by year, cash cost and AISC/oz by year, claims acquired and profitable, exploration spend, first-season commitment, owner injection, minimum cash and its week, events by severity, most plant lines on any claim, claim-weeks under the small-crew rule, mechanic-weeks in pool mode; then the harness columns: stops by year, stops by kind, longestQuietWeeks, rejectedActions and abortReason. Money columns are USD with cents and carry their unit in the name (`netIncomeUsd1`, `ownerNwUsd1`, `cashCostUsdPerOz1`, `minCashUsd`, …); lostWeek, minCashWeek and reorgFiledWeek are absolute turns; per-year columns run to the longest cell in the file (DESIGN D-2.56). Also `weekly-sample.csv`: weekly cash, bcy and gold for the first 20 seeds per cell (`sim.weeklySampleSeeds`).
- **Stops per year** (O-13): a cell's total stop reasons ÷ its game-years of exposure, Σ (min(finalTurn, 52Y − 1) + 1)/52 over its games, so a full Y-year run counts exactly Y years and a lost or aborted run's partial year counts in both the numerator and the denominator. The per-year stop columns average fully played years only (DESIGN D-2.57). O-13's off-season clause counts stops from the first held northern district's freeze-up start to its next breakup start, per off-season; arid-only games are excluded from that clause and counted in a note. Its gating cell is `cautious` × Bootstrapper; the other three core starts are reported beside it (DESIGN D-2.71; owner-confirmed 2026-10-06, DESIGN §0 0.28).
- **Quits per season** (from P1): the console reports quits per season by bot and start beside O-01, O-13 and O-14, and the first full P1 run reports them before any morale retune (one lever at a time; DESIGN D-2.70).

**6.7 Regression tracking.** At each phase exit the summary JSON of the signed-off run is committed as `docs/balance/baseline-phase-N.json`. `sim:balance` fails on a new FAIL (FAIL now and not FAIL in the baseline, or no baseline) or a worsened status (PASS → AT-RISK → FAIL) among the clauses §7 marks gating for the phase; a reported clause's change shows on the scorecard and does not fail the run. It compares with `docs/balance/baseline-phase-N.json`, else phase N − 1's (the baseline of the §10.1 template), or with the file given by `--baseline`. It warns on any metric that moves more than 2 standard errors without a tuning or bot change in the diff. Tuning changes go in `data/tuning/CHANGELOG.md` (§8.2). A bot change bumps `BOT_VERSION`, is logged in the same changelog and requires a fresh baseline.

---

## 7. Phase applicability and interim bands

Rules by phase (brief; DESIGN §1.19 and each section's phase plan): **P1** flat $4,200 gold, local buyer only, cash purchases plus the two fixed loans (the Inheritor's seasonal estate note and the Banker's stub loan), no permits or bonds, flat maintenance by grade (no wear or breakdowns), no events or competitors, two districts; the P1 insolvency counter is the only way to fail, and a crew of three or fewer may already run without a foreman (DESIGN §8). **P2** adds permits, bonds, reclamation and inspections, so raw ground waits for a plan. **P3** adds wear, breakdowns, auctions, mechanics and parts, several plant lines per claim and the district shop pool. **P4** adds credit, lenders, covenants, insurance and taxes, the investor's check-ins and ouster, entity effects, and the full distress ladder with its two bankruptcy forms (Chapter 7 liquidation, Chapter 11 Subchapter V reorganization; DESIGN §11.16). **P5** adds the dynamic price, refineries, forwards, events and competitors. **P6** adds the other regimes, delegation depth, joint ventures, scenarios, difficulty presets in the UI, and the optional hard-rock track.

"G" = gating (must not FAIL to exit the phase). "R" = reported only. "—" = not applicable.

| ID | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| T-01, T-02, T-03, T-10 (a, c), T-12, T-16 | G | G | G | G | G (at the opening price) | G |
| T-04, T-05, T-06, T-07 | G | G | G (with wear) | G | G | G |
| T-08 (a, b) / (c) / (d) | G / R / R | G / R / R | G / R / R | G / G / G | G | G |
| T-09 (b, c) / (a) and market | G / — | G / — | G / G | G | G | G |
| T-10 (b) | R | R | R | G | G | G |
| T-11 | R | R | R | G | G | G |
| T-13 | — | — | — | — | G | G |
| T-14 | — | — | R (equipment events) | R (+ finance and labor events) | G | G |
| T-15 | — | G | G | G | G | G |
| T-17 | — | — | — | — | — | G (hard rock on) |
| O-01 (S2) / (B2) | G, interim 55–75% / G, ≥ 70% | G, 55–72% / G, ≥ 70% | G, 58–72% / G, ≥ 73% | G, 60–70% / G, ≥ 75% | G, 60–70% (re-baselined, below) / G, ≥ 75% | G, 60–70% / G, ≥ 75% |
| O-02 | G, interim 20–45% (no permitting delay) | G, 10–35% | G, 12–35% | G, 15–35% | G, 15–35% | G |
| O-03 | G (S2 2–40%; B2 ≤ 40% R) | G | G | G | G | G |
| O-04 | R (2-year horizon, no finance) | R | R | G | G | G |
| O-05 | R | R | R | R | R | G |
| O-06 (a) / (b) / (c) / (d) | G (S2 45–85%) / R / G / — | G (45–85%) / R / G / — | G (50–80%) / R / G / — | G / G / G / G | G | G |
| O-07 | G (±7 pp) | G (±7 pp) | G (±5 pp) | G | G | G |
| O-08 | G | G | G | G | G | G |
| O-09 | — | — | G | G | G | G |
| O-10, O-11, O-12 | — | — | — | — | G | G |
| O-13 | G | G | G | G | G | G |
| O-14 | G (P1 band) | G (P1 band) | G (P1 band) | G (P1 band) | G (P5 band) | G (P5 band) |
| O-15 | R | G | G | G | G | G |
| O-16 | G | G | G | G | G | G |
| O-17 | — | — | R | R | G | G |
| O-18 | — | — | — | G | G | G |
| O-19 | — | — | — | — | — | G (hard rock on) |
| G-01, G-02, G-03 | G | G | G | G | G | G |
| G-04, G-05 | — | G | G | G | G | G |
| G-06, G-07 | — | — | G | G | G | G |
| G-08 | — | — | — | G | G | G |
| G-09 | — | — | — | — | G | G |

Notes:
- **Why the P1 survival band is wider.** P1 lacks the price risk, events and permit waits that lower survival later, but it also lacks lenders, refinery netbacks (about 12 points of spot, DESIGN §10.20) and the later levers against insolvency. The two partly offset; the preflight model finds full-rules pooled survival 13 pp below P1 with the approved R-1 and R-3 (55% against 68%; 49% against 63%, 14 pp, before them), mostly from permit waits (§9).
- **B2 floors by phase** (owner ruling 2026-10-05: gate both, with interim bands on S2's pattern). The B2 floor sits as far below its final 75% as S2's lower edge sits below 60%: 5 points in P1–P2 (70%), 2 points in P3 (73%), none from P4. In P1–P3 there is no reorganization (DESIGN D-11.73), no investor check-in or ouster (DESIGN §1, P4) and no scenario, so B2 there counts only liquidations by the P1 counter, and the Backed starts sit near 100% (preflight, §9.3). The floor starts to bite at P4, when the full ladder, ousters and reorganization filings arrive; P4 is also where both clauses reach their final bands (DESIGN §1.19).
- **Why the P1 first-season-profit band is higher.** In P1 every claim can be mined in week 1 of the first season. From P2, raw ground waits for a plan (DESIGN §6.5: about 20 weeks of preparation, then a median of about 40 weeks to decision), so season-1 production rests on permitted listings (T-15) and the starter lease.
- **P5 re-baseline.** The refinery channel lifts revenue by about 12 points of spot. Survival and cost-per-ounce bands keep their values; costs and starting cash are re-tuned, not the bands (DESIGN §10.20).
- **Clauses.** The simulator scores multi-part targets as named clauses (`T-06.bcy`, `T-06.rawOz`, `O-04.aggressiveP90`, `O-06a.<start>`, …), and each clause carries its row's status in this table; a registry test checks the simulator's table against this one. `T-09.market` is the P3 market sample of the T-09 row's "(a) and market" cell, gating from P3 like T-09 (a) (DESIGN D-2.56).
- **O-03 in P1** (DESIGN D-2.71; owner-confirmed 2026-10-06, DESIGN §0 0.22). The P1 cell is read literally: O-03 gates `undercap` S2 in 2–40% and reports its B2 ≤ 40% clause (the registry marks `O-03.B2` reported for phase 1); both clauses gate from P2. The phase report notes the reading.
- **O-13 in P1** (DESIGN D-2.71, D-13.88; owner-confirmed 2026-10-06, DESIGN §0 0.23). `season.phaseChange` is an info message, so a phase change stops a run only through the editable `seasonPhase` rule (DESIGN D-13.91). O-13 is measured with `cautious` in `--quick` runs from the vertical slice on.
- **Fixtures in P1** run as "P1 approximations" with staff noise off (§2.1).
- **Section gates.** DESIGN §1.19's exit-gate table lists each phase's section-owned gates and some of the BALANCE targets. This table is the complete list of BALANCE gates for each phase; where both name a target, they must agree on when it gates and on its band.

---

## 8. Tuning levers

### 8.1 Levers per target

Keys are the owning sections' keys (the owning DESIGN section is in parentheses). "↑" means raising the value raises the metric the target measures. Template fields of DESIGN §3.2 and §14.3 are written as region-template fields, not dotted keys.

| Target | Levers (owner) and direction |
|---|---|
| T-01 grades | region-template `gMed` (DESIGN §3.2) ↑ grades; `geology.grade.pocketMult` (DESIGN §3) ↑ pocket tail; region-template `bgRatio` and paystreak half-width (DESIGN §3.2) ↑ dilution of mined grade; `geology.world.selSlope` (DESIGN §3) ↑ concentration of good ground on held parcels |
| T-02, T-03 classes | `gMed` (DESIGN §3.2) ↑ economic share (≈ 1–2 points per 5% step, DESIGN §3.17); `geology.refEcon.frozenWashAdd` (DESIGN §3) ↑ classes frozen ground more strictly (yardstick only); `geology.supply.saleQualityMult` and `geology.supply.inflowMult` (DESIGN §3) set how much poorer the pool is than the held stock; for T-03 also the T-04 and T-07 cost levers |
| T-04, T-06 throughput | `ops.digMult` (gravel frozen 0.35) and `ops.thawK` (DESIGN §7) ↑ frozen-season volume; `ops.makeupFrac` (arid) and `ops.gpmPerBcyHr` (DESIGN §7) ↓ raise water-limited arid rate; `ops.p1MechAvailability` (DESIGN §7) and `fleet.p1GradeRateMult` (DESIGN §9) ↑ rate; `ops.directFeedMaxRated` / `DigMult` (DESIGN §7) for excavator-direct starters |
| T-05 mature throughput | `ops.haulJobEff` (DESIGN §7) ↑; rated capacity in the DESIGN §9.2.3 catalog; `ops.cleanupHoursBase` / `PerRatedBcyHr` (DESIGN §7) ↓ |
| T-07 opex shares | `fleet.p1MaintUsdPerHr` and `fleet.p1GradeMaintMult` (DESIGN §9) ↑ R&M share; `staff.roleBase`, `staff.regionWageMult`, `staff.remotePremium` (DESIGN §8) ↑ wage share; `market.openingDieselRackUsdPerGal` (DESIGN §10) ↑ fuel share; `ops.campUsdPerPersonDay` (DESIGN §7); `ops.waterTruckDayRateUsd` (DESIGN §7) for trucked arid plants |
| T-08 royalties and debt | `land.royaltyBase`, `land.royaltyMin` / `royaltyMax` (DESIGN §5) ↑ royalty burden; `game.investor.royaltyRate` (DESIGN §1); DESIGN §11.6 lender spreads and `finance.startupCapUsd` (DESIGN §11) |
| T-09 equipment prices | DESIGN §9.2 new prices, `fleet.depCurve.<family>` and `fleet.p1GradePriceMult` (DESIGN §9) |
| T-10 break-even | everything in T-04 and T-07; `market.localBuyer.discount` (DESIGN §10) ↓ lowers break-even; `ops.consumablesUsdPerBcyWashed` (DESIGN §7); for (b) `ops.thawK`, `ops.stripFrozenMult` and `ops.pushFtPerExtraCol` (DESIGN §7), multi-machine strip-ahead capacity (DESIGN §7.20); for (c) `geology.refEcon.frozenWashAdd` (DESIGN §3) follows any change to `ops.thawK` or `ops.digMult` |
| T-11 trough | `ops.siteMobBaseUsd` (DESIGN §7); winter rebuild timing (DESIGN §9); `finance.seasonalMinSeasons` and `finance.seasonalSpreadAdd` (DESIGN §11) |
| T-12 seasons | `game.season.<tpl>.breakupMean` / `Sd` and `game.season.<tpl>.freezeMean` / `Sd` (DESIGN §1) ↑ season length; `ops.plantHoursMultByBand` (DESIGN §7) ↑ sluicing weeks; `ops.heat.*` and `game.weather.fireSeasonFactor.aridDesert` (DESIGN §7, §1; D-7.66, D-1.71) ↓ arid hours |
| T-13 price | DESIGN §10.19: `market.regime.drift.*`, `market.regime.exitProb.*`, `market.garch.sigmaBarWeekly`, `market.jump.probWeekly`, `market.meanReversionKappa` |
| T-14 events | `events.frequencyMult`, `events.severityMult`, `events.budgetPerHalf` (DESIGN §12) and the per-event bases in DESIGN §12.7 |
| T-15 permitted supply | `geology.permitStub.minLastSeasonYear` / `planP` / `noticeP` (DESIGN §3) ↑ supply; `geology.supply.starterLeasePerDistrict` (DESIGN §3); `land.permitResourceMult` / `permitReplacementUsd` (DESIGN §5) set its price |
| T-17 lode classes | region-template `lode.gMedOzSt` (DESIGN §14.3) and `hardrock.lode.shootLog` (DESIGN §14) ↑ economic share |
| O-01 survival (S2 and B2) | `game.start.bootstrapper.companyCashUsd` and `game.start.inheritor.companyCashUsd` (DESIGN §1) ↑; `finance.p1InsolvencyGraceWeeks` (DESIGN §11) ↑ (P1–P3); from P4 `finance.bankruptcy.missedPayrollRuns` and `finance.bankruptcy.defaultWeeks` (DESIGN §11) ↑ delay the involuntary triggers; `market.localBuyer.discount` (DESIGN §10) ↓ raises it; `game.inheritor.preStrippedBlocks` (DESIGN §1) ↑ (Inheritor); the T-15 levers (full rules); the O-06 investor terms for Backed-equity ousters. Which clause misses says where to look: B2 below its floor with S2 in band means runs end in liquidation or ouster, so start with the insolvency grace (P1–P3) or the involuntary triggers and investor terms (P4+); S2 below its band with B2 above its floor means retreat (no production, a distress fleet sale, or neither fleet nor cash at season end), so start with start cash and the T-15 levers. The `finance.reorg.*` keys are not survival levers: a filing fails both clauses for its window (§5.1); they shape later windows (O-04, §8.4) |
| O-02 first-season profit | `ops.digMult`, `ops.thawK` (DESIGN §7) ↑; `geology.oldTimer.preStripP` / `preStripMaxAgeYr` (DESIGN §3) ↑ pre-stripped listings; the T-15 levers and `permits.reviewTimeMult` (DESIGN §6) ↓ raise it from P2; start cash (DESIGN §1) |
| O-03 undercapitalized | `geology.seller.honestyMix` (DESIGN §3) more fraud and optimism ↓ survival; `land.askMarkup` (DESIGN §5) ↓; `finance.p1InsolvencyGraceWeeks` (DESIGN §11) ↑ |
| O-04 dominance | `finance.startupCapUsd` (DESIGN §11) limits financed growth; DESIGN §9.2 plant prices at 150–300 bcy/hr (economies of scale); `market.volMult` (DESIGN §10) ↑ upside for leverage; `ai.aggressionMult` (DESIGN §12); `ops.thawK`, `ops.stripFrozenMult` (DESIGN §7) ↑ help large fleets on frozen ground; if a year-5 p90 rises mainly through reorganized runs, `finance.reorg.filingCostUsd`, `finance.reorg.trusteeFeePct` and `finance.reorg.planWeeksMin` / `planWeeksMax` (DESIGN §11), then `game.investor.reorgFilingPenalty` (DESIGN §1), as DESIGN §1.21 orders; for the option bots, the §8.4 levers |
| O-05 difficulty | the DESIGN §1.11 knobs, mainly `geology.seller.honestyMix` (DESIGN §3), `finance.p1InsolvencyGraceWeeks` and the other lender-patience keys (DESIGN §11), `events.frequencyMult` / `severityMult` (DESIGN §12); `game.startCompanyCashMult` / `startPersonalCashMult` (DESIGN §1) are deliberately narrow (DESIGN D-1.43) |
| O-06 starts | start cash keys (DESIGN §1); `game.inheritorTierWeights`, `game.inheritorDepletionAdd`, `game.inheritor.preStrippedBlocks`, `game.inheritor.noteSchedule` and `game.inheritorDebtMult` (DESIGN §1); `game.investor.prefRate`, `game.investor.penaltyMult` and the other `game.investor.*` terms (DESIGN §1) |
| O-07 backgrounds | `staff.ownerOpsSkillByBackground` (DESIGN §8); `fleet.p1OwnerShopMaintMult` (DESIGN §9; 0.70 → 0.80 if the Mechanic fails, DESIGN §9.16); `geology.ownerGeologistSkill` (DESIGN §4); `finance.bankerCreditTierBonus` and `finance.tierWidthPoints` (DESIGN §11); `land.p1LandmanPriceMult` and `land.p1LandmanRoyaltyPointsOff` (DESIGN §5); if `smallCrewNoForeman` beats `cautious` for the desk backgrounds, `ops.noForemanEfficiency` (DESIGN §7) before any background value (§8.4) |
| O-08 value of information | `geology.sample.deWijsAlpha` (DESIGN §3) ↑ cost of certainty; `geology.frozenPitCostMult` (DESIGN §4); `geology.seller.honestyMix` (DESIGN §3); `geology.prior.statusMult` (DESIGN §3) |
| O-09 maintenance | `fleet.pmSkipWearSlope`, `fleet.hazardWearA` / `hazardWearExp`, `fleet.failureHazardMult` (DESIGN §9) |
| O-10 hedging | `market.forward.spread.*`, `market.forward.marginTolerance` and the other forward keys, `market.volMult` (DESIGN §10) |
| O-11 price | as T-13 |
| O-12 competitors | `ai.bust.a0` and its coefficients, `ai.bustCashFloorUsd`, `ai.competitorCount` (DESIGN §12) |
| O-13 pacing | DESIGN §13.9 default stop rules, `ui.runMaxWeeksDefault` (DESIGN §13), `finance.distress.watchWeeks` (DESIGN §11), `game.alerts.obligationInfoWeeks` / `WarnWeeks` / `CriticalWeeks` (DESIGN §13); a level alert kind that flaps gets hysteresis in its emitter under the owner's keys (DESIGN D-13.89). O-13 is tuned only through these alert and stop-rule keys and §11's watch weeks, never through bots (DESIGN D-2.71) |
| O-14 cost per ounce | the T-07 levers; `market.localBuyer.discount` (DESIGN §10); `land.royaltyBase` (DESIGN §5) |
| O-15 profitable claims | the T-02 levers; `land.askMarkup` and `land.inGroundFrac` (DESIGN §5) ↑ cost of ground; `land.valDiscountRate` (DESIGN §5) |
| O-16 arid choice | `ops.heat.*` (DESIGN §7, D-7.66) and `game.weather.fireSeasonFactor.aridDesert` (DESIGN §1, D-1.71): steepen heat before touching grades (DESIGN §1.21); `ops.makeupFrac` (DESIGN §7) ↑ raises arid water cost; arid `gMed` (DESIGN §3.2) |
| O-17 events | `events.frequencyMult`, `events.budgetPerHalf`, `events.distressMercyMult` (DESIGN §12) |
| O-18 entity | `finance.credit.solePropOwnerFileWeeks` (DESIGN §11) (DESIGN §1.21) |
| O-19 hard rock | `hardrock.capex.overrunMed` and the `fed.planLode` review medians (DESIGN §14, §6) first, then `hardrock.toll.allotmentStWk` (DESIGN §14) (DESIGN §14.20) |

### 8.2 Tuning protocol

1. **One lever at a time.** Change one key (or one documented group, such as a whole per-grade row) per experiment and run the affected block of the matrix at full sample. Keep the change only if the target moves into band and no gating target leaves its band.
2. **Prefer the owning system.** Fix a production problem with DESIGN §7 or §9 keys, not with the gold price or start cash; fix a world problem with DESIGN §3 keys, not with bot rules.
3. **Stream isolation.** A change to a key outside DESIGN §3 must leave the world hash unchanged (DESIGN §2 property test); a change to a DESIGN §7 key must leave DESIGN §10 prices and DESIGN §12 event draws identical. If not, the change is a bug, not a tuning.
4. **Effect size.** A change is real when the paired difference exceeds 2 standard errors on common seeds. Below that, stop chasing noise.
5. **Record.** Each change goes in `data/tuning/CHANGELOG.md`: date, key, old → new, owning section, reason (target ID), before → after with intervals for every affected target, git SHA. The owning section's tuning table changes in the same commit.
6. **No double counting.** If a section's own calibration (DESIGN §3.7, §7.23, §10.6, §12.15, §14.13) depends on the key, re-run that calibration after the change.
7. **Bots stay frozen** while tuning (§1 rule 3).

### 8.3 Keys and rules BALANCE asks the sections to change

Every key above exists in a DESIGN tuning table. The preflight results (§9) asked for these changes. The integrator adopted R-1 to R-4 on 2026-10-04, and the owner approved them on 2026-10-05 together with the recommendations for R-5 and R-6 (§9.5 items 9 and 7). Each lives in its owning section's tuning table or text and is cheap to reverse because it is data; a later change is an ordinary logged tuning or bot change (§8.2, §6.7).

| ID | Owning section and key or rule | Before | Change | Status | Evidence (§9) | Targets |
|---|---|---|---|---|---|---|
| R-1 | DESIGN §3.9, `geology.permitStub.minLastSeasonYear` / `planP` (`noticeP` unchanged) | 2010 / 0.50 / 0.20 | 2000 / 0.60 / 0.20 (none 0.20) | **approved** (owner, 2026-10-05; adopted by the integrator) | northern listing-pool share with plan authority 4.8% → 10.0% (arid 4.3% → 6.6%); full-rules pooled S2 49% → 52% (55% with R-3) | T-15 (b), O-01, O-02 |
| R-2 | DESIGN §2.12.1 bot catalog | the unrefined first-version rules | the six *(refined)* rules of §4; documented bot version 1.0 | **approved** (owner, 2026-10-05; adopted by the integrator) | without them a Bootstrapper cannot operate (a gross 13-week reserve is ≈ $400k), the aggressive bot buys ground it cannot equip and sells its fleet before mining, and an arid starter loses ≈ $127k a year to a water truck it does not need | O-01 to O-04 |
| R-3 | DESIGN §1.21, `game.start.inheritor.companyCashUsd` | $250,000 | $300,000 (the lever DESIGN §1.21 names next) | **approved** (owner, 2026-10-05; adopted by the integrator) | Inheritor S2 46% → 60% in P1 and 30% → 43% under full rules; P1 pooled O-01 63% → 68%; Inheritor owner NW at start ≈ $230k → ≈ $280k (P1), ≈ $188k → ≈ $238k (P2+) | O-06 (a), O-01, T-16 |
| R-4 | DESIGN §7.20 mature-operation anchor; T-10 (b) | ≤ 0.85 at permafrost 0.8 | ≤ 0.85 on thawed ground (p 0); the frozen ratio reported and carried as a named O-04 risk | **approved** (owner, 2026-10-05; adopted by the integrator) | 0.81 thawed; 1.02 at p 0.8, where `matureNorth` is limited by strip and thaw, not by its plant | T-10 (b), O-04 |
| R-5 | DESIGN §11.15 worked table | first gold in June; level trough −$111k in June | regenerate the table from the engine's `refSmallNorthDebt` run at P1 exit | **approved** (owner, 2026-10-05; §9.5 item 9): regenerate at P1 exit | on DESIGN §1's mean calendar the plant starts in week 20 and the first lots settle in late May: the level schedule bottoms at −$8k at May month-end from $400k on Jan 1 (drawdown 32% of ops outflows, year +$35k), against the table's −$111k in June | T-11 |
| R-6 | DESIGN §2.12.1 `sizeFleet` | sizes the fleet to liquidity | sizes it to the claim: the largest tier whose P50 season margin on the claim's visible resource is positive, capped by liquidity | **approved as a P1 trial** (owner, 2026-10-05; §9.5 item 7); adopting it after the trial is a bot change that bumps `BOT_VERSION` (§6.7) | the reference fleet on small claims gives Backed and Inheritor median AISC of 120% and 114% of realized in P1 (Bootstrapper 85%); **not tested in the preflight model**; trial in P1 before adoption. The trial runs through the simulator-only `--bot-variant r6` flag, recorded as `botVersion '1.0+r6'` and never used for a baseline; the integrator reports the evidence at P1 exit and the owner decides adoption at P1 sign-off (DESIGN D-2.76; DESIGN §0 "Still open") | O-14, O-06 (b) |

### 8.4 Options added by the owner's 2026-10-05 rulings: levers and risks

The rulings added three player choices for growing past one small claim (DESIGN §0.7: several plant lines per claim, small crews without a foreman, a district shop pool) and Chapter 11 Subchapter V reorganization (DESIGN §0.9). None gets a new target: each is a trade-off, and the risk is that one becomes a free lunch. The core bots and every fixture keep the defaults (§2.1, §4.0), so every target except O-04's option-bot clause reads the game without the options, and the 1.0 baselines stay comparable with the preflight (§9). One named bot per option (§4.5) measures it against `cautious` on common seeds, and O-04 lists each of them among the bots that must not dominate `cautious`. Several of the values below were set by the owner's rulings (`ops.noForemanEfficiency` 0.92, `staff.smallCrewMaxNoForeman` 3, `staff.noForemanIncidentMult` 1.15, `staff.foremanMaxLines` 2, `ops.maxPlantLinesPerClaim` 3, `fleet.poolTravelHoursPerJob`, `fleet.poolResponseDelayHours` 8 h, and the `finance.reorg.*` terms the ruling names); a change to one of those goes to the owner before it is logged (§8.2), as DESIGN §1.21 says for the first of them.

| Option (from; owner) | What could break | How the simulator watches it | Levers, in order |
|---|---|---|---|
| Small crews without a foreman (P1; DESIGN §7 D-7.11, §8 D-8.48, §12 D-12.51) | The no-foreman efficiency 0.92 is a hair above a skill-40 owner-foreman's F = 0.85 + 0.15 × 0.40 = 0.91 (every background but Operator, and background `none`). On a claim of three hands or fewer, dropping supervision then costs no machine hours and frees the owner's week for desk work; the price is the informal leader's qF (0.6 × the best hand) for morale and redeployment and, from P2 when injuries arrive, the injury and site-incident multiplier 1.15. `smallCrewNoForeman` may match or beat `cautious` on small starter claims, most likely in P1, before injuries arrive, and the option narrows the Operator background's small-crew lead (DESIGN §1.21: ≈ 7.4% → ≈ 6.3%), which O-07 does not see because the bots keep the owner as foreman | `smallCrewNoForeman` in the named-bot block from P1 (Bootstrapper and Backed equity); O-04's matrix (reported P1–P3, gating from P4); the phase report states its S2, B2, owner-ahead share and median NW ratio beside `cautious`, and the claim-weeks it ran under the rule | `ops.noForemanEfficiency` (DESIGN §7) ↓ toward 0.90, then `staff.noForemanIncidentMult` (DESIGN §8) ↑; never a background value first (DESIGN §1.21) |
| Several plant lines per claim (P3; DESIGN §7 D-7.19, D-7.48–D-7.54, §8 D-8.49) | A second line raises output without a second claim, its permits and its camp. If it is cheap, `multiLine` dominates `cautious`, and one-line play becomes a mistake on any claim of 20 acres or more. On frozen ground the shared strip and thaw queue binds (T-10 b's frozen ratio 1.02, R-4), so a second line should mostly idle there; on thawed, well-watered ground it can give large operations the unit-cost edge O-04's `aggressive` upside clause needs | `multiLine` from P3 in the named-bot block and O-04; the phase report splits its result by the claim's visible reserve, as DESIGN §7.22 asks (a second line should pay only on claims with several seasons of reserve and should not beat buying a second claim on short reserves). Fixtures keep one line, so T-04 to T-07 and T-10 do not move | `ops.extraLineMinAcres` (DESIGN §7) ↑ first, as DESIGN §7.22 orders; then DESIGN §9.2 plant prices; water and stripping keys last |
| District shop pool (P3; DESIGN §8 D-8.50, §9 D-9.21, D-9.52–D-9.55) | Pool mechanics serving several road-access claims cut mechanic wages per fleet hour. If the travel overhead and the response delay are too light, `poolMechanics` dominates and a district of claims runs with almost no mechanics | `poolMechanics` from P3 in the named-bot block and O-04; the report splits by access class, as DESIGN §9.16 asks (the pool should win on clustered highway claims and lose on winter-trail claims), and states how many of its games ever post a mechanic to a pool: it departs from `cautious` only once it runs two or more road-access claims in one district, which the `cautious` rules rarely reach, so a small count means the pool was measured on few games, and the report says so. G-07 (one site mechanic on the reference fleet) does not move | `fleet.poolResponseDelayHours` (DESIGN §9) ↑ first, then `fleet.poolTravelHoursPerJob`, as DESIGN §9.16 orders |
| Reorganization (P4; DESIGN §11.16, D-11.17, D-11.63–D-11.73, D-2.33) | Runs that would have ended keep going. A filing fails the survival window it falls in (§5.1), and bots file only where a liquidation would otherwise follow (§4.0), so B_N and S_N read as they would without it; but later-window net worth can rise through reorganized runs, above all `aggressive`'s year-5 p90 (O-04), and a reorganization filed while a redemption demand is open counts in O-06 (d) | RS_N and the bankruptcy split in every cell (§6.6); per bot, the share of runs at or above its year-5 p90 that filed (§10.4); the share of cases that convert within two years of filing (DESIGN §11.26: nearly all means plans commit too much, none means too little) | For O-04: `finance.reorg.filingCostUsd`, `finance.reorg.trusteeFeePct`, `finance.reorg.planWeeksMin` / `planWeeksMax` (DESIGN §11), then `game.investor.reorgFilingPenalty` (DESIGN §1). For the conversion share: `finance.reorg.capexAllowancePct` and `reserveMaxPct`, then `voteBias` / `voteSlope`, then `trueUpShare` (DESIGN §11.26). What a reorganized run keeps, never survival: `land.reorg.minOverbidFrac` / `breakupFeeFrac` / `planSaleWeeks` (DESIGN §5.14), `ai.reorgVultureMult` (DESIGN §12.15), `permits.surety.reorgCollateralFrac` (DESIGN §6.8); the report may add, among runs that file, the share that reach confirmation and keep at least one claim |

---

## 9. Preflight results

### 9.1 What the preflight model is

`docs/prototypes/preflight/preflight_model.py` is a Python sanity check of the economics written before any engine code. It implements the current DESIGN sections in reduced form, cites the section and key beside every constant, and writes `preflight_results.txt` (Parts A–G; seed 20261004; 40 districts per template; 500 games per two-year cell, 300 per five-year cell, 200 per sweep or background cell; run time ≈ 8.5 minutes). It is not the simulator: its numbers say whether the sections, taken together, land near the bands, so that P1 starts from plausible values.

**What it reduces** (full list at the end of `preflight_results.txt`):
- Geology: independent creeks instead of the network; the Inheritor's run drawn from generated creek parcels; old-timer history gaps at 0.2 per season.
- Operations: weekly aggregation of DESIGN §7's hour-block flow; best-first block order; fixed haul and push distances.
- Costs: P1 flat maintenance by grade in every rule set (full rules add P3 availability by grade only); no breakdowns; staff at résumé-free asks without morale, quits or injuries.
- Estimation: DESIGN §4 is not run; estimate error is lognormal noise calibrated to DESIGN §4.9.
- Finance: the P1 insolvency counter; full rules add equipment loans and hard money for `aggressive` and `undercap` only, insurance, G&A, DESIGN §6.5's plan delay (20 weeks of preparation plus a lognormal review, median 40 weeks) and a surety bond; no covenants, cards, revolver, taxes or investor check-ins (so no ouster).
- Market: full rules use a regime GARCH price with jumps but without DESIGN §10's macro link or fair-value pull.
- Not modeled at all: events, competitors, the equipment market, entity choice, delegation and hard rock.
- Bots: reduced §4 bots that see 20 random listings a year (plus two starter leases in year 1 under full rules) and hold one claim at a time; `aggressive` takes no second claim.

**Rule sets.** "P1" = DESIGN §1.19 phase-1 rules. "Full" = a P5-like set: regime price, refinery sales, DESIGN §6 permitting (with DESIGN §3.9's permit stub and DESIGN §3.11's starter lease), P3 availability, P4 insurance, G&A and the financing above. Full rules stand in for the P4–P6 bands.

### 9.2 World, fixtures and calendar

| Check | Result |
|---|---|
| Listing-pool classes, DESIGN §3 yardstick (uneconomic / marginal / good / excellent %) | north 64.0 / 25.4 / 9.1 / 1.5; arid 63.1 / 26.5 / 9.5 / 1.0. DESIGN §3.7's own harness (full creek network) gives north 73.1 / 20.5 / 5.6 / 0.8 and arid 64.8 / 26.1 / 8.3 / 0.8 |
| Arid `gMed` sensitivity (yardstick) | × 1.0: 62.9% uneconomic; × 0.9: 66.6%; × 0.8: 70.0% |
| Engine EconTest classes | `refSmallNorth` 67.8 / 24.7 / 6.6 / 0.9 (good + excellent 7.5%); Bootstrapper starter fleet 56.9 / 33.8 / 8.1 / 1.3; mature 66.6 / 22.8 / 8.9 / 1.8; arid starter at the median well 51.8 / 39.9 / 7.7 / 0.6 |
| Grades | held-claim median paystreak grade p10–p90 north 0.0012–0.0172; mined blocks (bcy-weighted) p10 / p50 / p90 / p99 north 0.010 / 0.018 / 0.038 / 0.082, arid 0.010 / 0.015 / 0.036 / 0.092; paystreak bcy in 0.005–0.03: north 52%, arid 41%; pockets 0.11% / 0.19% of paystreak blocks |
| Plan authority in the listing pool | with R-1 (approved) north 10.0%, arid 6.6% (gate ≥ 8% north); before R-1 4.8% / 4.3% |
| `starterNorth`, season 2 | 42,771 bcy at 36 bcy/hr; 285 fine oz; site opex $727k (wages 51%, fuel 14%, R&M 23%); net after royalty +$243k (season 1: −$31k) |
| `refSmallNorth`, season 2 | 61,494 bcy at 63 bcy/hr; 500 raw / 413 fine oz; season 1 49,771 bcy (81%); site opex $1,195k (fuel + wages 64%, R&M 26%, fuel 17%); operating margin $319k; cash cost $2,894/oz |
| `refSmallNorthRoyalty` / `refSmallNorthDebt`, season 2 | royalties $345k against a $363k margin (0.95); royalties $173k + debt service $229k against a $535k margin (0.75); nets +$11k and +$39k |
| `matureNorth`, season 2 | 326,957 bcy at 242 bcy/hr; fuel + wages 66%, R&M 23%; book profit $1.40M |
| `starterArid` (median 120-gpm well), season 2 | with one truck 39 bcy/hr, fuel + wages 47%, water trucks $437k, net −$155k; well only 28 bcy/hr, 66%, −$28k; 300-gpm well 40 bcy/hr, 65%, +$313k |
| `inheritorNorth` | 45,768 bcy at 36 bcy/hr in each season (2 pre-stripped blocks); fuel + wages 65%, R&M 25%; net after note +$143k / +$140k |
| P1 used asks (T-09 c) | `ex30` B $211k / C $113k; `ld966` $229k / $116k; `adt30` $256k / $130k |
| Break-even in-situ grade, `refSmallNorth` at SR 3, p 0.8 (opex / + royalty / + capital charge) | 0.0101 / 0.0113 / 0.0143 oz/bcy. Frozen ÷ thawed opex break-even: engine 1.37, yardstick 1.36. `matureNorth` ÷ `refSmallNorth` with royalty: 0.81 thawed (both at a refinery); 1.02 at p 0.8 (both at a refinery); 0.90 at p 0.8 against `refSmallNorth` at the local buyer |
| Cash curves (week-level, before owner injections) | Bootstrapper low ≈ $0 in year-1 week 27 (no owner injection needed); Backed equity low $196k; Inheritor low $164k at $250k company cash (not re-measured at R-3's $300k) |
| `refSmallNorthDebt` year-2 month-end cash | level: low −$8k in May, drawdown $408k = 32% of $1,272k ops outflows, year +$35k; seasonal Jun–Nov: low $88k in May, drawdown 25%, year +$31k; 413 fine oz, receipts $1,536k |
| First-season thaw constraint (`refSmallNorth`) | season 1: no strip-ahead 49.8k bcy (margin $59k); 2 pre-stripped blocks 64.3k ($388k); 3 blocks 66.1k ($450k); unfrozen ground 76.0k ($700k) |
| Calendar (500 district-years) | north site season p10 / p50 / p90 20 / 22 / 24 weeks; full-rate sluicing weeks p50 22.0 (18.4 after availability and foreman efficiency); arid effective day-shift weeks 45.6 / 47.4 / 48.8 |
| Price cross-check | P(gold falls more than 15% in year 1) 19.7% on the model's simpler price path; DESIGN §10.5 states 12% for the full model |

### 9.3 Monte Carlo results

**Sections behind each cell.** R-2's bot rules and R-4's thawed-ground definition were in every cell. Every cell ran on the sections before R-1 and R-3 (permit stub 2010 / 0.50 / 0.20, Inheritor company cash $250k) except the lever-check rows that name them and the `undercap` note under them, so those are the only Monte Carlo measurements of the approved values: P1 with R-3 (R-1 changes only permit data, which P1 rules do not use, but it redraws the world; P1 with both was not re-measured) and full rules with R-1 + R-3. Every other cell is not re-measured with R-1 and R-3.

**Two seasons, cautious bot, standard difficulty, background `none`** (sections before R-1 and R-3; 500 games per cell; ± is the 95% interval; the approved values are in the lever checks below):

| Start | P1 S2 | P1 B2 | P1 FSP | Full S2 | Full B2 | Full FSP | Full: mined in season 1 |
|---|---|---|---|---|---|---|---|
| Bootstrapper | 64 ± 4 | 88 | 43 | 45 ± 4 | 79 | 14 | 31 |
| Backed equity | 80 ± 4 | 100 | 30 | 74 ± 4 | 100 | 10 | 35 |
| Backed royalty | 78 ± 4 | 100 | 31 | 71 ± 4 | 100 | 10 | 28 |
| Inheritor | 46 ± 4 | 85 | 34 | 30 ± 4 | 75 | 28 | 89 |
| **Pooled (O-01)** | **63** | 91 | **36** | **49** | 85 | **17** | |

Other two-season cells (P1 / full S2 and B2): `balanced` Bootstrapper 60 / 45 (B2 84 / 84), Backed 82 / 67; `noTest` Bootstrapper 45 / 25, Backed 69 / 65; `aggressive` Bootstrapper 33 / 2 (B2 47 / 70), Backed 23 / 17; `undercap` 15 / 9 (B2 22 / 32). Inheritor season-1 production attempt: 97% (P1), 89% (full). Arid share of the cautious Bootstrapper's first claims: 42% (P1), 44% (full).

**Value of information** (cautious − `noTest`, common seeds): P1 Bootstrapper +19 pp S2, +0.28 median NW ratio, owner-ahead share 45% vs 25% (+20 pp), testing 12% of the first-season commitment; P1 Backed +11 pp, NW median 0.20 vs 0.20 (both on the waterfall floor), owner-ahead 37% vs 27% (+10 pp), testing 3%. Full rules: Bootstrapper +20 pp, +0.24, owner-ahead 34% vs 11% (+23 pp), testing 31%; Backed +9 pp, owner-ahead 38% vs 16% (+22 pp), testing 5%.

**Difficulty** (P1, 500 common seeds; easy / standard / hard): cautious Bootstrapper S2 67 / 66 / 49, B2 90 / 86 / 94, NW median 1.00 / 0.67 / 0.52; cautious Backed S2 95 / 85 / 74, NW median 0.45 / 0.20 / 0.21 (standard and hard on the waterfall floor); `undercap` S2 19 / 12 / 6.

**Inheritor by hidden tier** (P1 S2; full S2; at $250k company cash, not re-measured with R-3): uneconomic 15%, 1%; marginal 32%, 19%; good 70%, 53%; excellent 84%, 60%. After DESIGN §3.6.1's conditioning the family ground's yardstick class matches the tier in 99 / 92 / 81% of uneconomic / marginal / good draws but only 24% of excellent ones, because the grade scale is capped at × 4.

**Lever sweep** (P1, 200 games per cell, cautious; S2 %): baseline Bootstrapper 65, Backed 81, Inheritor 52, `undercap` 12. Inheritor cash $300k: Inheritor 64. Inheritor note on a level schedule: 52. No pre-stripped Inheritor blocks: 36 (season-1 attempt 92%). Bootstrapper cash $325k: Bootstrapper 55. Local-buyer discount 0.08: 66 (FSP +2 pp). P1 maintenance × 0.85: 67 (NW median 0.66 → 0.76). Frozen dig multiplier 0.50: 66 (NW 0.70). Arid makeup 0.20: Bootstrapper 58 (arid share 40% → 38%).

**Owner backgrounds** (P1, 200 per cell; S2, Δ against the five-background mean): Bootstrapper Operator 64 (−1), Mechanic 68 (+3), Geologist 68 (+2), Banker 62 (−3), Landman 63 (−2); Backed Operator 81 (−1), Mechanic 84 (+2), Geologist 79 (−3), Banker 84 (+3), Landman 82 (0). Owner-ahead share at year 2: Bootstrapper Operator 46%, Mechanic 48%, Geologist 48%, Banker 50%, Landman 42% (mean 47%); Backed 51%, 54%, 51%, 51%, 48% (mean 51%). Geologist median NW ratio against the other four backgrounds' median: Bootstrapper 0.90 vs 0.84 (1.08×); Backed 1.49 vs 1.23 (1.22×; by owner-ahead share 51% vs 51%, 1.00×).

**Five years, cautious** (300 per cell; sections before R-1 and R-3, not re-measured, so the Inheritor rows use $250k company cash and a starting owner NW of ≈ $230k in P1, ≈ $188k under full rules):

| Start | Rules | S5 | Owner NW ratio y5 p10 / p50 / p90 | Owner ahead at y5 | Claims profitable | Cash cost/oz p50 | AISC ÷ realized p50 | M-FLIP share |
|---|---|---|---|---|---|---|---|---|
| Bootstrapper | P1 | 58 | 0.00 / 0.55 / 11.17 | 41% | 44% of 524 | $3,059 | 85% | 1% |
| Backed equity | P1 | 67 | 0.00 / 0.20 / 21.75 | 40% | 29% of 754 | $4,319 | 120% | 1% |
| Backed royalty | P1 | 67 | −2.87 / −1.05 / 18.83 | 37% | 25% of 741 | $4,454 | 123% | 5% |
| Inheritor | P1 | 20 | 0.00 / 0.00 / 8.92 | 18% | 29% of 423 | $4,087 | 114% | 4% |
| Bootstrapper | full | 35 | 0.00 / 0.27 / 9.31 | 31% | 36% of 407 | $3,231 | 76% | 1% |
| Backed equity | full | 71 | 0.00 / 0.83 / 22.50 | 48% | 42% of 552 | $2,988 | 72% | 2% |
| Backed royalty | full | 60 | −2.72 / −0.77 / 30.18 | 43% | 34% of 507 | $3,902 | 95% | 6% |
| Inheritor | full | 20 | 0.00 / 0.00 / 8.57 | 20% | 28% of 394 | $4,552 | 117% | 3% |

Other five-year Bootstrapper cells (S5; NW y5 p50 / p90; claims profitable): P1 `balanced` 51; 0.49 / 9.90; 43%. P1 `aggressive` 19; 0.00 / 6.42; 19%. P1 `undercap` 3; 0.00 / 0.00; 3%. P1 `noTest` 31; 0.35 / 5.63; 20%. Full `balanced` 29; 0.21 / 5.96; 30%. Full `aggressive` 2; 0.00 / 0.00; 2%. Full `undercap` 3; 0.00 / 0.00; 2%. The Backed-royalty owner's NW goes negative because the unpaid royalty contribution is carried as deferred revenue (DESIGN §11, D-11.12) while the company loses money. The Backed-equity full-rules median at year 5 (0.83) shows the waterfall-floor problem of §5.3: aligning the model's calendar with DESIGN §1 (the mean-calendar season one week shorter, freeze-up 1–3 weeks) moved it from 0.37 to 0.83, while every other five-year median moved by 0.07 or less.

**Lever checks** (cautious, 500 games per cell on the seeds of the two-season table; S2, pooled FSP and pooled B2 in %):

| Lever | Rules | North plan-authority share | S2 Bootstrapper | S2 Backed equity | S2 Backed royalty | S2 Inheritor | Pooled S2 | Pooled FSP | Pooled B2 |
|---|---|---|---|---|---|---|---|---|---|
| before R-1 and R-3 | P1 | 4.8% | 64 | 80 | 78 | 46 | 63 | 36 | 91 |
| **R-3 (approved; Inheritor cash $300k)** | P1 | 4.8% | 64 | 80 | 78 | **60** | **68** | 36 | 93 |
| before R-1 and R-3 | full | 4.8% | 45 | 74 | 71 | 30 | 49 | 17 | 85 |
| R-3 | full | 4.8% | 45 | 74 | 71 | 43 | 53 | 18 | 87 |
| R-1 (permit stub 2000 / 0.60 / 0.20) | full | 10.0% | 51 | 76 | 75 | 30 | 52 | 19 | 87 |
| **R-1 + R-3 (approved)** | full | **10.0%** | 51 | 76 | 75 | 40 | **55** | 19 | 90 |

R-1 changes the world draw, so its rows play a different world on the same seed and are not paired with the others; the Inheritor's 40% against 43% is that world difference. `undercap` S2 / B2 under full rules with R-1: 12% / 30% (9% / 32% before). The rows in bold are the approved sections: P1 pooled S2 68% (on-track) and full-rules pooled S2 55% (off, §9.5 item 5). Pooled B2, O-01's second clause since the owner's ruling of 2026-10-05, is 85–93% in every row, above the 75% floor. The model had no reorganization and no investor check-ins, so every B2 failure in it is a liquidation and its reorganization share is zero; B2 was not re-measured under the new definition (§9.4, O-01).

### 9.4 Scorecard

Status words (§1 rule 5): **on-track** = the preflight value is inside the band for the phase where the target first gates; **at-risk** = near an edge, inside in one rule set or start and outside in another, or not measurable by the preflight model (stated); **off** = clearly outside.

| ID | Preflight value | Status | Reason |
|---|---|---|---|
| T-01 | mined-block p10 / p90: north 0.010 / 0.038, arid 0.010 / 0.036; paystreak bcy in 0.005–0.03: 52% / 41%; pockets 0.11% / 0.19% | at-risk | (b) and (c) in band; (a)'s p90 sits 0.001–0.003 above 0.035 because the richest blocks are mined first |
| T-02 | north 64.0 / 25.4 / 9.1 / 1.5; arid 63.1 / 26.5 / 9.5 / 1.0 | at-risk | in band here, but DESIGN §3.7's full-network harness gives north 73.1% uneconomic (band ≤ 72%); the two bracket the edge, and the P0 full-generator run decides (DESIGN D-3.36) |
| T-03 | `refSmallNorth` 67.8% uneconomic, good + excellent 7.5% | on-track | both clauses in band; arid starter (reported) 51.8% uneconomic |
| T-04 | 36 / 36 / 39 bcy/hr; well only 28 | on-track | every gated fixture in 30–75; the well-only case matches DESIGN §7.20's 28–30 |
| T-05 | 242 bcy/hr; 326,957 bcy | on-track | both clauses met |
| T-06 | 61,494 bcy, 500 raw oz (413 fine); season 1 at 81% | at-risk | all three clauses in band; season 1 sits 1 point above the 80% floor, so any loss of frozen-ground throughput breaks it |
| T-07 | fuel + wages 64–66%, R&M 20–26%, fuel 13–21% across the five gated fixtures | on-track | every clause met; the trucked arid plant (reported) is 47% fuel + wages because water trucks are 28% of its opex |
| T-08 | (a) $319k; (b) 0.95; (c) 0.75; (d) M-FLIP 1–5% of cautious producing seasons over 5 years (the model counts game years; the engine counts season-years, §5.8) | (a–c) on-track; (d) at-risk | (d) is not measurable here: the reduced cautious bot borrows nothing, and with royalties alone seasons are mostly clearly won or lost; P4 equipment debt at ≤ 50% LTV has to lift it to 15% |
| T-09 | P1 asks $113–256k; new `dz9` $1.50M, `pkg300` $1.58M; tired `ex13` hammer ≈ $15k (DESIGN §9.2) | on-track | every clause met by the catalog |
| T-10 | (a) 0.0113; (b) 0.81 thawed, 1.02 at p 0.8 (reported); (c) 1.37 engine, 1.36 yardstick | on-track; frozen ratio carried as an O-04 risk | (b) is measured on thawed ground (R-4, approved) and passes; on frozen ground the mature fleet has no unit-cost advantage (1.02), the named risk carried on O-04 |
| T-11 | low −$8k at May month-end; drawdown 32%; year +$35k | on-track | all clauses met; a profitable year still runs out of cash in May on the level schedule; DESIGN §11.15's table puts the low in June at −$111k (R-5, approved: the table is regenerated from the engine at P1 exit) |
| T-12 | site season p50 22 (p10–p90 20–24); sluicing weeks 22.0; arid 47.4 | at-risk | the site-season and arid medians are in band; the sluicing-week median 22.0 sits on the 18–22 band's upper edge, because M-SEASON counts only the cool-week and freeze-up hour cuts, not the start-up and cold-water losses that DESIGN §1.4.3's ≈ 20 weeks include (§5.8) |
| T-13 | not run here; DESIGN §10.6's 2,000-seed calibration has every row in its band | on-track | the section's own calibration; re-checked by the engine at P5 |
| T-14 | not modeled; DESIGN §12.7's sum of bases × drivers ≈ 4 events a year | at-risk | only the frequency estimate exists; event costs are unmeasured until P3–P5 |
| T-15 | (a) one starter lease per district by construction; (b) 10.0% north with R-1 (approved; 4.8% before) | on-track | (b) clears 8% by 2 pp; arid (no band) 6.6% |
| T-16 | setup books owner NW $520k / $250k / ≈ $280k (Inheritor in P1 with R-3; ≈ $238k from P2) | on-track | the model uses the DESIGN §1.11 and §1.22 values; R-3 adds $50k to the Inheritor's company cash and so to its starting NW; the unit test has nothing to tune |
| T-17 | not modeled | at-risk | DESIGN §14.13 publishes reference projects but no class-share run; hard rock is optional (P6) |
| O-01 | **S2** with the approved R-1 and R-3: P1 pooled 68% (64 / 80 / 78 / 60; R-3 only, P1 with R-1 not re-measured); full 55% (51 / 76 / 75 / 40). Before them: P1 63%, full 49%. **B2** (owner ruling 2026-10-05): pooled 93% (P1, R-3) and 90% (full, R-1 + R-3); before them 91% / 85%, per start P1 88 / 100 / 100 / 85 and full 79 / 100 / 100 / 75 (per start not re-measured with R-1 and R-3). Reorganization share: not modeled | S2: P1 on-track, full rules (P4+) off. B2: on-track in both rule sets | **S2** is 5 pp short of 60% under full rules: permit waits kept 69% of Bootstrappers from mining in season 1 before R-1 (not re-measured with it), and the Inheritor's cash still meets insurance, G&A and grade-D availability. Remaining-gap plan (§9.5 item 5, approved by the owner): keep the band and close the gap in engine tuning at P2–P4 with `permits.reviewTimeMult`, then `geology.supply.starterLeasePerDistrict`, then the Inheritor terms. **B2** clears its floors (70% interim, 75% from P4) by 15–23 pp but is not re-measured under the new definition: the model had no reorganization (every failure was a liquidation through the P1 counter, under full rules too) and no investor check-ins or ouster (Backed B2 100%). By arithmetic only, if O-06 (d) lands in its 8–25% band, Backed-equity B2 falls to 75–92% and pooled B2 by 1.3–4.2 pp, because Backed equity carries a sixth of the pooled weight. Bots file for reorganization only where a liquidation would otherwise follow (§4.0), so counting filings as failures should not by itself lower B2; the engine's P4 ladder, which replaces the model's counter, can |
| O-02 | P1 pooled 36% (interim 20–45%; 36% with R-3); full 17% (19% with R-1 + R-3); highest bot 43% / 28%, lowest 10% / 2% (per-bot values not re-measured with R-1 and R-3) | on-track | every clause met in both rule sets |
| O-03 | `undercap` S2 15% / 9% (full 12% with R-1), B2 22% / 32% (full 30% with R-1) | on-track | fails usually, survives sometimes, in both rule sets |
| O-04 | Bootstrapper, year 5: `cautious` S5 58, NW median 0.55, p90 11.17 against `balanced` 51 / 0.49 / 9.90 and `aggressive` 19 / 0.00 / 6.42 (P1); full 35 / 0.27 / 9.31 against 29 / 0.21 / 5.96 and 2 / 0.00 / 0.00 | off | `cautious` dominates both on all three metrics; `aggressive`'s upside (second claim, financed scale, price rallies) is missing from the reduced model, and frozen ground gives large fleets no cost edge (T-10 b's frozen ratio 1.02, the named risk R-4 carries here); judged at P4 (§9.5 item 6, approved by the owner); five-year cells not re-measured with R-1; reorganization and the three option bots of §8.4 were not modeled |
| O-05 | `cautious` Bootstrapper S2 67 / 66 / 49, B2 90 / 86 / 94, NW median 1.00 / 0.67 / 0.52; Backed S2 95 / 85 / 74 | off | no easy-to-standard step for the Bootstrapper (the extra easy cash buys a bigger fleet tier), and B2 rises on hard because a shorter grace turns bankruptcies into last-resort fleet sales; gates only at P6, re-measured after the R-6 trial (§9.5 item 8, approved by the owner) |
| O-06 | (a) P1 64 / 80 / 78 / 60 with R-3 (Inheritor 46 before); full Inheritor 43 with R-3 (40 with R-1 + R-3; 30 before); (b) owner-ahead at year 5, before R-3: P1 41 / 40 / 37 / 18 (gap 23 pp), full 31 / 48 / 43 / 20 (28 pp), not re-measured with R-3; (c) 97% / 89%; (d) not modeled | (a) P1 on-track, full off; (b) off; (c) on-track | R-3 brings the Inheritor's P1 S2 into band (60%), but under full rules it stays below 50% (43%); the Inheritor still trails on year-5 NW (measured at $250k); R-6 is the proposed fix for (b), approved by the owner as a P1 trial (§9.5 item 7); (d) now counts a reorganization filed while a redemption demand is open as a loss (DESIGN D-1.50), not modeled |
| O-07 | S2 Δ −3 to +3 pp for both starts; Geologist NW 1.08× (Bootstrapper), 1.22× (Backed median; 1.00× by owner-ahead share) | at-risk | S2 parity holds with room; the Backed Geologist clause fails on the median (1.22×). In these cells the Backed medians are off the waterfall floor (`none` 0.85), so the approved owner-ahead rule (§5.3, item 10) does not replace the median, although the owner-ahead share gives 1.00×; the same Backed median is 0.20, on the floor, in the core cell, so which reading applies flips on a few seeds |
| O-08 | P1: Bootstrapper +19 pp, +0.28, testing 12%; Backed +11 pp, owner-ahead +10 pp, testing 3%. Full: Bootstrapper +20 pp, +0.24, testing 31%; Backed +9 pp, owner-ahead +22 pp, testing 5% | at-risk | P1 passes every clause, with the Backed NW clause read by owner-ahead share (§5.3, approved); under full rules the Bootstrapper's testing share exceeds 15% (permit waits shrink its first-season commitment) and Backed's S2 gain is 1 pp short (full rules before R-1, not re-measured) |
| O-09 | not modeled (no wear) | at-risk | unmeasured until P3 |
| O-10 | not modeled (no forwards) | at-risk | unmeasured until P5 |
| O-11 | DESIGN §10.5 states 12%; this model's simpler price path 19.7% | on-track | the section's calibration is in band; the preflight path lacks the macro link and fair-value pull, so its 19.7% is not evidence against |
| O-12 | not modeled | at-risk | unmeasured until P5; DESIGN §12.15 sets the targets without a published run |
| O-13 | not modeled | at-risk | unmeasured until the P1 engine exists |
| O-14 | P1 cash cost / AISC ÷ realized: Bootstrapper $3,059 / 85%, Backed $4,319 / 120%, Backed royalty $4,454 / 123%, Inheritor $4,087 / 114%; full: 76% / 72% / 95% / 117% | off | only the Bootstrapper is in the P1 band: the reference fleet on small claims (Backed) and the grade-D fleet on poor family ground (Inheritor) make the median season a loss (Inheritor measured at $250k, not re-measured with R-3); R-6 is the proposed fix, approved by the owner as a P1 trial (§9.5 item 7) |
| O-15 | `cautious` 31% (P1) / 36% (full); `aggressive` 19% / 2%; `undercap` 3% / 2% | at-risk | `cautious` sits at the 35% edge; `aggressive` is below 25% for O-04's reasons |
| O-16 | 42% (P1) / 44% (full) | on-track | inside 15–70% |
| O-17 | not modeled (no events, no reorganization) | at-risk | unmeasured until P5; it now counts each run's first filing of either kind (§5.10) |
| O-18 | not modeled (no entity effects) | at-risk | unmeasured until P4 |
| O-19 | not modeled (no hard rock) | at-risk | unmeasured until P6 |
| G-01 to G-09 | not modeled (no lease-or-buy bots, equipment market, permits enforcement, finance products or market sanity checks) | at-risk | unmeasured; each gate's owning section has no published run either |

### 9.5 Decisions approved by the owner

The preflight raised ten decisions. The integrator adopted five of them (items 1–4 and 10) on 2026-10-04 and recommended answers for the other five (items 5–9); on 2026-10-05 the owner approved all ten as written. The same day the owner ruled on DESIGN §0's open questions, and three of those rulings change BALANCE (items 11–13). Items keep their numbers so that other documents can cite them. Approved values are data in the owning sections' tuning tables, so a later change is an ordinary logged tuning or bot change (§8.2, §6.7).

**Adopted by the integrator, approved by the owner on 2026-10-05**

- **1. R-1, permit stub supply.** `geology.permitStub.minLastSeasonYear` 2010 → 2000 and `planP` 0.50 → 0.60 (`noticeP` stays 0.20, so none is 0.20; DESIGN §3.9, D-3.48). Effect: northern listings with plan authority 4.8% → 10.0% (T-15 b on-track); full-rules pooled cautious S2 49% → 52%. Alternatives measured: `planP` 0.85 alone 7.8%, 2000 with 0.50 8.2%.
- **2. R-2, bot refinements.** DESIGN §2.12.1's catalog (D-2.29) carries the six *(refined)* rules of §4 in substance (reserve, owner-foreman, cautious starter-tier grade D, mechanic hire, arid single water truck, aggressive affordability test) and documents bot version 1.0. Effect: the bots behave as the brief describes them; every preflight cell already used these rules.
- **3. R-3, Inheritor cash.** `game.start.inheritor.companyCashUsd` $250,000 → $300,000 (DESIGN §1.21, D-1.54). Effect: Inheritor S2 46% → 60% (P1) and 30% → 43% (full); P1 pooled O-01 S2 63% → 68%; full-rules pooled S2 with R-1 + R-3 55%; Inheritor owner NW at start ≈ $230k → ≈ $280k (P1), ≈ $188k → ≈ $238k (P2+).
- **4. R-4, mature anchor.** T-10 (b) is measured on thawed ground (DESIGN §7.20). Effect: T-10 (b) passes at 0.81; the frozen-ground ratio (1.02) is carried as a named O-04 risk.
- **10. Owner-ahead share.** Where a Backed median sits on the investor-waterfall floor, outcome gates use the owner-ahead share instead of the median (O-06 b, O-07, O-08; §5.3), and DESIGN §1.22's start-parity and background-parity gates say the same (D-1.55). Effect: those gates stop flipping on a few seeds (the same Backed cell's median was 0.20 on one seed set and 0.85 on another, and a small calendar correction moved the full-rules five-year Backed median from 0.37 to 0.83, §9.3).

**Recommended, approved by the owner on 2026-10-05**

- **5. O-01 under full rules.** With R-1 and R-3 the pooled S2 is 55% against 60–70% (pooled B2 90%, above its floor, item 11). *Approved:* keep the band. The remaining gap is P2–P4 tuning in the engine, in this order: `permits.reviewTimeMult` (DESIGN §6), `geology.supply.starterLeasePerDistrict` (DESIGN §3), then the Inheritor terms (DESIGN §1). Do not widen the band before the engine confirms the gap.
- **6. O-04, dominance.** *Approved:* keep the target and judge it at P4, when finance, the second claim and price upside exist. If it still fails, the levers are `finance.startupCapUsd`, DESIGN §9.2 plant prices and `ops.thawK`.
- **7. R-6, claim-sized fleets.** *Approved as a P1 trial only*, for O-14 and O-06 (b); it is untested. Adopting it after the trial is a bot change: `BOT_VERSION` bumps and the baseline is regenerated (§6.7).
- **8. O-05, difficulty.** *Approved:* no change now (it gates at P6); re-measure after the R-6 trial, because the easy-standard tie comes from fleet-tier jumps rather than from the DESIGN §1.11 knobs.
- **9. R-5, the DESIGN §11.15 table.** *Approved:* regenerate it from the engine's `refSmallNorthDebt` run at P1 exit. The month of the first settlement decides how deep the trough is: the engine on the mean calendar settles the first lots in late May and bottoms at −$8k, while the table assumes June and −$111k.

**Owner rulings of 2026-10-05 applied here**

- **11. Survival is gated both ways** (DESIGN §0.3, "gate both"; D-1.49, D-2.16). O-01 gates pooled going-concern S2 in 60–70% **and** pooled no-bankruptcy B2 ≥ 75% for `cautious` on standard (§3.1). B2's phase floors follow S2's pattern, as far below the final value as S2's lower edge: 70% in P1–P2, 73% in P3, 75% from P4 (§7). B2 per start is reported and the pooled value gates. Every survival figure prints S_N, B_N, the reorganization share RS_N and the retreated share B_N − S_N side by side (§5.1–5.2, §6.6). Effect on the preflight: nothing to re-tune; pooled B2 is 85–93% in every measured row (§9.3), not re-measured under the new definition (§9.4). Rationale: the two readings differ by 20–35 points. S2 alone would pass an economy in which every careful player who stops being a going concern also goes bankrupt; B2 alone counts a bot that retreats with no iron and no cash as surviving.
- **12. A bankruptcy filing of either kind fails the window; the bankruptcy rate is split** (DESIGN §0.9, "allow reorganization"; DESIGN §11.16, D-1.50, D-1.56, D-2.30, D-2.33). A liquidation or a Chapter 11 Subchapter V reorganization filing in years 1..N fails both B_N and S_N; a reorganized run keeps playing and every other metric is measured on it normally, its net worth scored by `netWorth(state, 'scoring')` (§5.1, §5.3). "Bankruptcy" in O-03, O-10, O-17 and G-04 means BK_N, the share of games with a filing of either kind, always printed with the liquidation rate by cause and the reorganization-filing rate by status (§5.1); O-17 counts each run once, at its first filing (§5.10); O-06 (d) counts a reorganization filed while a redemption demand is open as a loss, as DESIGN D-1.50 does. A debt-discharge gain is not income for FSP (§5.6), and in a case, adequate protection and plan installments are debt service for M-FLIP (§5.8). From P4 every bot answers an involuntary petition with a reorganization and files the first plan that passes (§4.0). Rationale: counting a filing as a failure keeps the new lifeline from inflating survival, measuring the run afterwards keeps late-window net worth honest, and a discharge gain is forgiven debt, not earnings, so it must not turn a losing first season into a profitable one.
- **13. Multi-claim options add levers and risks, not targets** (DESIGN §0.7, "all of these"; D-2.32, D-7.19, D-8.48–D-8.50, D-9.21). The core bots and every fixture keep one plant line per claim, a foreman on every claim and site mechanics (§2.1, §4.0). Three named bots, `smallCrewNoForeman` (P1), `multiLine` and `poolMechanics` (P3), each take one option (§4.5) and join O-04's list of bots that must not dominate `cautious` (§3.1); §8.4 names the risks and levers, and the outputs report how often each option is used (§6.6). Rationale: listing the option bots in O-04's existing clause is the only way the simulator can catch a dominant option without adding a target, and keeping the defaults keeps the version 1.0 baselines comparable with the preflight.

---

## 10. Phase report template

Every phase exit writes `docs/balance/phase-N.md` from `sim:balance --phase N` output, using these headings. A phase is signed off when the reviewer has checked every item in 10.9.

```markdown
# Balance report: phase N (<phase name>)

## 10.1 Run identity
- git SHA: <sha>; tuningHash: <hash>; BOT_VERSION: <v>; seedBase: <S>; games per cell: 500; rules: pN
- matrix blocks run (BALANCE §6.4): <list>; wall time: <h:mm> on <cores> cores; engine ms per game-week, explanations off: mean <x>, p95 <y> (DESIGN §2.13, D-2.15: ≤ 3.5 mean, ≤ 8 p95)
- baseline compared against: docs/balance/baseline-phase-<N-1>.json (or "none")

## 10.2 Scorecard
| ID | Target | Band (BALANCE §7 for this phase) | Measured (95% interval) | Status | Change since baseline |
|---|---|---|---|---|---|
(one row for every target and gate BALANCE §7 marks G or R for this phase, in ID order; R rows say "reported")

## 10.3 Gating summary
- FAIL among gating targets: <none | IDs>
- AT-RISK among gating targets, one sentence each on cause and plan: <IDs>
- DESIGN §1.19 exit gates for this phase not covered above: <list with status>

## 10.4 Start, bot and background tables
- per cell: S_N, B_N, the reorganization share and the retreated share by year (BALANCE §5.1–5.2); the bankruptcy rate split into
  liquidations (filed, involuntary, converted, P1 counter) and reorganization filings (completed, converted, open); first-season profit;
  production-attempt rate; owner NW ratio p10/p50/p90 by year; cash cost and AISC per oz; claims profitable; district split;
  owner injections; causes of loss (liquidated, ousted, scenario lost); use of the multi-claim options (most plant lines on a claim,
  claim-weeks under the small-crew rule, mechanic-weeks in pool mode)
- O-01: pooled S2 and pooled B2 against this phase's band and floor, with B2 per start beside them
- dominance matrix per start type (BALANCE §5.9): one row per bot pair with the three metrics and the verdict; for each bot, the share
  of its runs at or above its year-5 p90 that filed for reorganization
- option bots (BALANCE §8.4): smallCrewNoForeman, multiLine and poolMechanics against cautious, with the splits §8.4 names
  (multiLine by visible reserve, poolMechanics by access class and the number of games that posted a pool mechanic)

## 10.5 Fixtures
- every BALANCE §2.1 fixture: bcy, bcy/hr, raw and fine oz, site opex by line, margin, royalties, debt service, net,
  cash cost and AISC per oz; break-even grades (M-BE) at SR 1–8; the refSmallNorthDebt month-end cash table

## 10.6 Tuning changes this phase
| Date | Key | Old → new | Owning section | Target(s) | Before → after (intervals) | SHA |
|---|---|---|---|---|---|---|
(copied from data/tuning/CHANGELOG.md; "none" if none)

## 10.7 Bot changes this phase
- BOT_VERSION old → new; the rule changed and why; confirmation that the baseline was regenerated

## 10.8 Open risks for the next phase
- targets expected to move when the next phase's systems arrive, with the expected direction and size

## 10.9 Sign-off checklist
- [ ] no FAIL among gating targets; every AT-RISK explained
- [ ] O-01 reported on both clauses (S2 band and B2 floor), with the reorganization share and the retreated share beside them
- [ ] the same four identifiers (SHA, tuningHash, BOT_VERSION, seedBase) reproduce the summary JSON byte for byte
- [ ] every tuning change is in CHANGELOG.md and in the owning section's tuning table
- [ ] baseline-phase-N.json committed
- [ ] every BALANCE target that DESIGN §1.19 names for this phase gates in this phase in BALANCE §7, with the same band
- reviewer: <name>, date: <date>
```
