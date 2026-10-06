# Phase 1 triage rulings, part A (areas s01–s07)

Scope: every open issue in `digest-issues-a.json` (s01-structure 31, s02-architecture 20, s03-world 19, s04-prospecting 23, s05-land 27, s07-ops 27; 147 issues). Each ruling was checked against the cited DESIGN.md passage (and the other section where the issue is an interface mismatch), BALANCE.md, CLAUDE.md, DESIGN §0 and the P0 code where it matters.

Conventions:
- **Class** `integrator` = the integrator decides and records a decision in the owning section (shown as `D-<§>.n`: the integrator assigns the next free number at merge time; the highest ids in DESIGN today are D-1.67, D-2.59, D-3.61, D-4.58, D-5.60, D-6.58, D-7.54, D-11.75, D-12.52, D-13.84). `owner` = expensive to reverse under CLAUDE.md working rule 2; the stated default is implemented and flagged.
- **Dup** points to the issue that carries the ruling (`s11-finance #12` etc. live in `digest-issues-b.json`).
- "No migration" below always means: P1 has released no save yet, so intra-P1 shape changes ship without a migration (ruling s02 #7); the v2 shape is frozen at P1 exit.

---

## s01-structure (§1)

**1. Owner desk-day queue and partial booking** (§1 1.9, 1.17 step 7, D-1.28)
- Decision: Adopt with these details. `Owner.deskQueue: DeskTask[]` with `DeskTask { kind: 'siteVisit' | 'recordsReview' | 'sellerAudit' | 'closing' (| 'permitPrep' P2); ownerSection: 3 | 4 | 5 | 6; ref: EntityRef; daysTotal; daysRemaining; queuedTurn }` (an array in FIFO order, no new id prefix) and `Owner.deskDaysForcedThisWeek`. Booking is partial: at action time a task books `min(daysRemaining, capacity left)` and queues the rest; `ownerTime: 'now'` books the whole task now and counts the excess as forced days (§8 cuts `availableFraction` by 1/6 per forced day; in an office week the cut is recorded but has no effect). In step 7 §1 resets used and forced days, then walks the queue in (`queuedTurn`, insertion) order: it asks the task's owner `canResolve(state, task)` (§3: `claimAccess(...).freightOpen`; others true); a blocked task keeps its place and spends nothing; otherwise it books `min(daysRemaining, capacity left)`. A task reaching 0 is resolved by its owner's step-7 part in the same week (§3 site visits right after §1; a §4 records review starts its 2-week lag that turn). `ownerDeskDays` returns `{capacity, used, queued: Σ daysRemaining, forcedThisWeek}`. No cancel action in P1; payment taken at action time is not refunded (D-3.41). This makes a 4-day visit possible in a 2.5-day field week (two weeks) and keeps the 1.22 and 3.18 owner-time tests as written.
- Class: integrator · Owning: §1 1.9 (new D-1.n), §3 3.12 wording · Affects: s01 company, s03 site visits, s04 records reviews and pan surveys, s08 `availableFraction`, s13 desk-days panel · Dup: — (s03 #9 is a duplicate of this)

**2. Formation fee and the turn-0 net worth** (§1 1.6, 1.22, D-1.64)
- Decision: Adopt. The formation fee is billed by §11 in step 14c of turn 1 (category `vendor.other`, account `exp.ga`, memo "entity formation"), so turn-0 owner NW equals the 1.8 table for every entity ($520,000 LLC Bootstrapper). The annual entity fee is billed in 14c of every week-13 turn, year 1 included.
- Class: integrator · Owning: §1 1.6 (D-1.n) · Affects: s11 finance (recurring §1 owner items), s02 sim start NW (s02 #15) · Dup: s11-finance #12 (same issue; this ruling)

**3. Start-table and stub values without tuning keys** (§1 1.8, 1.8.2, 1.7, 1.16, 1.4.3, 1.20)
- Decision: Adopt; add the keys to `data/tuning/game.ts` and list them in 1.20 in the same commit: `game.start.backed.ownerCapitalUsd` 200,000, `game.start.backed.personalCashUsd` 50,000 (shared by both Backed terms), `game.start.inheritor.personalCashUsd` 40,000, `game.start.<start>.personalCreditScore` 760 / 720 (backed) / 680, `game.start.<start>.reputation` 45 / 50 / 55, `game.start.regulatorStandingStart` 60 (consumed from P2), `game.inheritor.notePrincipalUsd` 320,000, `noteRate` 0.085, `noteTermMonths` 84, `fuelApUsd` 12,000, `fuelApDueWeek` 4, `estateAppraisalUsd` 120,000, `game.banker.p1LoanUsd` 150,000 / `p1LoanRateSpreadOverPrime` 0.02 / `p1LoanTermMonths` 60, `game.reputation.sponsorMinUsd` 2,500, `game.season.aridDesert.monsoonStart{Mean 27, Sd 1.2, Min 24, Max 30}` and `monsoonEnd{Mean 38, Sd 1.5, Min 35, Max 41}`. The former hand's ask gets `game.inheritor.formerHandAskUsdPerHr` 34 only if s08-staff #7's ruling keeps a fixed ask; otherwise no key. Difficulty reaches these only through the existing multipliers (Diff = no).
- Class: integrator · Owning: §1 1.20 · Affects: s01, s11 (fixed loans), s02 sim setup, data schemas · Dup: s11-finance #4 overlaps (loan terms); s03 #16 overlaps (game.inheritor keys)

**4. F_m in two homes** (§1 1.5.1, 1.20, D-1.30)
- Decision: Adopt. One 12-month table per template, `game.weather.fireSeasonFactor.<tpl>`, holding the 1.5.1 values; `game.weather.aridFireFactor` is removed (its May–Jul cells are the arid row's). No F_m in `data/calendar.ts`. The tuning hash then covers the calibrated cells.
- Class: integrator · Owning: §1 1.5.1, 1.20 · Affects: s01 climate · Dup: —

**5. Backed-equity pref in P1** (§1 1.8.1, 1.19)
- Decision: Adopt. Under P1–P3 rules `prefUnpaidCents` stays 0 (no accrual, no arrears draw block); accrual ships with `investor/payReturn` behind `rulesAtLeast(state, 4)`. The waterfall code keeps the pref term. The phase report notes that P1 Backed-equity NW omits the pref drag.
- Class: integrator · Owning: §1 1.19 (D-1.n) · Affects: s01 investors, s11 step 14, s02 BALANCE report (O-06 reading) · Dup: —

**6. Owner fields that mirror ledger balances** (§1 1.9, §11 11.2)
- Decision: Adopt. `personalCash`, `personalDebt`, `guaranteeDueCents`, `taxDueCents` and `ownerLoanToCompany` are not stored; §11 publishes selectors over the owner book (`ownerPersonalCash(state)` etc.) and §1 re-exports them. `Owner` stores only non-ledger fields (name, credit score, guarantees, salary, assignment, pending assignment, desk days, injury). Amend the 1.9 interface comments to "derived".
- Class: integrator · Owning: §1 1.9 · Affects: s01, s11, s13 (owner panel), s02 bots · Dup: —

**7. Caching accessOpen** (§1 1.17(f), 1.4.5)
- Decision: Adopt. Nothing is stored. `accessOpen(state, districtId, mode)` is computed on demand from the current season, phase, `weather`/`lastWeather` and district flags, then the hook overrides at call time (it is a handful of comparisons). Memoize only if profiling asks for it, under §2.3 item 6 (scoped to the identity of the district's climate record and `events.modifiers`). Reword 1.17(f) and §2.6 step 1(f) to "compute".
- Class: integrator · Owning: §1 1.4.5, 1.17 · Affects: s01, s02 step-1 text · Dup: —

**8. accessOpen signature and mode names** (§1 1.4.5, D-1.27; §3 3.3.3)
- Decision: Adopt. `accessOpen(state, districtId, mode)` with `AccessMode = 'highway' | 'seasonalRoad' | 'winterTrail' | 'air' | 'barge'`, current week only. `claimAccess(state, claimId)` drops its turn parameter (current week only; planning uses `accessOutlook`) and applies `effective('geology.access.closed', { claimId, districtId })` itself, since `accessOpen` sees only district scope. Fix §3 3.3.3's text in the same change.
- Class: integrator · Owning: §1 1.4.5; §3 3.3.3 · Affects: s01, s03, s07, s09, s10 callers · Dup: — (s03 #10 is a duplicate of this)

**9. accessOutlook horizon** (§1 1.4.5)
- Decision: Adopt. `accessOutlook(state, districtId, mode, turn)` and `phaseOutlook(state, districtId, turn)` take an absolute turn. A turn in a year not yet rolled uses climatology (μ ± 1.2816·s·σ, v = ∞) for every date. Arid seasonal road: turn + 1 is exact (closed iff this week is a storm); later turns read `open` (storms are short-notice; a booked action slips per 1.4.5). Document in 1.4.5.
- Class: integrator · Owning: §1 1.4.5 · Affects: s01, s09 transport bookings, s13 · Dup: —

**10. weather.severe trigger** (§13 13.10, §1 1.5)
- Decision: Adopt, with severities tied to P1 effects. Edge-triggered, held districts only, one signal per district per week (the highest), `dedupeKey = weather.severe:<districtId>:<kind>`. Warning: `fireLevel` rising to ≥ 3 (day shift capped at 8 h); an arid storm week when the company holds a seasonal-road claim there (washout next week). Info: `fireLevel` rising to 2; the arid day-shift heat factor first falling to ≤ 0.70; a northern storm week. About 3–4 warning stops a year on arid ground, inside O-13.
- Class: integrator · Owning: §1 1.5 (new paragraph), §13 13.10 row · Affects: s01, s12/s13 inbox, O-13 · Dup: —

**11. Welcome and estate letters** (§1 1.15, §13 13.10)
- Decision: Adopt. Add alert kind `company.welcome` (info, edge, §1) to `ALERT_KINDS` and the 13.10 table, with start-specific templates (Inheritor: estate letter with the note statement). `newGame` emits the turn-0 signals (welcome, week-1 `season.forecastUpdate`) and calls §13's collation helper once; no stop candidates are kept at turn 0.
- Class: integrator · Owning: §1 1.15, §13 13.10 · Affects: s01, s12/s13 inbox and text catalog · Dup: — (s13-ui #15 is the same issue)

**12. Weather-init draw order and the band clamp** (§1 1.5, 1.5.2)
- Decision: Adopt. `weather-init` draws, per district: tempAnom, moistAnom, wetnessPrev (flowAnom 0; drought 0 northern, 3 arid; no draw). The phase clamp sets T to the band's lower edge for "band ≥" rules and to edge − 0.1 °F for "band ≤" and upper-bounded rules (winter T ≤ 27.9; freezeup ≤ 44.9; breakup [0, 79.9]). Write both into 1.5 / 1.5.2.
- Class: integrator · Owning: §1 1.5 · Affects: s01 · Dup: —

**13. Draws while the P1 counter is open** (§1 1.9, 1.14, 1.21)
- Decision: Adopt. Under P1–P3 rules, while §11's P1 insolvency counter is open, `owner/draw` fails `DISTRESS_BLOCKED` and the sole-prop/LLC scheduled salary draw is skipped (info note); a corp owner's wage stays a payroll line (deferred first, §11 11.4). This is the P1 form of the stage-3 block (record in 1.9). Draws taken before the counter opens are not clawed back in P1 (clawback is P4); 1.21's exploit table notes the P1 gap.
- Class: integrator · Owning: §1 1.9 · Affects: s01, s11 distress selector (s02 #18) · Dup: s11-finance #17 is the same issue

**14. Owner-loan interest in P1** (§1 1.9, 1.16)
- Decision: Adopt. `debt.ownerLoan` carries principal only under P1–P3 rules; interest accrual at `game.ownerLoanRate` and `owner/repayLoan` ship together behind `rulesAtLeast(state, 4)`.
- Class: integrator · Owning: §1 1.9 · Affects: s01, s11 · Dup: s11-finance #22 is the same issue

**15. Owner salary in P1** (§1 1.16, §11 P1 payroll, D-11.27)
- Decision: Modify. A corp owner's wage is a payroll line with `isOwner`, burdened by `finance.p1PayrollTaxRate` (0.14) only: no workers' comp (D-11.27), so 1.14×, not the employees' 1.22×. A sole-prop/LLC scheduled draw is an `owner`-category item: when cash does not cover it, it is skipped for that week (info note), creates no arrear, and never opens the P1 counter.
- Class: integrator · Owning: §1 1.16, §11 11.3 P1 form · Affects: s01, s08 payroll lines, s11 · Dup: s08-staff #18 and s11-finance #8 overlap (owner items and owner WC); cross-area conflict C-6

**16. Salary above the investor cap** (§1 1.8.1, 1.16)
- Decision: Adopt. `owner/setSalary` above the lowest `ownerSalaryCapCents` fails `ABOVE_CAP_INVESTOR`; reword 1.8.1 and the 1.21 exploit row to "salary above the cap is not allowed; pay more through `owner/draw`, which carries the pro-rata share".
- Class: integrator · Owning: §1 1.8.1, 1.21 · Affects: s01 · Dup: —

**17. validateSetup and the rules phase** (§1 1.6, D-1.63, §2 --rules)
- Decision: Adopt. `validateSetup(setup, rulesPhase)`; `newGame` passes `options.rulesPhase`; non-Bootstrapper starts need rules ≥ 1 (`START_NOT_IN_PHASE`), and templates check `DISTRICT_TEMPLATE_NOT_IN_PHASE` against the rules phase too.
- Class: integrator · Owning: §1 1.6 · Affects: s01, s02 sim arg parsing · Dup: —

**18. Inheritor opening book** (§1 1.8.2, 1.22)
- Decision: Adopt. Opening postings in `newGame` (company book): company cash Dr `cash.operating` / Cr `eq.ownerCapital`; each inherited machine at its turn-0 `resaleEstimate` Dr `ppe.equipment` / Cr `eq.ownerCapital` (book basis = fair value at transfer; depreciation from there); the $120,000 appraisal split equally, $40,000 per claim, Dr `mineral.properties`; the note Dr `eq.ownerCapital` / Cr `debt.<noteId>` via §11 `createLoan` (seasonal schedule); fuel AP Dr `eq.ownerCapital` / Cr `ap.vendors` due week 4. §7 creates the family claim's `ClaimOps` with site `winterized` and the camp present (start-up needed, no mobilization). For an LLC/corp owner a `Guarantee` record is created on the note, inert until P4. Backed starts post the investor money to `eq.investor` (equity) or `deferred.revenue.<agreementId>` (royalty) per 1.8.1, the owner's $200k to `eq.ownerCapital`, personal cash to the owner book.
- Class: integrator · Owning: §1 1.8.2 (D-1.n) · Affects: s01, s05 tenures, s07 site state, s09 inherited fleet, s11 · Dup: — (s05 #24(d) and s11-finance #11 are covered by this)

**19. Simulator start NW for the Inheritor** (§2 2.12, sim/metrics/startNetWorth.ts)
- Decision: See s02 #15.
- Class: integrator · Owning: §2 · Affects: s02 sim · Dup: s02-architecture #15

**20. Data the end report needs** (§1 1.14, §2 2.5, §11 11.1)
- Decision: Adopt, limited to P1. Add a bounded `company.timeline` (decision log: purchases, loans, hires and sales above `game.endReport.timelineMinUsd` 50,000, distress stages, liquidation; ring of 200 entries). `YearRollup` gains `fineOzRecovered`, `cashCostPerOzCents` and `aiscPerOzCents` (from §11 11.19.5 at the rollup). Charts use the weekly ring plus annual points before it. §5 keeps ended tenures (bounded by claims ever held, s05 #16); §7 keeps a per-claim season summary (washed bcy, weighed raw oz, plant idle hours by cause) in `ClaimOps.seasons` (last 10). P1 lessons are limited to rules computable from those records (e.g. "bought on seller data only (seller was X)", "plant idle N% of season k: <root>"). No equipment-condition reveal (P3).
- Class: integrator · Owning: §1 1.14; §2 2.5 (YearRollup) · Affects: s01, s02 history, s05, s07, s11, s13 end-report screen · Dup: s11-finance #15 overlaps (cost/oz by year)

**21. Year's recovered fine oz** (§1 1.10, 1.12, D-1.39)
- Decision: Adopt. `CompanySnapshot.fineOzRecovered` (weekly): Σ cleanup weighed raw oz (gross, before in-kind interests) × the lot's estimated fineness at weighing, plus `source: 'sample'` lots at creation (estimated fine). §1's week-52 production inputs sum the year from history. No re-evaluation on assay in P1 (no assays of lots before P5). See s02 #19 for `weighedRawOz`.
- Class: integrator · Owning: §2 2.5; §1 1.12 · Affects: s01, s02 history, s07, s10 · Dup: s10-gold #13 overlaps (unit and source of the production counter); cross-area conflict C-14

**22. Record production year and cap timing** (§1 1.12)
- Decision: Adopt. "Record production year" needs at least one earlier producing year and must beat every earlier year's `fineOzRecovered`. Caps are applied in 16a against the applying year's counters; `capsUsedThisYear` resets at the start of week 1's 16a.
- Class: integrator · Owning: §1 1.12 · Affects: s01 · Dup: —

**23. Reputation inputs present in P1** (§1 1.12, 1.19)
- Decision: Adopt. P1 inputs: `missedPayroll` / `partialPayroll` (§11), `royaltyPaidInFull`, `missedAdvanceRoyalty`, `leaseTerminatedDefault`, `dealClosed` (§5), `firings3InWeek` (§8), production and record year (§1 week 52), sponsorship. `acceptedThenFailed` is not reachable in P1 (acceptAsk settles at action time, quick sale cannot fail). Vendor-lateness, loan-default and bonus kinds start with their systems (P4).
- Class: integrator · Owning: §1 1.12, 1.19 · Affects: s01, s05, s08, s11 · Dup: —

**24. Calendar test text** (§1 1.22, D-1.66)
- Decision: Doc fix: "`turnDate(60, 2027)` → Wk 9 · Feb 26–Mar 4, 2028" in 1.22.
- Class: integrator · Owning: §1 1.22 · Affects: — · Dup: —

**25. Investor-royalty payback state and the minimum** (§1 1.8.1, D-1.52; §5 5.12)
- Decision: Modify. §5's `ProductionInterest` is the single source: `paidToDate.valueCents` is the delivered value and `stepDown { usd 2.0 × contribution, newRate 0.03 }` switches to the tail inside settlement (5.12's step-down example). `InvestorAgreement.deliveredValueCents` is not stored; §1 exposes it as a selector over the interest. The minimum shortfall (years ≥ 2, until `stepped`) is computed by a §5 function `minimumShortfallCents(state, piId, year)` = max(0, minimum − Δ`paidToDate.valueCents` over game year Y) and, because week-52 cleanups run in step 12, it is evaluated by §11 in step 14c of week 52 (after that week's cleanups), as §1 1.17 and §2.6's "§1 owner items" in 14c already place it. §5 creates the obligation (owner `'§1'`, billable) and §11 bills it the same week in category `royalty.cash` (not `owner`). In P1–P3 an unpaid top-up is a failed payment that opens the P1 counter; P4 adds `investor.onMinimumMissed`. §5 5.12's "minimum and advance handling at anniversaries (step 6)" keeps `advance` mode only.
- Class: integrator · Owning: §1 1.8.1, §5 5.12 (D-5.n) · Affects: s01, s05, s11 · Dup: — (s05 #17 is a duplicate of this; s11-finance #13 overlaps); cross-area conflict C-3

**26. Sponsorship below minimum or above cap** (§1 1.16)
- Decision: Adopt. `community/sponsor` fails `BELOW_MINIMUM` under `game.reputation.sponsorMinUsd` (2,500) and `CAP_REACHED` when amount / `sponsorUsdPerPoint` exceeds the year's remaining cap (the message gives the maximum amount).
- Class: integrator · Owning: §1 1.16 · Affects: s01, s13 · Dup: —

**27. Weather and forecast explanations reveal drivers** (§1 1.5.2–1.5.5)
- Decision: Adopt. Nodes built from `z`, `A_year`, `W_year`, `f_t`, `D_t` and the forecast noise are tagged `hidden: true` with `knownAlt` "this week's anomaly vs climatology" (weather) and "issue signal" (forecasts). The visible results (band, precip, fire level, forecast P10/P50/P90) stay visible.
- Class: integrator · Owning: §1 1.5 · Affects: s01, s13 explain tests · Dup: —

**28. Arid-first tutorial needs supply** (§1 1.15, §3 3.11)
- Decision: Modify. Add a P1 world/market test over 200 seeds: every seed's arid district offers at turn 0 at least 3 listings with a lease structure, highway or seasonal-road access and an AMR ≤ 10% of Bootstrapper cash. Water is not required (the tutorial's dry-wash plant path covers dry claims). If the test fails, §3/§5 add an initial-market stratum rule (raised through s03/s05).
- Class: integrator · Owning: §1 1.15 (test), §3 3.11 (fallback rule) · Affects: s03, s05, s13 tutorial · Dup: —

**29. P0 golden under --rules p0 in a P1 build** (CLAUDE.md, D-2.34)
- Decision: See s02 #8.
- Class: integrator · Owning: §2 · Affects: s02 · Dup: s02-architecture #8

**30. O-03's P1 cell** (BALANCE §3.1 O-03, §7; §1 1.19)
- Decision: Read the §7 cell literally: in P1, O-03 gates `undercap` S2 in 2–40%; the B2 ≤ 40% clause is reported, and both clauses gate from P2 (plain `G`). The scorecard registry marks `O-03.B2` reported for phase 1. Note the reading in the phase report.
- Class: integrator · Owning: BALANCE §7 (note) · Affects: s02 sim:balance targets · Dup: —

**31. Ship the full company shapes now** (§1 1.18, D-2.34)
- Decision: Modify. Ship the fields DESIGN already defines in 1.8.1 (`InvestorAgreement`), 1.9 (`Owner`, less the ledger mirrors of #6) and 1.18 (`CompanySlice`, incl. `safetyRecord`, `scenario`), plus `deskQueue`, `deskDaysForcedThisWeek` and `timeline`, with inert starting values, so P2–P4 add behaviour, not fields. Do not invent fields DESIGN has not specified. This is the Wave-0 policy for every slice.
- Class: integrator · Owning: §2 (Wave-0 policy), §1 1.18 · Affects: all slice owners · Dup: —

---

## s02-architecture (§2, BALANCE harness)

**1. Foreman fixture contradicts the crew rule** (§2.14, §2.12.1, D-2.29, D-8.33)
- Decision: Adopt. Amend §2.14: "adding a second claim (or, from P3, a third plant line) makes it hire one; a second shift does not". Write the bot fixture that way.
- Class: integrator · Owning: §2 2.14 · Affects: s02 bots · Dup: —

**2. Constructing fixture games** (§2.2, §2.12 --fixture, BALANCE §2.1)
- Decision: Adopt. Add `newFixtureGame(spec: FixtureSpec, seed, opts?)` to the public surface (new D-2.n). It assembles owners' builders: §1 mean calendar (s02 #3), §3 reference claim with uniform truth and the fixture's water and access, §5 tenure and `ProductionInterest`s, §8 employees with exact skills (shown = true) and the owner as foreman, §9 machines at given grades and options, §11 opening cash and fixed loans via `createLoan`. `FixtureSpec` data live in `src/data/balance/fixtures.ts` (types imported from the engine). The state records `meta.fixtureId` so a replay can rebuild it. Only `sim/` and tests call it; the UI never does.
- Class: integrator · Owning: §2 2.2, 2.12 · Affects: s02 fixtures, s01, s03, s05, s08, s09, s11 builders · Dup: — (s08-staff #27 is the same need)

**3. Mean-calendar mode for fixtures** (BALANCE §2; §1 1.4–1.5)
- Decision: Adopt. §1 provides `calendar: 'mean'`, selectable only through `FixtureSpec`: season dates at the template means rounded half away from zero (northern breakup 19, duration 1, operating start 20 — the week BALANCE R-5 cites — freeze-up 42, freeze duration 2; arid monsoon 27–38); weekly weather at climatology: a_t = 0 and no season anomaly (T = Tclim with the phase clamp), precip `normal` every week, f_t = 0 and W = 0 (sff = H), drought updated from `normal` weeks; no `season`, `season-fc`, `weather` or `weather-init` draws. `ops-grade` draws stay; fixture seed = the phase `seedBase`, one game per fixture. §7's `productionForecast` "mean calendar" means its P50 calendar, not this mode.
- Class: integrator · Owning: §1 1.4/1.5 (D-1.n), §2 2.12 · Affects: s01 climate, s02 fixtures · Dup: —

**4. Fixtures with later-phase terms** (BALANCE §2.1, T-05, T-07, T-08c, T-11)
- Decision: Adopt. Under P1 rules every fixture runs the P1 form of its terms (local buyer, burden 1.22, flat maintenance by grade and 0.92 availability, debt as fixed §11 loans, no insurance), labelled "P1 approximation" in the phase report. T-05 and T-07 gate on the P1 run (they measure rate and opex shares, which these substitutions do not distort); T-08 c and T-11 stay reported. `matureNorth`'s models: see s07 #17.
- Class: integrator · Owning: BALANCE §2.1 (note), §2 2.12 · Affects: s02 fixtures, s09 catalog · Dup: — (s07 #17, s09-fleet #1 overlap on the models)

**5. G-03's Backed-royalty cell** (BALANCE G-03, §6.4; sim/balance)
- Decision: Adopt. Add a `passive` × Backed royalty cell to the named-bot block (cheap); the `g03.passiveB5` extractor returns N/A unless all three debt-free starts are present.
- Class: integrator · Owning: BALANCE §6.4 (note) · Affects: s02 sim:balance · Dup: —

**6. O-13 off-season window and the stops extractor** (BALANCE O-13, §6.6, D-2.57)
- Decision: Adopt with one change. Off-season = from the first held northern district's freeze-up start to its next breakup start, counted per off-season; arid-only games are excluded from that clause and counted in a note. Stops per year are exposure-weighted (Σ stops ÷ Σ game-years of exposure, §6.6) — fix the extractor. The gating cell is `cautious` × Bootstrapper (the 500-game sample O-13 names); the other three core starts are reported beside it.
- Class: integrator · Owning: BALANCE §6.6 (note) · Affects: s02 scorecard · Dup: —

**7. Saves from P0 and inside P1** (§2.9, D-2.34, D-2.43)
- Decision: Adopt. `CURRENT_SCHEMA_VERSION = 2` at P1 start, `MIN_SUPPORTED_SCHEMA_VERSION = 2`, and a typed `SAVE_TOO_OLD` error with §13 13.16's message for v1 saves. Intra-P1 shape changes need no migration (no P1 save has been released); v2 is frozen at P1 exit with a committed fixture, and from then on D-2.34 applies in full. Record as D-2.n and mention in the phase report as the reading of D-2.34.
- Class: integrator · Owning: §2 2.9 · Affects: s02 save, s13 Saves screen · Dup: —

**8. P0 golden in a P1 build** (§2.14, D-2.18, D-2.52)
- Decision: Adopt. Every step part declares its first phase in one table (see #11), so `--rules p0` runs only P0 parts. The state shape grows, so regenerate `p0-passive-52w` once under `--rules p0` with a CHANGELOG note (behavioural reproduction, D-2.18), and add P1 goldens (a passive and a scripted operating game). Bump `RULES_VERSION`.
- Class: integrator · Owning: §2 2.14 · Affects: s02 goldens, all step owners · Dup: — (s01 #29 is a duplicate of this)

**9. Week attribution of action-time postings in history** (§2.5, D-2.57; BALANCE §5.6)
- Decision: Adopt. `YearRollup` for year Y is written in step 16 of turn 52Y (year Y+1 week 1), with revenue and net income from §11 `periodTotals` for year Y and cash/NW end fields from the turn-52Y−1 snapshot. A Y-year sim game's final year comes from `periodNetIncome` (D-2.57 already does this). Snapshot week totals (`soldFineOz`, `weighedRawOz`, …) are differences of the owners' cumulative counters between consecutive snapshots, so an action-time sale after pipeline t − 1 is counted in snapshot t; document the one-week attribution.
- Class: integrator · Owning: §2 2.5 · Affects: s02 history, s10, s11, s02 observer · Dup: — (s10-gold #7 is the same issue)

**10. Intra-week handoffs** (§2.6; §7 7.18, §8 8.15, §9 9.12)
- Decision: Adopt. A typed `StepContext.week` scratch (built each `advanceWeek`, never in `GameState`, never hashed or saved) carries the week's handoffs: §7 `WeekOpsResult`s, machine and crew hours, cost lines and cleanup results; §4 program machine and crew use; §9 failure masks. Owners persist only what must outlive the week (last-week results for display) in their slices. Explain invariance and replay are unaffected.
- Class: integrator · Owning: §2 2.6 (D-2.n) · Affects: all step owners · Dup: — (s09-fleet #16 is the same issue)

**11. Merge hot spots** (§2.2, §2.11)
- Decision: Adopt; it is Wave 0's first job. Each system folder exports `actions.ts` (its `ActionDef`s, action union members and error codes), `select.ts`, `explain.ts`, `report.ts` (its week-record type) and `parts.ts` (its step parts). §2's files compose them: `actions/catalog.ts`, `select/index.ts`, `explain/index.ts`, `turn/types.ts` and `turn/parts.ts` (one table of `{ step, subOrder, owner, fromPhase, fn }`). Tests: no key collision across systems; the part table's order equals §2.6 (and its section sub-orders); every part's `fromPhase` gating matches #8.
- Class: integrator · Owning: §2 2.2, 2.11 (D-2.n) · Affects: every package · Dup: —

**12. §7 hooks missing from the §12 registry** (§7 7.19, §12 12.3, D-2.41)
- Decision: See s07 #14.
- Class: integrator · Owning: §12 12.3 · Affects: s07, s12 · Dup: s07-ops #14

**13. Bots reading tuning** (§2.12 Visibility)
- Decision: Adopt. `select.tuning(state, key)` returns a resolved engine tuning value (tuning is not hidden; §13 has a tuning viewer); hooked values are read through the public `effective()`. `BotView` exposes both.
- Class: integrator · Owning: §2 2.11 · Affects: s02 bots, s13 · Dup: —

**14. Observer inputs for O-08 and M-CLAIMPROFIT** (BALANCE O-08, §5.5; D-2.54)
- Decision: Adopt. §11 provides `spendByCategory(state, fromTurn, toTurn, claimId?)` over its cost centers (prospecting, acquisition, holding, mobilization, fleet capex, site opex, royalties cash and in-kind value); §9 provides `machinesAtClaim(state, claimId)` (visible location), which the observer samples weekly for the capital charge. The observer uses only these.
- Class: integrator · Owning: §2 2.11; §11 11.19 · Affects: s02 observer, s09, s11 · Dup: — (s11-finance #16 overlaps: per-claim allocations)

**15. Start NW for the NW ratio** (D-2.54; BALANCE §5.3, T-16)
- Decision: Adopt. Start NW for every start = `select.netWorth(state, 'scoring')` on the fresh `newGame` state, before any action (equals the tuning figure for Bootstrapper and Backed; includes the inherited fleet's resale and the note for the Inheritor; any `--tuning` override flows through). Amend D-2.54 and BALANCE §5.3's wording; delete the tuning-key table in `startNetWorth.ts`.
- Class: integrator · Owning: §2 2.12 (D-2.54 amended), BALANCE §5.3 · Affects: s02 observer, s13 wizard summary (s13-ui #4) · Dup: — (s01 #19 is a duplicate of this)

**16. Running the R-6 trial** (BALANCE §8.3 R-6; D-2.29)
- Decision: Adopt. A sim-only `--bot-variant r6` flag, recorded as `botVersion '1.0+r6'` in outputs and never used for baselines. At P1 exit the integrator decides adoption on the trial evidence (a `BOT_VERSION` bump logged in the tuning changelog, as §0 approved) and reports it in the phase report.
- Class: integrator · Owning: §2 2.12.1, BALANCE §8.3 · Affects: s02 bots · Dup: —

**17. O-13 depends on which alerts warn** (BALANCE O-13, §8.1)
- Decision: Adopt. Measure stops with `cautious` in `--quick` runs as soon as the vertical slice runs; tune through §13's default rules and alert thresholds and §11's watch weeks only, never through bots. Rulings that already lower noise: s01 #10, s07 #24 and b's s12-events #8 and #10.
- Class: integrator · Owning: BALANCE §8.1 · Affects: s02, s12/s13 · Dup: —

**18. Distress visibility in P1** (§2.11, §2.12.1; BALANCE §5.2)
- Decision: Adopt. §11 ships a P1 form of `distressStatus(state)`: `{ stage: null, p1Counter: { open, weeksOpen, graceWeeks, netCashCents } }`; §9 records each dealer sale as a visible `FleetSaleEvent { turn, machineIds, proceedsCents, distress }` with `distress` true when the P1 counter is open (or stage ≥ 3 from P4). The observer and bots read both.
- Class: integrator · Owning: §2 2.11; §11; §9 · Affects: s02, s09, s11 · Dup: — (s09-fleet #14 and s11-finance #9 overlap)

**19. Do sample lots count as weighed raw oz?** (§2.5; BALANCE T-06, §5.8)
- Decision: Adopt. `WeekSnapshot.weighedRawOz` and the fixtures' raw oz count cleanup weighings only. Sample lots are reported separately (`sampleRawOz`, prospecting gold). `fineOzRecovered` (s01 #21) includes both.
- Class: integrator · Owning: §2 2.5 · Affects: s02, s04, s07, s10 · Dup: —

**20. Estimator over budget** (§2.13, D-4.41, D-4.58)
- Decision: See s04 #2; the estimator's P1 perf work is a precondition of the bot package, and an estimator-week perf check with 8 tracked claims joins CI as soon as §4's P1 package lands.
- Class: integrator · Owning: §4 · Affects: s04, s02 · Dup: s04-prospecting #2

---

## s03-world (§3)

**1. Initial-market selection** (§3 3.11, 3.7, D-3.9)
- Decision: Adopt with the stream spelled out. Selection runs on `rng(seed,'supply','init')`, which §3 3.1 already uses and the P0 registry already lists (add `'init'` to §2.3's table): districts in ID order, n = max(`minInitialPerDistrict` 6, round(`initialListedShare` × held)); fill the 3.11 strata first, then the rest without replacement with weights ∝ `listingPoolWeights(econClass)`, so the opening market matches the steady-state pool; the reserved family run is excluded. Each initial candidate's own draws (ListingInfo, gauge bias, situation details) use `rng(seed,'supply',0,claimId)` in the same layout as a weekly candidate (hazard u taken and ignored), so retuning the initial share never shifts a candidate's draws; no `supplyTick` runs at turn 0, so nothing collides. Record as D-3.n.
- Class: integrator · Owning: §3 3.11 · Affects: s03, s05 · Dup: —

**2. Where initial candidates live** (§3 3.1, 3.6.1, 3.18)
- Decision: Adopt. `generateWorld` keeps its signature. `newGame` (rules ≥ 1) calls `createInitialListings(world, rng(seed,'supply','init'))` → `{ world, candidates }` right after `generateWorld`, then `genInheritedGroup` (Inheritor), then §5 `createListings(candidates)`. The reserved family run is never in the initial market in any start type, and otherwise keeps its normal status and holder. Gated on `rulesAtLeast(1)`.
- Class: integrator · Owning: §3 3.1, 3.13 · Affects: s03, s05, s01 newGame · Dup: — (s05 #15 overlaps)

**3. recentCat history on the family run** (§3 3.6, 3.6.1)
- Decision: Adopt the first option. In every world the reserved run's old-timer kind is drawn from the creek mix with `recentCat` removed (same draw count, renormalized), identical for all start types; this also removes a recentCat water right and permit stub there. It changes 3 parcels per world; rerun the §3 world calibration (T-01/T-02) and §4 calibration once with the other P1 world changes, and note it in CHANGELOG.
- Class: integrator · Owning: §3 3.6.1 (D-3.n) · Affects: s03, s04 calibration · Dup: —

**4. Seller-stream draw layout** (§3 3.10.2–3.10.3, §2.3 rule (e))
- Decision: Adopt. Document a fixed layout on `rng(seed,'seller',claimId,holderId)`: all fixed-count draws first (plan counts, old report, package, kOpt/kFraud, screened/loose/scrape choices, fraud counts and notes, invented seasons, permit statement, title-defect u), then the variable-length `drawSample` and fabricated-sample draws last. Record as D-3.n.
- Class: integrator · Owning: §3 3.10.2 · Affects: s03 · Dup: —

**5. New holder after an off-screen sale** (§3 3.11 onListingClosed; §2.3 (c))
- Decision: Adopt. The new holder's draws use the registered `rng(seed,'supply',turn,claimId)`; §5 guarantees that background sales and expiry never close a listing in its `listedTurn` (a listing is eligible for background sale from `listedTurn + 1`, and expiry is ≥ 1 week after listing), and a listed claim takes no hazard roll, so the key is used once per claim per turn. No key-shape change.
- Class: integrator · Owning: §3 3.11; §5 5.3 · Affects: s03, s05 · Dup: —

**6. Store for found tells** (§3 3.10.4; §4 4.10.4)
- Decision: Adopt. `world.foundTells: Record<string, SellerTell>` keyed `'<listingId>/<tellKind>'` (a composite reference, not a minted id; visible). Misses leave no trace. Because `seller-tells` is keyed (listingId, channel), a repeat review draws the same uniforms, so a higher-skill review finds a superset. Pruned with the listing (s03 #14). No migration.
- Class: integrator · Owning: §3 3.10.4 · Affects: s03, s04 evidence refs, s13 · Dup: —

**7. Site-visit details** (§3 3.12)
- Decision: Adopt. `snowCovered` = district phase ∈ {winter, breakup} on freezing templates, never arid. `flowGpm` = null outside phase `operating` (arid always operating). Boulders: claim mean of surface blocks, tercile(x + N(0, 0.10)) at cuts 0.33 / 0.66. Tell `skillMult` 1.0, owner-geologist 1.15. Fixed draw order on `rng(seed,'site',turn,claimId)`: drift u, boulder N, permafrost u, flow U, then pit-scar and tell draws. Register the constants as `geology.siteVisit.*` keys (drift detect 0.9, snow mult 0.4, permafrost correct 0.8, flow noise 0.10, boulder noise 0.10).
- Class: integrator · Owning: §3 3.12, 3.16 · Affects: s03, s04 panSurvey · Dup: —

**8. Two visits to one claim in one turn** (§3 3.12; §4 4.16)
- Decision: Adopt. A claim may have at most one pending visit (booked or queued) and at most one visit resolving per turn; a second `world/siteVisit` fails `VISIT_ALREADY_BOOKED`. `prospect/panSurvey` attaches to the pending or this-turn visit. Add the code to 3.12.
- Class: integrator · Owning: §3 3.12 · Affects: s03, s04, s13 · Dup: —

**9. Desk task interface for site visits** (§3 3.12, §1 1.9, §2.6 step 7)
- Decision: See s01 #1 (task shape, `canResolve` = `freightOpen`, step-7 resolution, no refund).
- Class: integrator · Owning: §1 1.9 · Affects: s01, s03 · Dup: s01-structure #1

**10. claimAccess turn parameter and claim-scoped closure** (§3 3.3.3, §1 1.4.5)
- Decision: See s01 #8 (no turn parameter; `claimAccess` applies the claim-scoped `geology.access.closed` itself).
- Class: integrator · Owning: §1 1.4.5, §3 3.3.3 · Affects: s01, s03 · Dup: s01-structure #8

**11. Lease and relinquish transitions** (§3 3.11, 3.14; §5 5.14)
- Decision: Adopt. `onListingClosed` gains outcome `'leasedToPlayer'`: status `player`, `holderId` kept as the lessor's `HolderId` (an `isLeased` flag or a `lessorId` field marks it). New `returnFromLease(state, claimId)` → status `heldNpc` with `relistCooldownWk` (lease surrender, expiry or termination). `land/relinquish` calls `forfeitToOpen` in P1 (status `open`, or `withdrawn` inside a withdrawn overlay; `rightStub` cleared; the player's disturbance stays in `Block.state`; liability rules from P2). Update 3.11 and 3.14.
- Class: integrator · Owning: §3 3.11, 3.14 · Affects: s03, s05, s04 (prior status after acquisition stays as recorded in `knowledge.priorStatus`) · Dup: — (s05 #14 is a duplicate of this)

**12. Patented parcels in P1** (§3 3.4; §5 5.18)
- Decision: Follow §5 5.18 ("P1 does not include patented ground"). Under rules < 2 a patented parcel still takes its hazard draw (stream rule e) but never becomes a candidate, and the initial-market selection skips it. Per-claim keys keep every other claim's draws identical across rules phases.
- Class: integrator · Owning: §3 3.11 · Affects: s03, s05 · Dup: —

**13. Which tuning seller evidence reads** (D-3.2; §3 3.10.2, 3.18)
- Decision: Adopt. `snapshotGenParams` gains every seller-evidence key (methods, transforms, package mix, `claimedBlocksMult`), so a relist regenerates byte for byte whatever happens to `meta.tuning`. Weekly supply, site-visit and tell keys are read from resolved `meta.tuning` (`tellDetect` difficulty-scaled as 1.11 says).
- Class: integrator · Owning: §3 3.10.2, D-3.2 · Affects: s03 · Dup: —

**14. §3 retention** (§2.9, §2.13)
- Decision: Adopt. Keep the last 3 site-visit reports per claim. Holder evidence stays bounded by the claim count (≤ 1 summary per holder–claim pair; dropped when the holder loses the claim). Found tells are pruned with their listing when §5 prunes closed listings (s05 #16). Record in §3's decisions and the §2.9 retention list.
- Class: integrator · Owning: §3 (D-3.n), §2 2.9 · Affects: s03, s05 · Dup: —

**15. Site-visit drift finding as evidence** (§3 3.6; §4 4.5.1, 4.10.4)
- Decision: Adopt. A site visit that finds drift shafts enters §4 as known kind `drift` (no worked-block list) with the drift offsets; "not found" gives no update in P1 (conservative for calibration). Add it to §4's evidence table and the calibration evidence mixes.
- Class: integrator · Owning: §4 4.1, 4.10.4 · Affects: s04 estimator and calibration, s03 · Dup: —

**16. Prose constants without keys** (CLAUDE.md rule 4; D-3.56; §3.16)
- Decision: Adopt. Register §3's generation constants as `geology.seller.*` (plan counts, transforms, fraud counts) and `geology.inheritor.*` (family-season bcy LN(6,000, 0.5), tier CDV targets, k bounds [0.25, 4], ledger multiplier U(1.2, 1.6), pit-log count) with their documented values, and list them in 3.16. §1's spec values stay `game.inheritor.*` (s01 #3).
- Class: integrator · Owning: §3 3.16 · Affects: s03, data schemas · Dup: — (s01 #3 overlaps)

**17. OQ-3.4: hand-cut parcels that work no block** (§3 3.20; §4 4.10.2; §0 still open)
- Decision: Implement the §0 default first: re-measure in P1 with the estimator in place. Recommended lever (owner question Q2): a `handCut` parcel with no eligible block (no paystreak block under `maxObFt`) records old-timer kind `none` (no era, no footprint, no record); no gold moves, so T-01/T-02 need no rerun and D-3.45 holds again; then set `geology.recordsWorkedShare.handCut` from the re-measured share and rerun §4's hand-cut cells, logged in the tuning changelog. The alternatives (raise `maxObFt`; lower the template's `handCut` share with the records share) change truth and need full §3 and §4 recalibration.
- Class: owner (open §0 item OQ-3.4; the recommended lever is not one of the two the default names) · Owning: §3 3.6, 3.20 · Affects: s03, s04 calibration · Dup: — (s04 #15 is a duplicate of this)

**18. Arid T-01 (b) on its line** (§3 3.17; D-3.51; BALANCE T-01 b)
- Decision: Adopt as tuning-loop work. Re-run world calibration on both seed bases after the P1 world changes (s03 #3, #17). If T-01 (b) fails, move one lever (arid `sigma.block` 0.65 → 0.60, or `gMed` 0.0056 → 0.0058), re-checking pool good ≤ 10% each time; log it.
- Class: integrator · Owning: §3 3.17 · Affects: s03, balance stage · Dup: —

**19. Smaller ambiguities** (§3 3.3.4, 3.9, 3.10.1, 3.14)
- Decision: Adopt. One gauge-bias draw LN(1, 0.20) per listing, applied to all three flow periods (springs: one LN(1, 0.3), as 3.9 says), drawn on the candidate's supply key after the hazard u (turn-0 key for initial listings, s03 #1). The candidate carries the holder's stored situation; §5 relabels distress on its `Listing`. `districtMap.airstrips` = the town strip when `services.airstrip`, plus one strip at the head of each `noTrail` creek (display only).
- Class: integrator · Owning: §3 3.3.4, 3.14 · Affects: s03, s05, s13 map · Dup: —

---

## s04-prospecting (§4)

**1. Block state in the evidence hash** (§4 4.1, 4.5.2)
- Decision: Adopt; decide in the design before coding the incremental path. The anchor solve reads block state as of the anchor, quantized (the set of fully mined blocks; the set of blocks stripped > 0 for the recent-operator rule). A cheap post-solve layer applies current continuous state (`f_rem` from mined/sampled fractions, OB shift from stripped feet) to aggregation and geometry means. The anchor's block-state snapshot is derivable from evidence plus the stored anchor turn (store it in `knowledge` at each re-anchor), so cold and warm memos agree. Amend 4.1 and 4.5.2 (D-4.n).
- Class: integrator · Owning: §4 4.1, 4.5.2 · Affects: s04, s07 (block-state writes), perf · Dup: —

**2. Estimator performance plan** (§4 4.22; §2.13; D-4.58)
- Decision: Adopt. Three items: (1) full solves ≤ 10 ms (20 blocks) and ≤ 60 ms (160) through prior-model caching across evidence changes, typed arrays and fewer hypotheses after pruning; (2) the incremental production path with #1's block-state split; (3) measure the 1.5 ms budget as 4.22 defines it — amortized over real `cautious` and `heavyProspector` simulator games — and keep the synthetic 8-claim scenario as a regression check in CI. If it still misses, the phase report states it (§2.13) and the gate is not changed without the owner.
- Class: integrator · Owning: §4 4.22 · Affects: s04, s02 bots and perf CI · Dup: — (s02 #20 is a duplicate of this)

**3. pileRawOzEst in production reconciliation** (§4 4.4.6, 4.7; §7 7.16)
- Decision: Adopt. 4.4.6 attributes `rawOzWeighed − pileRawOzEst` to blocks (`oz_b`). Ship the old-tailings pile prior estimate in P1 (era median from `recordsTailingsPriorMedian`, log-sd 0.7, footprint volume ±30%) so §7 can compute `pileRawOzEst` from visible piles; pile sampling (`target: 'oldTailings'`) stays P2.
- Class: integrator · Owning: §4 4.4.6, 4.7 · Affects: s04, s07 · Dup: — (cross-area conflict C-8)

**4. Sample-gold fineness assays: stream, store, timing** (§4 4.7, 4.1; §2.3)
- Decision: Default (owner question Q1): draw on `rng(seed,'prospect',claimId,'assay',n)` with a per-claim counter `knowledge.assayCount[claimId]`; store `knowledge.assays[claimId]: FinenessAssay[]` and the weighed sample mg since the last assay; the assay runs in step 12b when the concentrate is weighed and ≥ `finenessAssayMinMg` (300 mg) has accrued since the last assay (pooled `n_eff` from the logged masses); its $60 posts in step 14 (`exp.refiningAssay`). Before any refinery assay, §10's `claimFineness.alloy` reads §4 `finenessP50`, so the two fineness estimates cannot diverge (coordinate with s10-gold #1).
- Class: owner (new key shape on a registered stream) · Owning: §4 4.7, §2.3 registry · Affects: s04, s10, s05 (f_est) · Dup: — (s04 #22 is folded in)

**5. Engagements for records reviews** (§4 4.10.4, 4.12)
- Decision: Adopt. `Engagement { id ('eng'), kind: 'recordsReview' | 'consultant'; reviewer: ReviewerRef; target; startTurn; dueTurn; daysBilled; status; reportId?; scope? (consultant only) }`; update 4.10.4. A records review's `startTurn` is the step 7 in which its desk days complete (s01 #1).
- Class: integrator · Owning: §4 4.10.4 · Affects: s04, s01 · Dup: —

**6. Company-wide planning assumptions** (§4 4.1, 4.16)
- Decision: Adopt. `KnowledgeSlice.planningDefault: PlanningAssumptions | null` overrides tuning defaults; per-claim entries override it; `prospect/setPlanning { claimId? }` writes one or the other.
- Class: integrator · Owning: §4 4.1 · Affects: s04, s13 · Dup: —

**7. Panning on open ground** (§4 4.2; §5 5.5)
- Decision: Follow §5 and 4.19: in P1, open ground allows records reviews only (`samplingAccess` tier none); correct 4.2's wording. Casual panning on unclaimed federal ground, if wanted, is a later §5 change (reason `openGround`, tier casual).
- Class: integrator · Owning: §4 4.2 · Affects: s04, s05 · Dup: — (cross-area conflict C-12)

**8. Contractor lead time and difficulty** (§4 4.12, 4.19, 4.22)
- Decision: Adopt. `earliestStart = now + max(1, ceil(leadWeeksBase × geology.contractorLeadMult × effective('prospect.contractorLeadTimeMult')))`, base 1 for pitting (easy 1, standard 1, hard 2 weeks); write it in 4.12.
- Class: integrator · Owning: §4 4.12 · Affects: s04 · Dup: —

**9. Contractor pans and hand pits** (§4 4.2.A, 4.19)
- Decision: Adopt. In P1 `delivery: 'contractor'` is allowed only for `excavatorPit`; other methods fail `METHOD_NOT_AVAILABLE`. Revisit in P2 with inspection terms.
- Class: integrator · Owning: §4 4.19 · Affects: s04 · Dup: —

**10. geologistOnClaim in the evidence hash** (§4 4.6; knowledge/types.ts)
- Decision: Adopt. Derive it from the evidence: true when any bedrock-logged sample on the claim was logged by the owner-geologist, a staff geologist or a consultant (the sample's `loggedBy`), so it changes only with new samples.
- Class: integrator · Owning: §4 4.6 · Affects: s04 · Dup: —

**11. Method numbers outside tuning** (§4 4.2, 4.20; methods.ts)
- Decision: Split. Register the P1 rows' cost and rate fields (unit costs, rates, crew, days, lead) as `geology.method.<id>.<field>` tuning keys (they are 4.21's balance levers); the measurement-model fields (`captureBySize`, `volumeCv`, `weighCv`, `geomCv`, `thickCv`, `biasMult`, reach, position mode) stay content in `data/prospecting/methods.ts`, changed only by commit with recalibration. Amend 4.2 and 4.20 to say so (D-4.n).
- Class: integrator · Owning: §4 4.2, 4.20 · Affects: s04, data schemas · Dup: —

**12. activeLayerFt key name** (§4 4.2.A, 4.20; §3)
- Decision: Adopt. One owner (§3): `hPit` reads `geology.sample.activeLayerFt`; fix 4.2/4.20 to cite §3's key.
- Class: integrator · Owning: §4 4.20 · Affects: s04 · Dup: —

**13. OQ-4.3: the two calibration misfits** (§4 OQ-4.3; §0 0.14; D-4.55)
- Decision: Follow the §0 default (P1 closes both, one lever at a time, every gated cell in band, logged): for the arid recent-operator over-coverage, the first candidate is the configuration mixture around recent operators' cuts (the default's), then treating pre-stripped recentCat blocks as passed-over and a claim-level q prior; for the drift mismatch, align §4's `recordsRemovalLog.drift` with §3's measured removal and recompute `recordsWorkedLogOffset.drift` from the 4.10.2 formula (§3's generator is ground truth). Rerun under the OQ-4.4 protocol (#14) and report both in the phase report.
- Class: integrator (executes the owner's stated default) · Owning: §4 4.22, 4.24 · Affects: s04 calibration · Dup: —

**14. OQ-4.4 protocol in the CLI** (§4 4.22; D-4.56; §0 0.15)
- Decision: Adopt. The full calibration CLI caps each cell at 2 claims per world in seeded random order (`calibrationOrder`) with a per-cell world counter, drawing as many worlds as needed. Rebaseline the §4 table in the phase report, noting it is not comparable with P0's.
- Class: integrator · Owning: §4 4.22 · Affects: s04 calibration · Dup: —

**15. OQ-3.4 on §4's side** (§3 OQ-3.4; §4 4.10.2)
- Decision: See s03 #17; §4's `recordsWorkedShare.handCut` and hand-cut offsets move in the same commit as §3's fix.
- Class: owner · Owning: §3 · Affects: s03, s04 · Dup: s03-world #17

**16. The cautious bot cannot pit listings in P1** (D-4.29, 4.19; BALANCE §4.1; §2.12.1; O-08)
- Decision: Adopt; record the P1 reading in §2.12.1 and BALANCE §4.1 (no bot change beyond specifying v1.0's P1 sequence). P1 `cautious`: records review and site visit with pans on the 6 best listings by visible prior → lease the top 2 at low advance (Σ advances ≤ 25% of company cash; lease or lease-with-option preferred) → own or contractor pits on leased ground to `indicated` → keep or surrender (surrender if P50 < 0). A top listing offered for sale only is bought only on 2.12.1's commit rule (P50 > 0 and P10 > −15% of cash) on pan and records evidence. O-08's denominator stays BALANCE's (land or advance royalty, fleet, mobilization); the tutorial already teaches lease-then-test (1.15).
- Class: integrator · Owning: §2 2.12.1, BALANCE §4.1 (note) · Affects: s02 bots, O-08 · Dup: — (s05 #5 is a duplicate of this)

**17. Tutorial week 4 text** (§1 1.15; §4 4.16)
- Decision: Adopt. The P1 coach text for week 4 reads "old workings and creek history"; "past production filings" returns with P2's full records review.
- Class: integrator · Owning: §1 1.15 · Affects: s13 tutorial · Dup: —

**18. knowledge save budget** (§4 4.3; §2.13; 4.22)
- Decision: Adopt. Production rows are stored compactly (omit zero colours, null masses and empty observed fields); reports keep the newest per program and drop interim logs after 104 weeks; engagements are pruned 104 weeks after completion. Run the `heavyProspector` year-10 size check as soon as §4's P1 package and the bots exist.
- Class: integrator · Owning: §4 4.3, 4.22 · Affects: s04, s02 perf · Dup: —

**19. Where sample gold lines accumulate** (§2.14; §3 3.8; §4 4.3)
- Decision: Modify: §4 owns the accumulator, next to its existing hidden concentrate record: `knowledge.sampleConc[claimId].hidden.lines { capture, processing, variance }` (metal oz), written when §4 posts `sampleGoldLines`, registered with a §4 scrambler; the conservation test reads it.
- Class: integrator · Owning: §4 4.3, 4.12 · Affects: s04, s02 conservation and scramble tests · Dup: —

**20. Same-week attribution with several lines** (§4 4.4.6; D-7.51)
- Decision: Adopt. Every cleanup of a week attributes against the estimate as of the start of step 12, before any of that week's production rows (trivially true in P1's one line). Write it in 4.4.6.
- Class: integrator · Owning: §4 4.4.6 · Affects: s04 · Dup: —

**21. 'contradicted' from records tells in P1** (§4 4.10.1, 4.10.5, 4.17)
- Decision: Adopt. Records-channel tells that §4 maps to `undisclosedSampling`, `productionUnsupported` or `saltingSigns` set `contradicted` from P1 (as 4.10.5's example does); twin-based contradiction stays P2. Amend 4.10.1.
- Class: integrator · Owning: §4 4.10.1 · Affects: s04, s13 · Dup: —

**22. Assay and weighing timing** (§4 4.7, 4.12, 4.17)
- Decision: Keep 4.17's weighing triggers (program ended or the claim's season ended) and run the assay check at that weighing (#4). No extra weighing points: sample gold is small, and the lot appears when the program ends.
- Class: integrator · Owning: §4 4.17 · Affects: s04 · Dup: — (folded into s04 #4)

**23. explain.claimEstimate** (§4 4.14; §2.8; §13 T9)
- Decision: Adopt. Build the tree lazily from the cached statistical and economic layers (no re-solve), citing tuning keys and the `sample`/`prospect` streams; nodes from sample logs and §3 priors are visible; test explain-flag invariance and memo transparency.
- Class: integrator · Owning: §4 4.14 · Affects: s04, s13 · Dup: —

---

## s05-land (§5, with §6's P1 obligation store)

**1. Who builds the P1 obligation store** (§6 6.9, 6.18 P1)
- Decision: Adopt. A separate early package `p1-obligations` in `src/engine/systems/permits`, owned by §6: the `obligations` collection on `PermitSlice`, `createObligation`, `satisfyObligation`, `cancelObligation` (#2), `obligationsInRange`, `settlementClass`, step-13 sub-step f (billable "missed" at `dueTurn + graceWeeks + 1`, routed to `land.onObligationMissed` / `investor.onMinimumMissed`), `permits/payObligation(s)`, and the `obligation.*` signals. §5, §1 and §11 build against its interface (Wave 0 contracts).
- Class: integrator · Owning: §6 6.9, 6.18 · Affects: s05, s01, s11, s12/s13 (obligation alerts) · Dup: — (s12-events #9 and #15 overlap)

**2. Cancel and "satisfied" hooks** (§5 5.7, 5.12; §6 6.9)
- Decision: Adopt. `cancelObligation(state, id)` → status `cancelled`; §11 cancels any open bill for it (`Bill.status 'cancelled'`). `satisfyObligation` calls the owner's `onObligationSatisfied(state, obl)` (idempotent; §5's pushes the AMR recoup credit). Record in §6 6.9 and §5 5.17.
- Class: integrator · Owning: §6 6.9, §5 5.17 · Affects: s05, s11 · Dup: — (s11-finance #18 overlaps: double payment)

**3. AMR default cure vs the open bill** (§5 5.7, 5.16; §11 11.4)
- Decision: Adopt. For a missed AMR the cure is paying the existing arrear: the `leaseCure` obligation carries no amount (no bill); the original obligation becoming `satisfied` (late) before the cure's `deadlineTurn` clears it. A priced `leaseCure` (1.5×) is only for the no-in-lieu work default (P5).
- Class: integrator · Owning: §5 5.7 · Affects: s05, s11 · Dup: —

**4. Cash at lease signing** (§5 5.5, 5.7, 5.15)
- Decision: Adopt. `acceptAsk` (lease) pays the first AMR and any option fee at once through §11 `pay` (`allowPartial: false`, else `INSUFFICIENT_FUNDS`), recording a `leaseAdvanceRoyalty` obligation created already satisfied (calendar and history complete; the satisfied hook pushes the credit). Lease closing costs = `land.closingFixedUsd` + county recording per claim, no percentage. Option exercise pays the full purchase closing costs on the price due. Record as D-5.n.
- Class: integrator · Owning: §5 5.5, 5.7 · Affects: s05, s11 · Dup: —

**5. Cautious bot cannot pit listings** (§4 D-4.39; §5 5.5; BALANCE O-08)
- Decision: See s04 #16. Excavator pits stay impossible on listings in P1.
- Class: integrator · Owning: §2 2.12.1 · Affects: s02 · Dup: s04-prospecting #16

**6. Buy-down price reveals the seller's belief** (§5 5.4, 5.13, D-5.1)
- Decision: Adopt the first option. Price the buy-down from `claimedRawOz`: `G_b = min(claimedRawOz / land.lessorAssumedLifeYears, land.lessorAnnualOzCap) × f × spotView`, like every other asking term. Example A becomes 300 oz × 0.85 × 4,200 = $1,071,000/yr → **$32,000 per point** (32,130 rounded to $500); update 5.4's example and 5.21's test in the same change. Always take the buy-down draw (#8).
- Class: integrator · Owning: §5 5.4 (D-5.n) · Affects: s05 · Dup: —

**7. Ask explanation and hidden motivation** (§5 5.2, 5.4, 5.13)
- Decision: Adopt. `askNoise` (and `royaltyNoiseZ`, #9) move into `Listing.hidden`. `explain.listingAsk` shows (1 − `askMotivationDisc` × m_t) × askNoise as one node "seller pricing factor", tagged hidden, with `knownAlt` = published ask ÷ (max(V_claimed, A) × (1 + markup)). Selectors exclude both fields; the scramble test covers them.
- Class: integrator · Owning: §5 5.2, 5.13 · Affects: s05, s13 · Dup: —

**8. land-list draw table** (§5 5.2, 5.7, 5.3; §2.3 (e))
- Decision: Adopt. Fix the full order now: the existing draws, then the clause-variety draws (royalty basis, AMR mode, carryforward, recoup share, in-lieu allowed), then the JV draws (P6), then the initial-listing age u (#15); every draw is taken in P1 and ignored below its phase; the buy-down draw is always taken. Update the 5.2 table.
- Class: integrator · Owning: §5 5.2 · Affects: s05 · Dup: —

**9. Weekly re-pricing of lease terms** (§5 5.2, 5.4)
- Decision: Adopt. Store `royaltyNoiseZ` in `Listing.hidden`; re-price lease terms in step 3(b) with the asks; the half-point rounding is their hysteresis.
- Class: integrator · Owning: §5 5.4 · Affects: s05 · Dup: —

**10. Option exercise mechanics** (§5 5.7, 5.14, D-5.28)
- Decision: Adopt. The lease tenure ends `converted` (`onTenureEnded`; §6's handler keeps permits from P2), and a new `ownedUnpatented` tenure (origin `optionExercise`, same claim and `locatedTurn`) is created; other claim-level interests move to it. Unrecouped AMR credits are expensed (Dr `exp.royaltyCash` / Cr `prepaid`), because the option price already credits AMR paid. New basis = carried option fee and buy-downs + price due + closing costs.
- Class: integrator · Owning: §5 5.7 · Affects: s05, s11 · Dup: — (s11-finance #13 overlaps)

**11. Holding cost in P1 valuations** (§5 5.13, 5.21, 5.1)
- Decision: Adopt. `holdingCostAnnual` = 0 for owned tenure under rules < 2 (no claim fees until P2); leases carry AMR. The 5.21 valuation test passes holding as an explicit fixture input. Correct 5.13's example to $400/yr (2 claims × $200, from P2) and recompute its P50 figures in the same change.
- Class: integrator · Owning: §5 5.13 · Affects: s05 · Dup: —

**12. Buyer 'summary' view counts mined gold** (§5 5.14)
- Decision: Modify. `oz_view(summary)` = §4 `minableOzP50` (remaining metal oz) only; recorded production does not add ounces, and the evidence class for `summary` stays `history` as designed (no new upgrade to `production`, which would triple quick-sale prices). f = §4 `finenessP50` for `summary`/`full`, the district default for `none`. Decide before §5's P1 package (quick-sale price, O-15 residual).
- Class: integrator · Owning: §5 5.14 · Affects: s05, s02 observer (O-15) · Dup: —

**13. Ending tenure while a site is active** (§5 5.14, 5.7; §7 cleanup)
- Decision: Voluntary ends require a demobilized site: `land/quickSell`, `land/relinquish` and `land/surrenderLease` fail `SITE_ACTIVE` unless the claim's site is `none` (demobilizing forces the final cleanup, 7.10), and the renewal opt-out warns when a site is active. Involuntary ends (lease termination for default, expiry without renewal): §7 stands the plan down and books any pad and box gold to a new terminal conservation term `lostOnTenureEndRawOz` (hidden). Machines stay the player's at that location until moved (§9 transport from a non-held claim stays valid). The `ClaimOps` record is kept read-only after the claim leaves, so tailings, left-in-pit and waste terms stay in §2.14's identity. Camp lots of that claim: see s10-gold #12.
- Class: integrator · Owning: §5 5.14, §7 7.10 · Affects: s05, s07, s09, s10, s02 conservation test · Dup: — (s07 #13 is a duplicate of this; s10-gold #12 overlaps)

**14. Representing a leased claim in §3** (§3 3.11; §5 5.2)
- Decision: See s03 #11.
- Class: integrator · Owning: §3 · Affects: s03, s05 · Dup: s03-world #11

**15. Initial listings in newGame and their age** (§2 D-2.13; §3 3.11; §5 5.3)
- Decision: Adopt. `newGame` calls §5 `createListings(createInitialListings(...))` (s03 #2). Initial listings get a stationary age: §5 draws the listing life L as for any listing, then `age = floor(u × L)` with u the last `land-list` draw (#8); `listedTurn = −age`, `expiresTurn = listedTurn + L` (> 0), `weeksOnMarket = age`, so m_t starts drifted. Relist counts start at 0.
- Class: integrator · Owning: §5 5.3 · Affects: s05, s03 · Dup: — (overlaps s03 #2)

**16. §5 retention and budget** (§2.13; CLAUDE.md retention)
- Decision: Adopt. Closed listings are pruned 13 weeks after closing (seller memory kept; inbox messages that reference a pruned listing show "listing closed"); ended tenures and ended interests are kept (bounded by claims ever held). Measure the year-10 land slice in P1 and give `land` its own §2.13 row (≈ 150 kB, carved from "everything else").
- Class: integrator · Owning: §5 (D-5.n), §2 2.13 · Affects: s05, s03 (found tells), s02 perf · Dup: —

**17. Backed minimum window** (§5 5.12, 5.16 step 6(f); §1 1.8.1)
- Decision: See s01 #25 (evaluated by §11 in step 14c of week 52, after that week's cleanups, on game year Y's deliveries).
- Class: integrator · Owning: §1/§5 · Affects: s01, s05, s11 · Dup: s01-structure #25

**18. When AMR obligations are created** (§5 5.12, 5.16; §6 6.9; §11 forecast)
- Decision: Adopt. Each AMR obligation is created one anniversary ahead (year 2's at signing, then each anniversary creates the next), `recurrence { kind: 'anniversary', baseTurn: signedTurn }`, so the 8/4/1-week ladder and §11's 13-week forecast see it.
- Class: integrator · Owning: §5 5.12 · Affects: s05, s11, s13 calendar · Dup: — (s11-finance #25 overlaps)

**19. Refreshing the work commitment** (§5 5.2, 5.7)
- Decision: Adopt. §5's step-16 wrap-up adds this week's washed bcy and qualifying spend (§4 program costs + §7 direct claim cost lines) for leased claims from `StepContext.week` (s02 #10) into `LeaseState.workThisYear`; the anniversary test in step 6(f) reads the accumulated value.
- Class: integrator · Owning: §5 5.16 · Affects: s05, s07, s04 · Dup: —

**20. Missing P1 land alert kinds** (§13 13.10; §5 5.7, 5.12, 5.14)
- Decision: Adopt. Add `lease.defaultNotice` (critical, edge), `lease.terminated` (warning, edge), `lease.ended` (info, edge: surrender or expiry), `land.quickSaleClosed` (info, edge) and `land.interestChanged` (info, edge: step-down or cap). `lease.anniversarySoon` is info/level per b's s12-events #13 ruling.
- Class: integrator · Owning: §13 13.10 (rows owned by §5) · Affects: s05, s12/s13 · Dup: — (s12-events #13 overlaps)

**21. Landman stub scope** (§5 5.4; §1 1.7)
- Decision: Adopt. One function `landmanAdjustedTerms(terms)`, used by views, previews and `acceptAsk`: × `land.p1LandmanPriceMult` on `askSale` and the option price; − `land.p1LandmanRoyaltyPointsOff` on the royalty rate (floor 0.01); AMR, work and fees unchanged; buy-down `minRate = min(minRate, signed rate)`.
- Class: integrator · Owning: §5 5.4 · Affects: s05 · Dup: —

**22. land.sellerMotivationAdd has no formula** (§5 5.17, 5.3)
- Decision: Adopt. m_t = min(1, m0 + min(cap, drift × weeksOnMarket) + effective('land.sellerMotivationAdd', { districtId })); record in 5.3; register the hook (neutral 0, add).
- Class: integrator · Owning: §5 5.3 · Affects: s05, s12 hook registry · Dup: — (s12-events #5 umbrella)

**23. Cash-basis leases in P1** (§5 5.7, 5.18, D-5.34)
- Decision: Adopt. P1 generates in-kind (`rawOz`) leases only, still taking the basis draw; the cash path is implemented and unit-tested (example C row d) and enabled for generation from P5.
- Class: integrator · Owning: §5 5.18 · Affects: s05 · Dup: —

**24. Smaller gaps** (§5 5.4, 5.7, 5.2; §1 1.8.2)
- Decision: Adopt. (a) The in-lieu rate uses `visiblePrior` grade median when `claimedGradeOzBcy` is null. (b) Renewals are unlimited, each +1 point, capped at `land.royaltyMax`. (c) `TenureEndReason` stays `terminated`; the tenure records `endDetail: 'default' | 'surrender' | 'expiry'` for reputation and alerts. (d) Inheritor basis: s01 #18 ($40,000 per claim).
- Class: integrator · Owning: §5 5.7 · Affects: s05 · Dup: — ((d) is s01 #18)

**25. Credit-offset rounding** (§5 5.12, example C)
- Decision: Adopt. `offset_m` = round half away from zero of min(maxRecoupShare × due, credits / v) in milli-oz; consumed credit cents = min(remaining credit, roundCents(offset_oz × v)). Example C: 2.241 oz, $8,000 consumed (not $8,000.37). Write it into 5.12.
- Class: integrator · Owning: §5 5.12 · Affects: s05 · Dup: —

**26. One cost model in valuation** (§5 5.13, D-5.47; §4 economic)
- Decision: Adopt. `costBcy` = §4 `costUsdPerPayBcyM` + `land.valCapitalChargePerBcy` × cpiIndex (D-5.47's single cost model); say so in 5.13. `annualBcy` = §7 `productionForecast` washed bcy over the next 52 weeks for the claim's active plan when one exists, else `land.valDefaultAnnualBcy`; memoized.
- Class: integrator · Owning: §5 5.13 · Affects: s05, s04, s07 · Dup: —

**27. Registry and documentation gaps** (§2 2.3; §5 5.5, D-5.53)
- Decision: Adopt. Record `land-market` (turn, listingId) and `land-buyers` (turn, tenureId) in §2.3's table; these follow rule (c) for weekly draws and were never defined otherwise (flag in the phase report). Add the `permits.fed.*` fee keys to `permits.ts` in P1 (values only; `countyRecordingFeePerClaimUsd` 12 is used by closings). §5 contributes its P1 error codes through its own `actions.ts` (s02 #11).
- Class: integrator · Owning: §2 2.3; §5 5.5 · Affects: s05, s02 · Dup: —

---

## s07-ops (§7)

**1. M-RATE vs §7's hour attribution** (§7 7.8, 7.16, 7.20; BALANCE §5.8, T-04)
- Decision: Adopt. Add `runHours` to the plant's `MachineWeekHours`: usable hours in which the plant processed feed at its continuous rate (rated, water-, power- or tailings-limited), excluding cleanup, start-up, plant moves and starved or blocked fractions. M-RATE = washed bcy ÷ Σ runHours. Idle attribution is unchanged. Amend 7.16 and BALANCE §5.8 together (a definition fix, no band change).
- Class: integrator · Owning: §7 7.16; BALANCE §5.8 · Affects: s07, s02 fixtures (T-04, T-05, T-06) · Dup: — (cross-area conflict C-11)

**2. Bots cannot see hints** (§7 7.8, D-7.25; §2.12.1)
- Decision: Adopt. A pure memoized selector `opsHints(state, claimId)` on the visible model (from the current plan and last week's result), called on demand by bots and the UI; step 9 copies its result into `WeekReport.hints` only when explain is on; state stays explain-invariant.
- Class: integrator · Owning: §7 7.8 · Affects: s07, s02 bots, s13 · Dup: —

**3. Non-blocking validator warnings** (§7 7.17; §2.2; actions/types.ts)
- Decision: Adopt the framework change, before any §7 or §8 validator is written: `ActionDef.warnings?(state, action): { code, message }[]`, and `validateAction` returns `{ ok: true, warnings }`. Owners use it for §7's plan warnings, §8's `SMALL_CREW_ENDS`, §9's uncertain transport windows and s05 #13's renewal warning.
- Class: integrator · Owning: §2 2.2 (D-2.n) · Affects: s02 framework, s07, s08, s09, s13 · Dup: — (s13-ui #3 is the same issue)

**4. FOREMAN_REQUIRED needs a forward-looking test** (§7 7.2, 7.17; §8 8.12)
- Decision: Adopt. §8 publishes pure `prospectiveSupervisorKind(state, claimId, { shiftsPerDay, activeLines, crewIds })`, which applies pending assignments (owner and employees) and the small-crew test; §7's validators call it; a property test pins it to the next step 7's `foremanFor`.
- Class: integrator · Owning: §8 8.12 · Affects: s07, s08 · Dup: —

**5. defaultMinePlan details** (§7 7.2 Defaults, 7.16; §2.12.1)
- Decision: Adopt (D-7.n). Roles by class: dozer → strip; excavator → dig (feed in excavator-direct mode when there is no loader); articulated truck → haul; loader → feed (haul as load-and-carry when there is no truck); wash plant and concentrators → plant; pump → water; generator → power; others → support. Crew: best `canFill` per role and shift, auto-paired as 7.2. Cut: from §4's visible P50 margin, the best minable block and its contiguous run (4-adjacent, `CUT_NOT_CONTIGUOUS` rules) up to about one season's volume, ordered from the down-valley end. Plant site: the nearest legal block (not in the cut, not under a visible pile, pond or deposit) 4-adjacent to the cut's first block. With no estimate or no minable block the cut is empty and the plan cannot be activated (`CUT_EMPTY`).
- Class: integrator · Owning: §7 7.2 · Affects: s07, s02 bots, s13 plan editor · Dup: —

**6. G0 ignores pre-game mining** (§7 7.3; §3 3.5.1, 3.6)
- Decision: Adopt. G0 = grade × (payBcy − minedBcy − sampledBcy) and `areaMined` starts at minedBcy / payBcy (a pre-game mined-out block opens `minedOut`). Fix 7.3 and the 7.23 gold-basis test.
- Class: integrator · Owning: §7 7.3 · Affects: s07, s02 conservation test · Dup: — (cross-area conflict C-9)

**7. Pre-stripped blocks** (§7 7.3, 7.4; §3 3.6.1; §1 1.8.2)
- Decision: Adopt (D-7.n). `BlockOps` is created lazily from `Block.state` when a claim gains an `OpsSlice` entry. Pre-game stripping (`strippedBcy = overburdenBcy`) counts as stripped to the contact: μ_c = 0 for that block (σ_c dilution and loss kept), `strippedFrac` capped at 1, surface `payExposed`, `thawedFt = thawProgress`. Needed for O-06 c.
- Class: integrator · Owning: §7 7.3 · Affects: s07, s03 · Dup: —

**8. Thaw scope** (§7 7.4, 7.18 step 9(c))
- Decision: Adopt. Sub-step (c) runs every week for every block with surface cleared, stripping or payExposed on every claim in `ops.claimIds`, whatever the phase, site or plan status (K = 0 in cold and deepCold weeks), including claims whose plan gate (a) stood down; the a → b → c sub-order is unchanged. Overwinter retention applies in the first winter-phase week. Re-check the thaw calibration bullets and T-06's season 1 in the tuning loop.
- Class: integrator · Owning: §7 7.4, 7.18 · Affects: s07 · Dup: —

**9. ops-grade draw order** (§7 7.7, 7.18 (d))
- Decision: Adopt. Each block's draw has its own key (turn, claimId, blockId), so it is drawn lazily on the block's first dig in the week and cached in `StepContext.week`; the P3 re-resolve reuses the cache. Clarify 7.18 (d).
- Class: integrator · Owning: §7 7.7 · Affects: s07 · Dup: —

**10. Site lifecycle transitions** (§7 7.1, 7.12, 7.17)
- Decision: Adopt. `running` = `ready` ∧ plan active ∧ phase ∈ {operating, freezeup} ∧ the plan has a plant (set in step 9). Mobilization ends in `ready` with no start-up. An active plan may be saved while the site is mobilizing or winterized (step 9's gate holds it); `SITE_NOT_READY` only for `none` or demobilizing. Auto-winterize covers `ready` and `running`. Start-up hours come first from claim crew not paired that hour, then plan crew (plant idle cause `startup`, crew hours booked as `support`). With no crew, winterizing completes after 1 week at its USD cost.
- Class: integrator · Owning: §7 7.1, 7.12 · Affects: s07, s08 crew hours · Dup: —

**11. Season-end cleanup timing** (§7 7.10, 7.12)
- Decision: Adopt. In P1 the mandatory season-end cleanup runs in the winterizing week as off-day crew hours (`cleanupHours × cleanupCrewSize`), whatever `cleanupOnOffDay` says; the "last operating week" trigger is replaced by the winterizing trigger while auto-winterize applies. `productionForecast` places it at the P50 winter start.
- Class: integrator · Owning: §7 7.10 · Affects: s07 · Dup: — (cross-area conflict C-16)

**12. State the P1 rules need** (§7 7.1, 7.6.4, 7.8, 7.14, 7.17)
- Decision: Adopt. `ClaimOps.orders { cleanupLines: LineId[] }`; `LineOps.lostSinceAudit { sinceTurn, bySize }` (hidden, scrambled) and `LineOps.directFeedBcySinceShift`; `ClaimOps.auditReports` (ring of 4); `Well.status: 'drilling' | 'ready'` with `readyTurn` (yield hidden until ready); plant-move hours on `SiteWorkOrder`; `ClaimOps.payDugLast4: number[]`; `ClaimOps.seasons` (s01 #20). Put them in 7.1. No migration.
- Class: integrator · Owning: §7 7.1 · Affects: s07, s02 scramble · Dup: —

**13. Gold on a claim that leaves the player** (§7 7.10; §5 5.14; §2.14)
- Decision: See s05 #13.
- Class: integrator · Owning: §5/§7 · Affects: s05, s07 · Dup: s05-land #13

**14. Ops hooks missing from §12's registry** (§7 7.19; §12 12.3)
- Decision: Adopt. Add `ops.productivityMult`, `ops.plantCapacityMult`, `ops.thawMult` and `ops.recoveryLossExpMult` (owner §7, neutral 1, op `mul`, scope claim/district) to 12.3 and `data/events/hooks.ts`, and register all 15 §7 hooks in P1. Extend the data test to check every owner's hook list (§3 3.14, §4 4.18, §5 5.17, §7 7.19, …) against the registry.
- Class: integrator · Owning: §12 12.3 · Affects: s07, s12, data tests · Dup: — (s02 #12 is a duplicate of this; s12-events #5 is b's umbrella ruling)

**15. Visible inputs for the projection** (§7 7.16; §4 BlockEstimate)
- Decision: Modify. §4 extends `BlockEstimate` with `gravelPayFtP50`, `bedrockFtP50` and visible ground values (`bouldersVis`, `clayVis`, `pFrozen`) using its existing tercile mapping (4.7's groundWash: 0.15 / 0.5 / 0.85, template medians when unobserved); §7's `shareTakenVis`, λVis and `projectOpsVisible` read them. No new `ops.visible.*` keys, so §4 stays the single owner of the planning view.
- Class: integrator · Owning: §4 4.7; §7 7.16 · Affects: s04, s07 · Dup: —

**16. Estimator cost inside step 9** (§7 7.16; §2.13)
- Decision: Modify. §7 reads `knownEstimate` (memoized by evidence hash) in step 9 and never asks for anything else; in the normal flow the memo is warm from last week's step-16 refresh. A cold memo after a reload solves once, which is allowed (§2.3: a cold cache changes no result). Without an estimate, §7 uses the claim prior. Count it in the §2.13 bench.
- Class: integrator · Owning: §7 7.16 · Affects: s07, s04 · Dup: —

**17. matureNorth models outside the P1 catalog** (BALANCE §2.1, §7; §9 9.2.7)
- Decision: Adopt the first option: ship §9 catalog rows for `ex45`, `dz9`, `ld980`, `adt40`, `tr300`, `cenL`, `pmp10`, `gen300` and `campM25` in P1 (attributes, fuel burn, `fleet.p1MaintUsdPerHr`, grade multipliers), flagged `fixtureOnly` (never listed or sold under P1–P2 rules), so T-05 keeps gating as BALANCE §7 says. Only if those rows cannot be authored would T-05 move to reported until P3, which is a band change and goes to the owner.
- Class: integrator · Owning: §9 9.2.7 · Affects: s09 catalog, s02 fixtures · Dup: s09-fleet #1 (b carries the catalog ruling; this is consistent with it)

**18. Tuning key shapes** (§7 7.21; §1 1.5.6)
- Decision: Adopt. `ops.heat.thresholdF` 80, `ops.heat.slopePerF` 0.03, `ops.heat.floor` 0.55, `ops.heat.nightMult` 0.95; `ops.fireLevelHoursMult` {1: 0.97, 2: 0.97, 4: 0} plus `ops.fireLevel3DayShiftMaxHours` 8; `ops.freezeupPlantMult` 0.6 plus `ops.freezeupPlantMultByBand` (P5, behind `rulesAtLeast(5)`); `ops.nightLightFreeWeeksNorth` [22, 30]. Update 7.21 and §1 1.5.6 together.
- Class: integrator · Owning: §7 7.21 · Affects: s07, s01 table text · Dup: —

**19. Cementation has no §7 effect** (§3 3.14, 3.7; §7 7.4, 7.6)
- Decision: Modify: give it the effect §3's yardstick and §4's planning already charge, so the three cost models agree. Overburden time per bcy × (1 + `ops.cementationStripSlope` 0.5 × cementation) for dozer and excavator stripping; no effect on pay digging (none in §4's groundWash). Re-check T-03 and T-10 (arid reported) in the tuning loop.
- Class: integrator · Owning: §7 7.4 (D-7.n) · Affects: s07, balance stage · Dup: — (cross-area conflict C-10)

**20. Surface piles in strip work** (§7 7.3, 7.14; §3 3.5.1, 3.9)
- Decision: Adopt. A block's strip work includes its remaining pile bcy when its `cutSource` does not process the pile (that gold goes to `lostToWaste`). Defaults and warnings use only §3's visible `tailingsPiles`/`visibleWorkings` and the player's own deposits (so a drift dump, invisible from the air, defaults to `inSitu`). A `cutSource` that targets a pile which does not exist digs 0 (cause `pay`).
- Class: integrator · Owning: §7 7.3, 7.14 · Affects: s07 · Dup: —

**21. Plant moves** (§7 7.6.8, 7.7, 7.17)
- Decision: Adopt. P1: the line's plant is down (cause `plantMove`) for `plantMoveHoursBase + plantMoveHoursPerRatedBcyHr × rated` scheduled hours after the forced cleanup, with no support machine-hours required; `plantSiteBlockId` switches when done. Excavator-direct shifts use the same cause. Fix 7.6.8.
- Class: integrator · Owning: §7 7.7 · Affects: s07 · Dup: —

**22. Cost-line handoff** (§7 7.1 lastWeek, 7.18 step 14)
- Decision: Adopt with s02 #10: §11 posts this week's cost lines from `StepContext.week`, never from state; step 9 rewrites `ops.lastWeek` for every claim in `ops.claimIds` every week (empty when idle) for display. Property test: each cost line posts exactly once.
- Class: integrator · Owning: §7 7.18 · Affects: s07, s11 · Dup: —

**23. Person-days on site** (§7 7.11, 7.11.1)
- Decision: Adopt. Person-days = (§8 field crew housed at the claim, standby included, + the owner when assigned there) × 7 while the site ∉ {none, winterized}. 7.11.1's 49 = 7 × 7 holds.
- Class: integrator · Owning: §7 7.11 · Affects: s07, s08 (camp counts, cook) · Dup: — (s08-staff #10 overlaps)

**24. freezeUpNotWinterized every autumn** (§7 7.18 step 16; O-13)
- Decision: Adopt. While auto-winterize applies (P1–P2), `ops.freezeUpNotWinterized` is info (never stops); it becomes the 13.10 warning when winterizing is manual.
- Class: integrator · Owning: §7 7.18 · Affects: s07, s13, O-13 · Dup: —

**25. The owner in plan.crew** (§7 7.2, 7.16; §8 8.12)
- Decision: Adopt. `emp_owner` may appear in `plan.crew` only when the owner's (pending or current) assignment is `operator` on that claim, paired to the named machine (else `EMPLOYEE_NOT_AVAILABLE`). An owner `foreman` supervises but does not operate. `ownerHours` = the owner's paired hours plus supervision hours, capped at §1's 60.
- Class: integrator · Owning: §7 7.2 · Affects: s07, s01, s08 · Dup: —

**26. §4 sampling on a block §7 has started** (§7 7.3; §3 3.8; §4 4.3)
- Decision: Modify. G0 is fixed at the block's first dig (stripping books no gold), not at its first strip; §4 refuses pits on blocks with `areaMined > 0` (`BLOCK_BEING_MINED`). Pits on stripped-but-undug blocks stay allowed and simply reduce `sampledBcy` before G0 is fixed.
- Class: integrator · Owning: §7 7.3; §4 4.12 · Affects: s07, s04 validators · Dup: —

**27. Later-phase plan inputs under P1 rules** (§7 7.17, 7.20)
- Decision: Adopt. Under P1 rules `purpose: 'bulkSample'` fails `BULK_SAMPLE_LIMIT` (§6's allowance is 0 until P2); `reclamationCrewHours` is accepted and ignored with a warning (reclaim machines book `noWork`); `winterOps`, `fuelFillToGal` and `fuelByAir` are stored and ignored. All switched by `rulesAtLeast`.
- Class: integrator · Owning: §7 7.17, 7.20 · Affects: s07 · Dup: —

---

## Owner questions

Only the class=owner rulings. Each default is being implemented meanwhile.

- **Q1 (s04 #4) — new key shape for sample-gold fineness assays.** §4's automatic assay of sample gold (each ≥ 300 mg, 4.7) needs random draws, and no stream key exists for it; CLAUDE.md treats a new key shape as expensive. Options: (a) `rng(seed,'prospect',claimId,'assay',n)` on §4's existing stream with a per-claim counter `knowledge.assayCount` (an action-time-style per-subject counter, stream rule c); (b) defer sample assays to P2, so P1 fineness stays at the template prior until P5's refinery assays; (c) append a fineness draw to each sample's existing `sample`-stream draw and pool them (no new shape, but it changes §3's calibrated `drawSample` layout and ties assays to individual samples). **Recommended default: (a)**, as with §0 call 24, accepted because no code, save or golden uses the stream yet.
- **Q2 (s03 #17 / s04 #15) — OQ-3.4, the lever for hand-cut parcels that work no block.** Options: (a) after the P1 re-measure, a `handCut` parcel with no eligible block records kind `none` (no gold moves; T-01/T-02 unchanged; D-3.45 holds), and `geology.recordsWorkedShare.handCut` is set from the measurement; (b) raise the hand-cut `maxObFt` so more northern parcels work a block; (c) lower the template's `handCut` share and the records share together (the default's second lever). (b) and (c) change ground truth and need full §3 and §4 recalibration. **Recommended default: (a)**, applied only if the P1 re-measure confirms the P0 figure.

## Cross-area conflicts

Interfaces two sections describe differently, with the resolution adopted above.

- **C-1 `accessOpen` and `claimAccess` (§1 1.4.5 vs §3 3.3.3).** §3 writes a `week` argument and mode names `flyIn air` / `flyIn barge`; §1 says current week only. Resolution: `accessOpen(state, districtId, mode)` with modes `highway | seasonalRoad | winterTrail | air | barge`; `claimAccess(state, claimId)` with no turn, applying the claim-scoped closure hook itself (s01 #8).
- **C-2 Owner time (§1 1.9 vs §3 3.12 / §4 4.2 / §8).** §1 says "carries into next week" with no queue state; §3 resolves "at the step 7 in which §1 books its days". Resolution: §1's FIFO desk queue with partial booking and owners' `canResolve` (s01 #1).
- **C-3 Backed royalty minimum (§1 1.17 step 14 vs §5 5.12/5.16 step 6).** Resolution: §11 evaluates it in 14c of week 52 after that week's cleanups through §5's `minimumShortfallCents`; §5's interest (`paidToDate`, `stepDown`) is the single source of delivered value and the tail switch; `InvestorAgreement.deliveredValueCents` is derived (s01 #25).
- **C-4 Owner balances (§1 1.9 vs §11 owner book).** Resolution: selectors over the ledger, not stored fields (s01 #6).
- **C-5 Salary above the investor cap (§1 1.8.1/1.21 vs 1.16).** Resolution: rejected with `ABOVE_CAP_INVESTOR` (s01 #16).
- **C-6 Owner pay and the P1 counter (§11 11.4 "owner items deferred without penalty" vs 11.16 "any failed payment").** Resolution: owner-category shortfalls never open the counter; a corp owner's wage carries payroll tax but no WC (s01 #15; b's s08-staff #18 and s11-finance #8 should match).
- **C-7 Start NW (D-2.54 "from tuning" vs the Inheritor's fleet).** Resolution: `netWorth(state, 'scoring')` on the fresh `newGame` state; the formation fee is billed at turn 1 so the table values hold (s02 #15, s01 #2).
- **C-8 Production reconciliation (§4 4.4.6 vs §7 7.16).** §7 subtracts `pileRawOzEst`; §4 attributed the full weighing. Resolution: §4 attributes `rawOzWeighed − pileRawOzEst` and ships the pile prior in P1 (s04 #3).
- **C-9 Gold in a block (§7 7.3 G0 vs §3 contained gold).** Resolution: G0 subtracts `minedBcy` and is fixed at the first dig (s07 #6, #26).
- **C-10 Ground costs (§3 yardstick and §4 groundStrip vs §7).** §3/§4 charge cementation; §7 ignored it. Resolution: §7 applies the same strip multiplier (s07 #19).
- **C-11 M-RATE (BALANCE §5.8 vs §7 7.8).** Resolution: `runHours` on the plant's `MachineWeekHours` (s07 #1).
- **C-12 Panning on open ground (§4 4.2 vs §5 5.5).** Resolution: §5 (none in P1) (s04 #7).
- **C-13 Hook registries (§7 7.19, §5 5.17 vs §12 12.3).** Resolution: §12's table gains every published hook; a data test cross-checks owners' lists (s07 #14, s05 #22; b's s12-events #5).
- **C-14 Production counters (§2.5 `weighedRawOz`, §1 1.12 "fine oz recovered", §7 7.10, §10 test 13).** Resolution: `weighedRawOz` = cleanup weighings only; `fineOzRecovered` = gross cleanup weighed raw × estimated fineness + sample lots at creation (s02 #19, s01 #21; b's s10-gold #13 should match).
- **C-15 Leased claims (§3 status model vs §5 tenure).** Resolution: `leasedToPlayer` outcome keeps the lessor as holder; `returnFromLease` (s03 #11).
- **C-16 Season-end cleanup (§7 7.10 "last operating week" vs P1 auto-winterize at the first winter week).** Resolution: the cleanup runs in the winterizing week on off-day crew hours (s07 #11).
- **C-17 Patented ground in P1 (§3 3.4 generates it vs §5 5.18 excludes it).** Resolution: never a P1 candidate; its hazard draw is still taken (s03 #12).
- **C-18 Cost model in valuation (§5 5.13 formula vs §4 `costUsdPerPayBcyM`).** Resolution: §4's figure plus the capital charge (s05 #26).
- **C-19 Contractor lead time (§4 4.19 "fixed 1 week" vs 4.22 difficulty scaling).** Resolution: the 4.12 formula with base 1 (s04 #8).
- **C-20 Seller status `contradicted` (§4 4.10.1 P2-only vs 4.10.5 records tell).** Resolution: records tells may set it from P1 (s04 #21).
- **C-21 Fixture constructor (§2.2 public surface vs sim's need for fixed ground and crew).** Resolution: `newFixtureGame` on the public surface (s02 #2; b's s08-staff #27).
- **C-22 Bot foreman rule (§2.14 fixture vs §2.12.1 / D-8.33).** Resolution: §2.12.1 (s02 #1).
- **C-23 Fineness source before assays (§4 `finenessP50` vs §10 district prior).** Resolution: §10 `claimFineness.alloy` reads §4 `finenessP50` until a refinery assay (s04 #4; b's s10-gold #1 should match).
