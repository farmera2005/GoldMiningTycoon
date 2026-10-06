# P1 triage rulings, areas s08–s13 (staff, fleet, gold, finance, events, UI)

Source: `digest-issues-b.json` (131 issues). Each entry: **decision** (what P1 does), **class**, **owning** (where the D-x.n or text change is recorded), **affects** (areas / packages that must follow), **dup** (same problem elsewhere; "rel" = related, not identical). "Adopt" = the reader's recommendation as written; "Modify" = adopted with the stated change. New decision numbers are left as `D-x.n` for the integrator to assign. Every value a ruling introduces goes into the owning tuning file and its DESIGN table in one commit, and is logged in `src/data/tuning/CHANGELOG.md`.

Class key: **integrator** = decide and record a D-x.n; **owner** = expensive to reverse (CLAUDE.md rule 2) or changes the brief's intent. No issue in this file is owner-class (see "Owner questions").

---

## s08-staff (27)

**S08-1. Hooks missing from 12.3** (§8 8.16; §12 12.3)
Decision: Adopt. `data/events/hooks.ts` registers all six §8 hooks, each with `consumerPhase`: `staff.wageAskMult`, `staff.poolSizeMult` (mul, base = the difficulty tuning value, scope district; P1); `staff.crewAvailableFrac` (set, neutral 1, scope claim, unscoped = company; P1); `staff.quitHazardMult` (mul, base = difficulty tuning 0.7/1.0/1.3, scope district, claim, employee; P1); `staff.moraleTargetAdd` (add, neutral 0, bounds ±10 pts, scope district, claim, employee; P1); `staff.injuryHazardMult` (mul, neutral 1, scope claim; P2). Add the two missing rows to 12.3 in the same commit. The difficulty rows `staff.wageAskMult`, `staff.poolSizeMult`, `staff.quitHazardMult` and `staff.resumeBiasMult` are not yet in `data/difficulty.ts` and go in with them.
Class: integrator · Owning: §12 12.3, §8 8.16 · Affects: Wave 0 (registry, difficulty table), s08, s12 · Dup: s12-events#5 (staff part)

**S08-2. CLD stub** (§8 8.4, 8.17, 8.20)
Decision: Adopt. §12 `competitorLaborDemand` returns 0 until P5. §8's pool term uses it as is (×1.0 in P1, so 8.4's 3.0 / 2.25 / 1.35 / 3.9 example holds). The quit and recall logits use CLD = 0.5 while `!rulesAtLeast(5)` (term vanishes), the stub value after. Scarcity is 1.0 and there are no back-out rolls before P5 (the `staff-hire (turn, empId)` draw is subject-keyed, so skipping it shifts nothing). Rewrite 8.17 *Stubs* to say exactly this.
Class: integrator · Owning: §8 8.17 · Affects: s08, s12 (stub) · Dup: —

**S08-3. seasonWage phase** (§8 8.4, 8.17, 8.20)
Decision: Adopt. In P1 `seasonWage` = 1.0 behind `rulesAtLeast(5)`, so `marketWage` = `marketWageBase` (8.20 "P1 market wage equals base"). `seasonPool` and the forecast-keyed rush window ship in P1, so the no-look-ahead test applies to pool targets and `employedP`. New D-8.n.
Class: integrator · Owning: §8 8.4, 8.17 · Affects: s08 · Dup: —

**S08-4. Unphased mechanics** (§8 8.3, 8.4, 8.9, 8.17)
Decision: Adopt. P1 ships absence draws (8.9, `staff-absence`), skill growth, the ≥ 12-weeks-worked experience increment (step 10 / step 1), referrals and former-employee re-entry (8.4). Add them to 8.17 P1. BALANCE fixtures switch absence off (S08-21).
Class: integrator · Owning: §8 8.17 · Affects: s08 · Dup: —

**S08-5. Former-employee re-entry store** (§8 8.4; streams.ts)
Decision: Modify. No new collection: extend `Separation` with `reentry?: { turn: number; snapshot: CandidateSnapshot }`, set when the person leaves the roster and the `('former', empId)` draw succeeds (p 0.3, delay U{13..52}). Separations are kept 156 weeks, longer than the 52-week maximum delay. Step 3 turns the snapshot into a `formerEmployee` candidate in its district when `turn = reentry.turn`, carrying the observation history. Add `'former', empId` to the `staff-market` keyShape doc in `streams.ts` (documentation only: 8.4 already fixes the key).
Class: integrator · Owning: §8 8.4, 8.16 (Separation) · Affects: s08, Wave 0 (types) · Dup: —

**S08-6. staff-cand draw order** (§8 8.3)
Decision: Adopt. Fixed order: expYears, skill, reliability, safety, skillCap, origin, employedElsewhere, mshaTrained, opClass primary, opClass secondary, altRoleGap, résumé noise (center and width per attribute, by source), askMult noise, leavesPoolTurn, name. Every draw is taken for every candidate in P1, including draws its role or phase does not use (mshaTrained for office roles, opClass for non-operators, résumé noise before P3). So P2 and P3 change no P1 truth. Attributes fixed by an `addCandidate` spec still consume their draws. Write the order into 8.3 and add a stream-order test.
Class: integrator · Owning: §8 8.3 · Affects: s08 · Dup: —

**S08-7. Inheritor former hand** (§1 1.8.2; §8 8.3)
Decision: Adopt. `addCandidate(state, spec, stream?)` takes an optional stream supplied by the caller (the D-1.65 pattern), and §1 passes `s.hand`. Spec: role operator, origin local, tag `formerEmployee`, shown exactly in P1. Set `askMult = 34 / marketWage(operator, district, turn 0)`, so $34.00 is the base ask before the assigned claim's remote premium. `leavesPoolTurn` = max(drawn value, the year-1 forecast P50 breakup), so he does not churn out before the season.
Class: integrator · Owning: §1 1.8.2, §8 8.3 · Affects: s01, s08 · Dup: —

**S08-8. Pool at newGame** (§8 8.4; §1 1.17)
Decision: Adopt. In `newGame`, after world and climate, for each district (ascending) and each role (in `Role` order), draw n ~ Poisson(poolTarget at turn 0) on `rng(seed,'staff-market',0,districtId)` and create n candidates, each generated on `staff-cand` by candId. This is the registered `(turn, districtId)` key shape, and turn 0 never runs step 3.
Class: integrator · Owning: §8 8.4 · Affects: s08, s01 (newGame order) · Dup: —

**S08-9. Employee fields** (§8 8.1, 8.3, 8.5, 8.7, 8.8, 8.12)
Decision: Adopt. Add the P1 fields:
- `pendingAssignment: Assignment | null`, applied at the next step 7.
- `pendingPay: { bonusCents; severanceCents }`, paid in the next payroll.
- `lastWeek: { hoursByDay[7]; availableFraction; claimId | null; lineId | null; onSite }`. Morale reads last week's values in step 7, so this must persist.
- `weeksWorkedThisYear`, `moralePrev` (for the roster trend), and `leaving: { turn; walkOff } | null`.
- `StaffSlice.supervision[claim][line]` gains `lastSupervisorQuitTurn`, plus this week's `kind` and `qF`.

Also ship every P2+ field of 8.3's `Employee` and `StaffSlice` at neutral defaults (training, bonus, rotation, probation, recall, retainer, `flexHourPlan`, `leakage`), so P1 saves load in P2 without a migration (D-2.34).
Class: integrator · Owning: §8 8.1, 8.3 · Affects: Wave 0 (state types, newGame), s08, save fixtures · Dup: rel s01-structure#31 (same pattern)

**S08-10. Hours outside §7's crew** (§8 8.6; §7 7.16; §9 9.14)
Decision: Adopt, made precise:
- **Hired foreman:** the claim's scheduled day-shift days × hours while its plan is active (as §7's `ownerHours`), else the 40 h guarantee.
- **Site mechanic (P1):** the claim's scheduled shift-1 hours, through a §9 P1 `shopHours` stub (`byClaim` = his claim).
- **Cook:** camp days = days the claim has field crew on site (site status ∉ {none, winterized}) × `staff.cookHoursPerCampDay` (10).
- **Salaried geologist:** `programCrewUse` hours, else 40 office hours.

All of these feed fatigue, the morale hours term, the overtime spread and cost centers. New D-8.n; 9.14 notes the stub.
Class: integrator · Owning: §8 8.6, §9 9.14 · Affects: s08, s09, s07 (schedule read), sim/bots (mechanic-wage projection) · Dup: rel s07-ops#25

**S08-11. Standby exploit** (§8 8.5, 8.6, 8.13)
Decision: Adopt. Every active hourly employee who is not laid off, injured or on rotation off is paid the guarantee (40 h less absences); standby means on call. Standby lines: cost center `site` with no claimId ("Unallocated site") for field roles, `ga` for office roles; jurisdiction = `homeDistrictId`. Layoff becomes the only way off payroll. State it in 8.6 (D-8.n).
Class: integrator · Owning: §8 8.6 · Affects: s08, s11 (payroll lines) · Dup: —

**S08-12. START_TOO_SOON** (§8 8.5; §2 2.6)
Decision: Adopt. Earliest `startTurn` = max(turn + 1, availableFromTurn) + leadTime. The arrival is processed in step 7(a) of the `startTurn` pipeline. The same rule applies to `staff/recall`.
Class: integrator · Owning: §8 8.5 · Affects: s08, s13 (modal defaults) · Dup: —

**S08-13. Fly-in fare when closed** (§8 8.5, 8.13)
Decision: Adopt. Add `flyInIfClosed?: boolean` (default false) to `staff/hire`, `staff/recall` and inter-district `staff/assign`.
- If the road is closed in the arrival week, true arrives on time at `staff.travelUsd.flyIn` (plus out-of-region air where it applies); false lets the arrival slip week by week until `accessOpen`.
- Recall lead time = travel weeks only, with no notice period.
Class: integrator · Owning: §8 8.5, 8.14 · Affects: s08, s13 · Dup: —

**S08-14. Layoff and recall decisions** (§8 8.13, 8.15; actions/types.ts)
Decision: Modify.
- `staff.layoffDecision` is raised at the revealed freeze-up, northern districts only. Options: `layoffDefault` (default: hourly field crew to the recall list; salaried and shop staff kept) and `keepAll`. Deadline: freeze-up week + 2.
- `staff.recallDecision` is raised at forecast P50 breakup − 6. Options: `recallAll` (default; startTurn = max(earliest feasible, forecast breakup − 1)) and `recallNone`. Deadline: +2 weeks.
- For the no-op options, make `DecisionOption.action` optional in §2 2.2 (absent = the answer closes the decision with no effect), rather than accepting empty-list actions. This also serves every other "decline" option (§12 offers, §1 requests).
Class: integrator · Owning: §8 8.13, 8.15; §2 2.2 · Affects: Wave 0 (DecisionOption), s08, s13 · Dup: rel s12-events#2

**S08-15. Lead hand with partial availability** (§8 8.12)
Decision: Adopt. A week counts toward `leadHandWeeks` when the supervisor's a < 0.5, and as a present week when a ≥ 0.5 (so 8.20's 0.667 desk-day case is a present week). qF blends by a every week. Firing or reassigning the foreman is not an absence: the claim stands down at the next step 7 with no lead hand.
Class: integrator · Owning: §8 8.12 · Affects: s08 · Dup: —

**S08-16. Firing and departure timing** (§8 8.8, 8.13; §11 11.3)
Decision: Adopt.
- Severance and one-off bonuses go in `parts.bonusPaid`.
- A fired employee leaves the roster at action time (Separation written, status `gone`); severance is paid in the next 14b and return travel billed in 14c.
- A quitter who does not walk off works and is paid this week, then leaves in step 16.
- `payrollForWeek` includes departed employees with pending pay. `unpaidWages` entries persist until cents = 0, so `recordPayrollOutcome` still runs for departed employees.
Class: integrator · Owning: §8 8.13 · Affects: s08, s11 · Dup: —

**S08-17. Role ↔ assignment table** (§8 8.5, 8.14)
Decision: Adopt. Put the table in 8.5 and in `data/staff/roles.ts`:

| Assignment | Allowed roles |
|---|---|
| claim | foreman, operator, plantOperator, laborer |
| program | operator, laborer, geologist (driller from P3) |
| shop | mechanic, welder |
| district | geologist, safetyOfficer |
| camp | cook |
| security / caretaker | laborer |
| office | bookkeeper, controller, landSpecialist, geologist |
| standby | any role |

- `ROLE_INCOMPATIBLE`: a role outside the table.
- `COVERAGE_ROLE_ONLY`: a `district` assignment for any other role.
- Warning `CAMP_FULL`: the move would make `campSummary(claim).overCapacity` > 0.
- Cross-role cover (`canFill`) stays §7's pairing rule inside a claim crew.
Class: integrator · Owning: §8 8.5 · Affects: s08, s13 · Dup: —

**S08-18. Corp owner salary line** (§11 11.3; §1 1.9)
Decision: Adopt. `payrollForWeek` emits the corp owner's salary as one `isOwner` line (cost center `ga`, `wcClass` clerical, the owner's home jurisdiction). In P1 §11 applies only `p1PayrollTaxRate` to `isOwner` lines (no WC, D-11.27). A sole-prop or LLC salary stays an owner-category distribution (11.3).
Class: integrator · Owning: §8 8.6, §11 11.3 · Affects: s08, s11, s01 · Dup: s01-structure#15

**S08-19. ownerSkill in two places** (§1 1.18; §8 8.16)
Decision: Adopt. One implementation in `systems/staff/owner.ts` (keys `staff.*`; geologist = `geology.ownerGeologistSkill`), re-exported by §1's module; 1.18 lists it as a re-export.
Class: integrator · Owning: §8 8.16 · Affects: s01, s08 · Dup: —

**S08-20. crew.noForeman emitter; "key employee"** (§13 13.10; §8 8.15; §7 7.18)
Decision: Adopt. §8 is the only emitter, in step 16, from `StaffSlice.supervision`: one signal per claim naming the stood-down lines and the reason (`reassigned` / `leadHandExhausted` / `smallCrewExceeded`). §7 emits none; amend 7.18 step 16 and the 13.10 row. A "key employee" for `crew.moraleLow` is a foreman, plant operator or mechanic, the same set as the `employee.quit` critical rule. Thresholds come from `game.alerts.moraleWarn*` (S12-16).
Class: integrator · Owning: §8 8.15; §13 13.10 · Affects: s07, s08, s13 · Dup: rel s12-events#16

**S08-21. Morale and quit balance risk** (§8 8.7, 8.8; BALANCE §2.1, §9.1; §2 2.12.1)
Decision: Modify.
- (a) The bots' "minimum crew for the fleet" includes ceil(onSite / `staff.crewPerCook`) cooks. The catalog is first implemented in P1 (BOT_VERSION 1.0), so this is its initial definition, not a retune. Write it into BALANCE §4.1 and §2.12.1 before any baseline exists.
- (b) BALANCE §2.1 fixtures run with staff noise off through fixture-only tuning overrides (`staff.quitHazardMult` 0, `staff.absence.base` 0), as they already run with no events. The bot matrix keeps morale and quits on.
- (c) The first full P1 sim reports quits per season by bot and start beside O-01, O-13 and O-14 before any morale retune (one lever at a time). Flag the fixture convention in the P1 phase report.
Class: integrator · Owning: BALANCE §2.1, §4.1; §2 2.12.1 · Affects: sim/bots, sim/fixtures, s08 · Dup: rel s02-architecture#3 (fixture determinism)

**S08-22. crewRequirement and payrollProjection** (§2 2.12.1; §11; §8 8.16)
Decision: Adopt. 8.16 gains two functions.
- `crewRequirement(state, claimId, plan)` returns per-role counts: one operator per operated machine per shift, one plant operator per running line per shift, cooks per `crewPerCook`, and a foreman per 8.12.
- `payrollProjection(state, weeks)` returns weekly gross plus burden from visible inputs: rates, plan schedules with §1's phase outlook, pending arrivals and recalls, the guarantee, and 0 for laid-off staff.
- §11's `forecast13Week` and `dueThisWeek` read `payrollProjection`; bots read `crewRequirement`.
Class: integrator · Owning: §8 8.16 · Affects: s08, s11, sim/bots · Dup: rel s11-finance#14

**S08-23. Labor-season classification** (§8 8.3, 8.4)
Decision: Adopt. `laborSeason(state, districtId, turn)`:
- Northern, in precedence order: rush ([B̂ − 8, B̂ + 2] on the forecast, or the revealed date) > postFreeze (from the revealed freeze-up start until `staff.postFreezeWeeks` (8) weeks after winter begins) > operating (the revealed phase) > winter.
- Arid: prime when the week's calendar month (§1 mapping) is October–April, heat for May–September.
- This one function feeds `seasonPool`, `employedP` and the operating-season mean stay.
Class: integrator · Owning: §8 8.4 · Affects: s08 · Dup: —

**S08-24. Recall pay** (§8 8.13)
Decision: Adopt. A recall restores the stored `payStructure`. The recall modal shows max(old rate, market × askMult) as advice, and the player raises pay with `staff/setPay`. No extra morale term: the pay term already compares pay with `marketRef`. Amend 8.13's sentence.
Class: integrator · Owning: §8 8.13 · Affects: s08, s13 · Dup: —

**S08-25. Recruiter link** (§8 8.4, 8.6)
Decision: Adopt. Add `Candidate.recruiterOrderId?`. Recruiter candidates get `leavesPoolTurn` ≥ the order's `expiresTurn` (delivery + 4 weeks). The fee, deposit credit and forfeit check read the link.
Class: integrator · Owning: §8 8.3, 8.4 · Affects: s08 · Dup: —

**S08-26. Hidden fields for P1 scramble tests** (§2 2.14; §8 8.3)
Decision: Adopt.
- §8's hidden fields: `truth`, `resumeNoise`, `leavesPoolTurn`.
- In P1, `shown` is a degenerate range equal to truth, and §8 rewrites it whenever truth changes (skill growth) while `!rulesAtLeast(3)`.
- `employedElsewhere` is visible ("notice 2 wk"), and the quit band uses shown inputs.
- Selectors, validators, bots and UI read only `shown`, `employedElsewhere` and visible state.
- Register the §8 scrambler (truth, resumeNoise, leavesPoolTurn; never `shown`) with `sim/bots/scramble.ts` (D-2.58).
Class: integrator · Owning: §8 8.3; §2 2.14 · Affects: s08, sim/bots · Dup: rel s13-ui#12

**S08-27. Fixtures need exact employees** (BALANCE §2.1; public surface)
Decision: Follow s02-architecture#2's ruling. This file's position: `engine/index.ts` exports a `fixtures` setup namespace (lint forbids it in `ui/`) that includes `addCandidate` with a truth spec; the fixture then hires through `staff/hire`, so pay, arrival and payroll take the real path.
Class: integrator · Owning: §2 2.2, 2.12 · Affects: sim/fixtures, s08 · Dup: s02-architecture#2

---

## s09-fleet (24)

**S09-1. matureNorth needs non-P1 models** (BALANCE §2.1, T-05, T-07; §9 9.2.7, 9.15)
Decision: Adopt.
- Ship ex45, dz9, adt40, ld980, tr300, cenL, pmp10, gen300 and campM25 as catalog rows tagged phase 3. They are never listed in P1 markets; fixtures and tests may build them.
- Add their `fleet.p1MaintUsdPerHr` values by D-9.25's method and log them.
- BALANCE §2.1 states that under P1 rules `matureNorth` runs at §7's 0.92 availability, sells to the local buyer (refinery from P5) and carries its $3.0M as a fixed P1 loan. T-05 and T-07 measure throughput and opex shares, which these choices do not move.
Class: integrator · Owning: §9 9.2.7, 9.15; BALANCE §2.1 · Affects: s09 data, sim/fixtures · Dup: s07-ops#17 (also s02-architecture#4)

**S09-2. T-09 (b) models** (BALANCE T-09; §9 9.2.3, 9.17)
Decision: Adopt. Ship the dz9 and pkg300 rows (and the pkg300 items) as phase-3 data in P1. T-09 (b) is a catalog data test with the real brand multipliers (dz9 list and pkg300 package ≥ $1.5M); P1 rules still resolve brand multipliers to 1.0 (S09-18).
Class: integrator · Owning: §9 9.17; BALANCE T-09 · Affects: s09 data, tests · Dup: —

**S09-3. Thin P1 used market** (§9 9.3.3; BALANCE §4, G-02)
Decision: Adopt (D-9.n).
- Under P1–P2 rules, each district's hub dealer holds a standing **graded-used offer** for every P1 catalog model at each grade A–D, deterministic and in unlimited quantity. Age = the grade midpoint (A 2.5, B 6, C 11, D 21 yr); hours = age × `fleet.hoursPerYearMedian` (× 0.6 for plants and light); ask = FMV(condRef) × `p1GradePriceMult[grade]`.
- The six rotating graded listings stay as variance and bargains.
- P3 replaces the offers with the certified, private and auction channels (`rulesAtLeast(3)` switches them off).
- Bots, G-02 and T-09 (c) use the offers. Fixtures build fleets through the setup helper, not the market.
Class: integrator · Owning: §9 9.3.3, 9.14 · Affects: s09, sim/bots, BALANCE T-09 · Dup: rel s02-architecture#2

**S09-4. Grade and price of a machine bought new** (§9 9.3.2, 9.10)
Decision: Adopt. A machine delivered new is grade A for rate and maintenance, with price multiplier 1.0 at condRef for life under P1–P2 rules. `p1GradePriceMult` applies to used listings, the dealer graded-used offers, machines bought used, and inherited machines. Property test: no resale estimate or used ask exceeds the same model's new list.
Class: integrator · Owning: §9 9.10 · Affects: s09, s11 (net worth) · Dup: —

**S09-5. D6 ripper in P1** (§9 9.2.1, 9.11; §1 1.8.2; §7 7.4)
Decision: Adopt.
- Add `fleet.ripperUsd` 35,000 × cpi.
- In P1, `fleet/buy` accepts `options: ['ripper']` on dz6, new or used (`OPTION_INVALID` otherwise).
- Rotating used dz6 listings carry `hasRipper`, drawn as the last draw of that listing's `fleet-listing (listingId)` order at `fleet.p1UsedRipperShare` (0.5). The dealer offers both versions.
- The machine's effective `hasRipper` = the model attribute OR the ripper option; §7 reads this value.
- FMV values options as (newBase + Σ option USD) × the same depreciation, condition and grade factors, which reproduces 1.8.2's ≈ $3k.
Class: integrator · Owning: §9 9.2.1, 9.3.2, 9.15 · Affects: s09, s07, s01 · Dup: —

**S09-6. Inheritor fleet spec** (§1 1.8.2, 1.22; §9 9.3.2)
Decision: Adopt.
- Data holds the full spec (model, age, hours, options) for all eight machines.
- Camps and pickups use 9.3.2's light curve with `hoursWeight` 0.3; `site` items accrue no SMR.
- Choose the missing hours so the formula lands near §1's figures, then restate 1.8.2's table from the formula output (1.22 tests the formula sum).
Class: integrator · Owning: §9 data; §1 1.8.2 · Affects: s01, s09 · Dup: rel s01-structure#18

**S09-7. P1 rate formula** (§9 9.7.2, 9.14; §7 7.6)
Decision: Adopt. The P1 rate is spec × Q(grade) × S(skill) × G × C(tempBand) × E, with E read through `effective('fleet.rateMult', q)` (neutral in P1). Fix 9.14's sentence and re-run T-06 afterwards.
Class: integrator · Owning: §9 9.14 · Affects: s09, s07, BALANCE T-06 · Dup: —

**S09-8. Tuning keys for the P1 generator** (§9 9.3.3, 9.4, 9.15)
Decision: Adopt. New keys:
- `fleet.p1GradeShares`, `fleet.p1GradeAgeYears`
- `fleet.p1UsedListingLifeWeeks` (6), `fleet.p1UsedArrivalsPerWeek` (1)
- `fleet.lightPlantHoursMult` (0.6), `fleet.listingSizeWeights`
- `fleet.newOrderHoldWeeks` (4), `fleet.depositRefundWeeks` (2)
- From S09-3 and S09-5: `fleet.p1DealerUsedAgeYears`, `fleet.p1UsedRipperShare`

Values go into `fleet.ts` and 9.15 in one commit.
Class: integrator · Owning: §9 9.15 · Affects: s09 · Dup: —

**S09-9. Listing locations, destinations** (§9 9.1, 9.3.1, 9.5, 9.11)
Decision: Adopt.
- New units and the dealer's graded-used offers sit at `{ kind: 'dealer', id: districtId }` (the hub leg is priced).
- P1 rotating used listings sit at a new `LocationRef` `{ kind: 'town', id: districtId }`, added now so no migration is needed later.
- In P1, `deliverTo` and move targets must be claims the company holds (`DESTINATION_INVALID`).
- A machine left at a town or dealer location (a move stalled or cancelled) may wait there and move later.
- `fleet/sell` is allowed at any location except in transit.
Class: integrator · Owning: §9 9.1, 9.5 · Affects: Wave 0 (types), s09, s13 · Dup: —

**S09-10. ACCESS_CLOSED rule** (§9 9.5, 9.11, 9.17; §1 1.4.5)
Decision: Adopt. One rule for buy and move, per §1 1.4.5: `ACCESS_CLOSED` only when `accessOutlook` shows no open week for the route's modes in the rest of the outlook horizon. A scheduled week that is `closed` or `uncertain` raises the warning `TRANSPORT_WINDOW_RISK`, and execution stalls week by week. Fix 9.5's "any closed week" sentence.
Class: integrator · Owning: §9 9.5 · Affects: s09, s01 · Dup: rel s01-structure#9 (outlook into next year)

**S09-11. Arrival and assembly timing; spring pricing** (§9 9.4, 9.5)
Decision: Adopt.
- arriveTurn = startTurn + ceil(weeks), processed in step 6; `arriveTurnFrac` stays for display.
- A plant is unavailable while assembling. In the last, partial week, `fleetAvailability`'s `downShare` = the remaining rigging fraction.
- `springMult` is priced at booking from §1's `phaseOutlook` for each leg's week, with `uncertain` counted as restricted (no hidden date is read). The cost is fixed at booking.
Class: integrator · Owning: §9 9.5 · Affects: s09 · Dup: —

**S09-12. Payment timing** (§9 9.4, 9.10)
Decision: Adopt.
- **Used:** price + sales tax through `finance.pay` now (no partial). Inbound transport and assembly are billed in step 14 (`vendor.other`) and capitalized.
- **New:** the 10% deposit through `pay` now, to `prepaid`. The balance is paid through `pay` (pipeline) at delivery in step 6. On failure the unit is held, and the order lapses with the deposit forfeited after `fleet.newOrderHoldWeeks`.
- `INSUFFICIENT_FUNDS` checks only what is paid now. The validator warns `TRANSPORT_UNFUNDED` when cash after the payment is below the quoted transport + assembly.
Class: integrator · Owning: §9 9.4, 9.11 · Affects: s09, s11, s13 · Dup: —

**S09-13. Site upkeep** (§9 9.2.5, 9.10, 9.12)
Decision: Adopt. Billed in step 11 in P1 for site items on a claim whose §7 site status ∉ {none, winterized}: pickup $150/wk × cpi to `exp.parts`, camp units 0.1% of new price per week to `exp.camp`. Add the row to 9.10's ledger table.
Class: integrator · Owning: §9 9.10 · Affects: s09, s11 · Dup: —

**S09-14. Sim observations** (BALANCE §5.2; §2.12)
Decision: Adopt. Add to 9.13:
- Selector `fleetWashCapacityBcyHr(state)` = the max over claims of min(Σ plant rated × grade rate mult, Σ dig/feed rates at `REFERENCE_GROUND` with a skill-50 operator), over owned machines not in transit.
- `FleetSlice.saleLog`: `{ turn, machineIds, proceedsCents, distress }`, kept 52 weeks. `distress` = §11's P1 counter is open (from P4: stage ≥ 1) at the sale.
- Selector `distressFleetSale(state, fromTurn)`.
Class: integrator · Owning: §9 9.13 · Affects: s09, sim/metrics · Dup: rel s02-architecture#18

**S09-15. Machine leaves a plan** (§7 7.2; §9 9.11)
Decision: Adopt.
- The `fleet/sell` and `fleet/move` handlers call §7's `onMachineRemoved(state, machineId)` and §4's equivalent. These drop the machine from `plan.assignments`, `line.machineIds` and program machine lists, then re-validate.
- An active plan that no longer validates stays saved and stands down at the next step 9 under §7's idle attribution.
- §7's resolve skips any machine not on the claim, as a guard.
- The action carries a warning naming the plan.
Class: integrator · Owning: §7 7.2, §9 9.11 · Affects: s07, s04, s09 · Dup: rel s05-land#13, s07-ops#13

**S09-16. Intra-week handoff** (§2.6; turn/types.ts)
Decision: Follow s02-architecture#10. This file's position: a typed, non-persisted per-week scratch on `StepContext` (`ctx.week`) holds machine hours, program machine use, crew hours by day, cost lines, cleanups and pending costs. It is written in step 9, read in steps 10–14, and is never in state or the hash. The framework owns the contract (Wave 0). The same scratch carries §7's cost lines to 14c (s07-ops#22) and S10-2's pending costs.
Class: integrator · Owning: §2 2.6 · Affects: Wave 0, s04, s07, s08, s09, s11 · Dup: s02-architecture#10

**S09-17. Book value at a mid-month sale** (§9 9.10; §11 11.22h)
Decision: Adopt.
- `Machine.book = { accumDepCents, unpostedDepCents }`. §9 accrues the weekly schedule into `unpostedDepCents`; §11's month end posts the sum and clears it.
- A sale or total loss first posts that machine's unposted depreciation, then removes cost and accumulated depreciation and books gain or loss against book value.
- The month-end sum excludes disposed machines.
Class: integrator · Owning: §9 9.10; §11 11.22 · Affects: s09, s11 · Dup: —

**S09-18. Brands in P1** (§9 9.2.6, 9.2.7, 9.3.3)
Decision: Adopt. Each model gets `p1DefaultBrandId` for dealer-new units and dealer offers. Rotating used listings draw the brand on `fleet-listing` from `brand.share` over the brands that make the model, honoring the age limits, at a fixed position in the listing's draw order. Every brand multiplier resolves to 1.0 below `rulesAtLeast(3)`.
Class: integrator · Owning: §9 9.2.7, 9.3.3 · Affects: s09 · Dup: —

**S09-19. T-09 (c) evaluation point** (BALANCE T-09; §9 9.3.3)
Decision: Adopt. Evaluate T-09 (c) on the dealer graded-used offers (S09-3: grade-midpoint age, median hours) of ex30, ld966 and adt30 at grades B and C. Write it into T-09 (c) / M-PRICE and the catalog test. This defines the evaluation point; the band is unchanged.
Class: integrator · Owning: BALANCE T-09, §5 M-PRICE · Affects: tests, s09 · Dup: —

**S09-20. Hidden fields in the P1 shape** (§2.14; §9 9.1)
Decision: Adopt. `Machine.pm` and `EquipmentListing.truth` are optional and unset in P1 (`components` empty). No §9 scrambler until P3, which registers it with hidden condition. P1 stores no §9 hidden field, so the "no hidden block lacks a scrambler" check holds.
Class: integrator · Owning: §9 9.1 · Affects: Wave 0 (types), s09 · Dup: rel s13-ui#12

**S09-21. Machine age** (§9 9.3.2)
Decision: Adopt. ageYr = (displayYear(turn) − modelYear) + (week − 1)/52, fractional. Listings display the integer age.
Class: integrator · Owning: §9 9.3.2 · Affects: s09 · Dup: —

**S09-22. Transport data gaps** (§9 9.2.2–9.2.4, 9.5)
Decision: Adopt. Data from 9.5's worked examples and R4:
- Light loads: pmp6 0.3, gen100 0.4.
- dz8: 2 loads, 1 OS. tr75: 2 loads, 1 OS. tr150: 3 loads, 1 OS.
- `assemblyCrewHours` 0 for tr50, grz40, dw20, jigS and cenM (skid-mounted, set up with the site).
- `weightLb` for airliftable plants and light items, from R4.

Log the values and pin the 9.5 examples in tests.
Class: integrator · Owning: §9 9.2 data · Affects: s09 · Dup: —

**S09-23. Program-hour maintenance cost center** (§4 4.12; §9 9.14)
Decision: Adopt with a correction: `PostingLine.dims` has no `programId`. Flat maintenance on `programMachineUse` hours posts with `costCenter: 'prospecting'` and the program's `claimId` in dims, with the programId in `refs`.
Class: integrator · Owning: §9 9.14 · Affects: s09, s04, s11 · Dup: —

**S09-24. Bot fleet tiers** (§2.12.1; BALANCE §4.1)
Decision: Adopt. `sim/bots/fleetTiers.ts` defines the tiers as data, recorded in BALANCE §4.1:
- **starter** = the `starterNorth` / `starterArid` fleets.
- **reference** = the `refSmallNorth` fleet.
- **mid (north)** = `refSmallNorth` without the adt30, with dz6 (ripper) for dz8 and ld950 for ld966.
- **mid (arid)** = `starterArid` with tr75 for tr50.

Tiers are priced on the S09-3 dealer offers at grades B–C, with the starter excavator, dozer and plant at D (D-2.29). This is BOT_VERSION 1.0's first definition, not a retune.
Class: integrator · Owning: BALANCE §4.1; §2 2.12.1 · Affects: sim/bots · Dup: —

---

## s10-gold (17)

**S10-1. Source of estimated alloy fineness** (§10 10.9, 10.18; §5 5.12; §4 4.7)
Decision: Adopt.
- In P1–P4, `claimFinenessKnowledge(state, claimId).alloy` = §4 `knownEstimate(claimId).finenessP50` (§4's prior is the template mean; its updates come from 4.7's automatic sample-gold assays and melted-cleanup readings).
- `alloyBasis` is `regionPrior` with no assay evidence on the claim, and a new `sampleAssays` value once §4 has one. Dirt stays `ops.goldRoomDirtFrac`. From P5, refinery assays take over as 10.9 says.
- Each lot stores `estFineness` at creation, and held lots keep it.
- Update 10.9 and 10.18. One number then reaches §5's f_est, §7, §11 and the UI.
Class: integrator · Owning: §10 10.9, 10.18 · Affects: s04, s05, s07, s10, s11, s13 · Dup: rel s04-prospecting#4, #22

**S10-2. keepCashAbove under-sells** (§10 10.14; §11 11.23; §2.6)
Decision: Adopt. Signature: `dueThisWeek(state, pending?)`.
- The step-12 standing-order executor passes this week's costs not yet billed (from `ctx.week`, S09-16: §7 cost lines, staffing costs) and `payrollProjection` for this week from the step-10 hours, with burden. It adds loan dues and open bills due ≤ this week (§9's step-11 bills are already open).
- Outside the pipeline, it uses projections.
- No step is reordered.
- Fixture: a cleanup week whose fuel bill the order covers, with no failed payment. Update 11.23 and 10.14.
Class: integrator · Owning: §11 11.23; §10 10.14 · Affects: s10, s11, s07, s08 · Dup: s11-finance#2 (same issue)

**S10-3. Partial lots and the small-lot add** (§10 10.10, 10.14)
Decision: Adopt.
- The size add uses the total raw oz sold to one buyer in one action or one standing-order run; the fineness error stays per lot's claim.
- The partial is the smallest whole milli-oz amount of the last lot whose payout covers the remaining need (binary search; payout is non-decreasing in raw oz).
- `netSalePerFineOz` evaluates d at the held raw oz of the lot's district, mirroring refineryNet's one-shipment rule.

D-10.n.
Class: integrator · Owning: §10 10.10, 10.14 · Affects: s10 · Dup: —

**S10-4. weeklyCapUsd = Infinity** (§10 10.10)
Decision: Adopt. `weeklyCapUsd?` is absent = no cap (P1); `capUsedCents?` is absent until P5. Update 10.10.
Class: integrator · Owning: §10 10.10 · Affects: s10 · Dup: —

**S10-5. Lot raw oz as a float** (§10 10.9; §2.4, D-2.2)
Decision: Adopt. Store `GoldLot.rawMilliOz: MilliOz` (likewise `Shipment.rawMilliOz` and sales rows); selectors expose rawOz. Update 10.9 and 10.17 in the same commit. Integrator-class because it applies §2.4 / D-2.2's existing rule (traded gold moves in integer milli-oz) rather than changing the representation.
Class: integrator · Owning: §10 10.9, 10.17 · Affects: Wave 0 (types), s04, s07, s10, s11 · Dup: —

**S10-6. Inventory identity needs running totals** (§10 10.9, 10.17)
Decision: Adopt. `GoldSlice.createdRawMilliOz { cleanup, sample }` is incremented in `addLot`. The property test and a debug assertion check that created = Σ live lots by status + archive.
Class: integrator · Owning: §10 10.17 · Affects: s10, tests · Dup: —

**S10-7. soldFineOz week attribution** (§2.5; §10 10.16)
Decision: Follow s02-architecture#9. This file's position: `gold.weekSales { fineOz, rawMilliOz, netCents }` is incremented by every sale and reset after the step-16 snapshot, so each sale counts once, in the next snapshot. Ledger receipts keep the action turn; yearly revenue comes from ledger dates and sold ounces from the accumulator.
Class: integrator · Owning: §2 2.5 · Affects: s02 (history), s10, s11 · Dup: s02-architecture#9

**S10-8. Sales rows and ChannelQuote** (§10 10.14, 10.17; §13 13.11)
Decision: Adopt. Sales rows gain `lotIds`, `rawMilliOz` and `spotUsd` (fineOz = estimated fine, never true). Define `ChannelQuote` in 10.14 as recommended (channel, buyerId?, basis, fineOz, grossCents, deductions[], netCents, cashTurn, netPerRawOz, pctOfSpot, priceRisk, impliedFineness?, yourFineness).
Class: integrator · Owning: §10 10.14, 10.17 · Affects: s10, s13 · Dup: —

**S10-9. Visible numbers that depend on truth** (§10 D-10.28; §13 T8; §11 11.19.6)
Decision: Modify.
- Every engine, bot and forecast figure uses `netSalePerFineOz` (expected public terms). That covers §11's forecast, net worth, bots' `cashPlan`, and the pre-advance sheet's decision to show (through S13-2's `fundingPreview`).
- The actual quote appears only in the Sell calculator and in the pre-advance sheet's "local-buyer net" cell, which T8 whitelists. The realized payout still uses the actual quote (it is the price).
- In explain trees the buyer's fineness read is a visible leaf with no hidden children.
Class: integrator · Owning: §10 10.14; §13 13.27 · Affects: s10, s11, s13, sim/bots · Dup: —

**S10-10. §10 hooks unregistered** (§10 10.17; §12 12.3)
Decision: Adopt. Register `market.localBuyerDiscountAdd` (owner §10, `consumerPhase` 1, add, neutral 0, bounds [−0.05, +0.15], scope district and claim; unscoped = company). Register `market.theftHazardMult`, `market.shippingCostMult`, `market.refineryTransitWeeksAdd` and `market.localBuyerCapMult` with `consumerPhase` 5. Add the rows to 10.17 and 12.3.
Class: integrator · Owning: §12 12.3; §10 10.17 · Affects: Wave 0, s10 · Dup: s12-events#5 (§10 part)

**S10-11. Reputation thresholds hard-coded** (§10 10.10, 10.19)
Decision: Adopt. Add `market.localBuyer.repHighMin` (70) and `market.localBuyer.repLowMax` (30).
Class: integrator · Owning: §10 10.19 · Affects: s10 · Dup: —

**S10-12. Lots on a claim no longer held** (§10 10.9; §5 5.14)
Decision: Adopt. Lots stay `camp` at the former claim and remain sellable to that district's buyer at the claim's access class; P5 theft treats that camp as unstaffed. Document this in 10.9 and test a sale after a lease surrender and after a quick sale.
Class: integrator · Owning: §10 10.9 · Affects: s05, s10 · Dup: rel s05-land#13, s07-ops#13

**S10-13. Production counter unit** (§7 7.10; §10 10.21; §1 1.12; §11 11.19.5)
Decision: Follow s01-structure#21. This file's position: §1's counter = gross recovered estimated fine oz (weighed raw × the lot's f_est, in-kind deliveries included), fed by §7 and §4 at every cleanup and sample weighing; it is the same base as §11's cost-per-ounce denominator. Reword 10.21's test 13. §10 also exposes the estimated fine oz of lots created.
Class: integrator · Owning: §1 1.12 · Affects: s01, s04, s07, s10, s11 · Dup: s01-structure#21 (also s02-architecture#19)

**S10-14. sellAllAtCleanup scope; buyer draw layout** (§10 10.10, 10.14; §13 13.9)
Decision: Modify. `sellAllAtCleanup` sells only lots created this week (cleanup and sample). `rng(seed,'market-buyers',districtId)` takes, in fixed order: u_count (second buyer, P5), u_basis (its basis, P5), buyer 1 biasMean, buyer 1 name, buyer 2 biasMean, buyer 2 name. All are taken in P1 even when unused, on the registered key, so no new key shape is needed (rejecting the `(districtId, 2)` key).
Class: integrator · Owning: §10 10.10, 10.14 · Affects: s10, s13 · Dup: —

**S10-15. Ripple API phase** (§10 10.8, 10.18; §3, §5, §4, §9)
Decision: Adopt. Ship `ripple`, `rippleRate`, `rippleTwoSided`, `rippleAdd`, `momentumTilt`, `rippleDomain` and the `goldIdx*At` / `goldMomentumAt` accessors in P1 on the flat index (1, momentum 0). §3, §5, §8 and §9 call the final API now and get base values; P5 swaps only the index source. Test 10.8's examples on the pure core with an injected index.
Class: integrator · Owning: §10 10.18 · Affects: s03, s05, s08, s09, s10 · Dup: —

**S10-16. Type names vs code** (§10; core/ids.ts)
Decision: Adopt. Keep the code names (`LocalBuyerId`, `CourierMoveId`, `ForwardId`) and align DESIGN 10.10, 10.14, 10.15 and 10.17.
Class: integrator · Owning: §10 · Affects: docs · Dup: —

**S10-17. Lot selections across districts** (§10 10.14, 10.15; §13 13.11)
Decision: Adopt.
- `quoteChannels` returns one local column per distinct district buyer among the selected lots.
- `gold/sellLocal` requires every lot to be in the buyer's district (`BUYER_NOT_IN_DISTRICT`).
- Under `bestLocal`, a standing order sells each lot to its own district's buyer; a named buyer applies to its district's lots only.
Class: integrator · Owning: §10 10.14, 10.15 · Affects: s10, s13 · Dup: —

---

## s11-finance (25)

**S11-1. "P1 P&L absorption"** (§11 11.24, D-11.7; BALANCE §5.6)
Decision: Adopt. The area brief's wording is wrong: P1's P&L is costs as incurred, revenue at sale, with gold shown at market as a memo. In P1, `GoldLot.costBasisCents` = 0 and nothing posts to `inv.gold`. Absorption, cost pools, lot basis and LCNRV ship in P4 behind `rulesAtLeast(4)`.
Class: integrator · Owning: §11 11.24 · Affects: s10, s11 · Dup: —

**S11-2. dueThisWeek under-sells** — Same issue and ruling as S10-2.
Class: integrator · Owning: §11 11.23 · Affects: s10, s11 · Dup: s10-gold#2

**S11-3. Liens in P1** (§11 11.16, 11.7; §5 5.18; §9 9.11)
Decision: Adopt. P1 records `Loan.collateral` for display only: no `Lien` records, `lienPayoff` or `LIEN_SHORTFALL` until P4. The estate note stays outstanding after an asset sale. Fix 11.16's P1 lever row ("liens paid at closing") and §9's `fleet/sell` phase cell in the same change.
Class: integrator · Owning: §11 11.16, 11.24 · Affects: s05, s09, s11 · Dup: —

**S11-4. Fixed-loan terms in prose** (§11 11.7, 11.25; §1 1.7, 1.8.2, 1.20)
Decision: Adopt.
- `game.inheritor.noteUsd` 320,000, `noteRate` 0.085, `noteTermMonths` 84, `notePayMonths` [6..11], `fuelApUsd` 12,000, `fuelApDueWeek` 4 (§1 1.20, `game.ts`).
- `finance.p1BankerLoanUsd` 150,000, `p1BankerLoanSpread` 0.020 over prime, `p1BankerLoanTermMonths` 60 (11.25, `finance.ts`).
- Prime = `market.openingBaseRate` + `finance.primeSpread` = 7.0%, so the banker loan is at 9.0%.
Class: integrator · Owning: §1 1.20; §11 11.25 · Affects: s01, s11 · Dup: rel s01-structure#3, s03-world#16

**S11-5. Interest on skipped months** (§11 11.7, 11.27)
Decision: Adopt.
- At each month end with no payment or a short one, unpaid accrued interest is capitalized (Dr `accrued.interest` / Cr `debt.<loan>`), and the next month's interest is computed on that balance, matching the B_k recursion.
- The final payment absorbs the rounding residue, so B_n = 0 within 1¢.
- The last-week-takes-the-remainder rule keeps a full January accrual for a turn-0 funding.
Class: integrator · Owning: §11 11.7 · Affects: s11 · Dup: —

**S11-6. Undefined finance types** (§11 11.1, 11.4, 11.23)
Decision: Adopt, with `PayeeRef.kind` also including `buyer` and `insurer`. Define:
- `PayeeRef { kind; id?; name }`
- `NewBill { payee, category, amountCents, dueTurn, allowPartial, accrual: PostingLine[] | null, payable account, loanId?, obligationId?, refs, memo, source }`
- `PaymentEvent { turn, kind, category, billId, shortCents }`
- `LedgerPage { rows, summaries, total, netCents }`

Loan-payment bills carry no accrual: they split fees → interest → principal at settlement.
Class: integrator · Owning: §11 11.1, 11.4 · Affects: Wave 0, s11, all billers · Dup: —

**S11-7. Ledger transaction volume** (§11 11.4, D-11.47)
Decision: Adopt. `billBatch(state, source, bills[])` posts one accrual transaction per source per week (lines by account × dims), and each Bill references it. Settlement stays one transaction per week.
Class: integrator · Owning: §11 11.4 · Affects: s07, s08, s09, s11 · Dup: —

**S11-8. Owner items and the P1 counter** (§11 11.4, 11.16)
Decision: Adopt.
- Owner-category bills (scheduled draws, pass-through salary) and the corp owner's salary line are deferred or cancelled when unfunded. They never create arrears and never open the P1 counter.
- The owner's net-wage shortfall is excluded from the `payroll.missed` test.
Class: integrator · Owning: §11 11.4, 11.16 · Affects: s01, s08, s11 · Dup: s01-structure#15

**S11-9. P1 counter timing** (§11 11.16; §2 2.12.1; BALANCE §5.1)
Decision: Adopt.
- `openSinceTurn` = t0, the first step 15 with an open arrear.
- The company is liquidated in step 15 of turn t0 + grace if any arrear remains; the player can act at turns t0 … t0 + grace − 1.
- `weeksOpen` = turn − t0 + 1; `distressStatus` and the bots read it (the bots' last resort fires at weeksOpen = grace − 1).
- Add a fixture per difficulty (8 / 6 / 4).
Class: integrator · Owning: §11 11.16 · Affects: s11, sim/bots, s13 (health tile deadline) · Dup: rel s02-architecture#18

**S11-10. Net worth of a liquidated P1 run** (§11 11.16, 11.20; BALANCE §5.3)
Decision: Adopt. Once `distress.liquidation.cause` = `p1Counter`, `netWorth('scoring')` = own.cash − own.personalDebt − own.guaranteeDue − own.taxDue; companyNW and own.loanToCompany count 0. No settlement postings in P1. This follows §1.14 and BALANCE §5.3.
Class: integrator · Owning: §11 11.20 · Affects: s01, s11, sim/metrics · Dup: rel s01-structure#13

**S11-11. Opening books by start** (§1 1.8, 1.8.2, 1.22)
Decision: Adopt.
- **Inheritor:** `ppe.equipment` at §9 `resaleEstimate` at newGame (stepped-up basis, accumDep 0), `mineral.properties` $120,000, `debt.<estateNote>` $320,000, an open $12k fuel bill (`ap.vendors`, due turn 3 = week 4), and the equity plug to `eq.ownerCapital`.
- **Backed equity:** Cr `eq.ownerCapital` and `eq.investor` at §1 1.8's amounts.
- **Backed royalty:** Cr `deferred.revenue.<ivr>`.
- **Banker:** Dr cash / Cr `debt.<fixedP1>`.
Class: integrator · Owning: §1 1.8; §11 11.24 · Affects: s01, s09, s11 · Dup: s01-structure#18

**S11-12. Formation fee vs start NW** (§1 1.6, 1.22; BALANCE T-16)
Decision: Adopt. The formation fee is billed in step 14c of turn 1 (`exp.ga`, `vendor.other`), so the turn-0 balance sheet equals §1.8 ($520k Bootstrapper LLC). NW ratios use the turn-0 NW. Record the rule in §1 1.6.
Class: integrator · Owning: §1 1.6 · Affects: s01, s11, sim/metrics · Dup: s01-structure#2

**S11-13. Royalty top-up and AMR accounting** (§1 1.8.1; §5 5.7, 5.12; §11 11.2)
Decision: Adopt.
- **Top-up:** Dr `deferred.revenue.<ivr>` up to its remaining balance; any excess Dr `exp.royaltyCash` / Cr cash (a `royalty.cash` bill).
- **AMR paid:** Dr `prepaid` if recoupable, else `exp.royaltyCash`.
- **Recoup at cleanup:** Dr `exp.royaltyCash` / Cr `prepaid` at the spot value of the offset ounces from §5's settlement.
- **Forfeit on surrender or termination:** the same entry, memo "forfeited".
Class: integrator · Owning: §11 11.2; §5 5.7 · Affects: s01, s05, s11 · Dup: rel s05-land#2, s01-structure#25

**S11-14. P1 forecast outflows** (§11 11.19.6, D-11.49)
Decision: Adopt; amends D-11.49 (new D-11.n). P1 outflows:
- §7 `projectOpsVisible` cost lines, and §9 flat maintenance on projected SMR, × open(w) from §1's phase outlook;
- §8 `payrollProjection` (0 when laid off);
- owner draws, entity fees, loan dues and open bills.

Update the P1–P3 paragraph.
Class: integrator · Owning: §11 11.19.6 · Affects: s07, s08, s09, s11, s13 · Dup: rel s08-staff#22, s13-ui#2

**S11-15. Cost-per-ounce history fields** (§11 11.19.5; §1 1.14; §2 2.5)
Decision: Adopt.
- `CompanySnapshot.byClaim` gains `grossFineOz`, `inKindFineOz` and `inKindValueCents` (from step 12).
- `YearRollup` gains `grossFineOz`, `cashCostCents`, `aiscCents` (from `costPerOunce` at week 52) and `byClaim.payWashedBcy` (for S11-16's G&A allocation).
- Coordinate with the §2 history package.
Class: integrator · Owning: §2 2.5; §11 11.19.5 · Affects: s02, s11, s13 (end report) · Dup: s01-structure#20 (and #21)

**S11-16. Per-claim allocation survives compaction** (§11 11.19.4, 11.1)
Decision: Adopt.
- Month-end depreciation posts one line per machine × claim, split by the month's machine hours from §9's weekly logs. Zero-hour months go to the claim where the machine sits; machines on no claim post to `site` with no claimId.
- G&A allocation by `payWashedBcy` share stays a query-time rule; older periods read `YearRollup.byClaim` (S11-15).
Class: integrator · Owning: §11 11.19.4 · Affects: s09, s11 · Dup: —

**S11-17. DISTRESS_BLOCKED in P1** (§1 1.16; §11 11.5, 11.24)
Decision: Modify.
- Ship 11.5's stub stage in P1: 3 = a payroll arrear, 2 = a loan arrear, 1 = any other arrear, else 0. §13's health tile and, later, §12 read this one selector.
- `owner/draw` and salary increases fail with `DISTRESS_BLOCKED` at stub stage ≥ 3 and also whenever the P1 counter is open. This closes the drain-then-liquidate exploit, since liquidation keeps personal cash. P4's clawback replaces the second condition.
Class: integrator · Owning: §11 11.5; §1 1.9 · Affects: s01, s11, s13 · Dup: s01-structure#13

**S11-18. Obligation paid twice** (§6 6.15; §11 11.4)
Decision: Adopt. When an obligation has a §11 bill (`obligationsByBill`), §6's pay action pays that bill (`finance/payBill` semantics). Only an unbilled obligation is paid directly, and §11 then skips billing it.
Class: integrator · Owning: §11 11.4; §6 6.15 · Affects: s05 (obligation store), s11 · Dup: rel s05-land#3

**S11-19. queryLedger in the engine** (§11 11.1, OQ-11.3; §13 13.11, D-13.79)
Decision: Adopt.
- §11's `queryLedger(state, filter, page)` is paged and returns "Monthly summary" rows.
- `LedgerFilter`: book, accounts, fromTurn, toTurn, claimId, costCenter, minCents, maxCents, text, ref, txnIds.
- OQ-11.3 is closed: txnIds adopted.
- The UI deletes `src/ui/explain/ledger.ts` and points `LedgerView` and the source chips at §11's function.
Class: integrator · Owning: §11 11.1, 11.29 · Affects: s11, s13 · Dup: — (s13-ui#7 is a duplicate of this)

**S11-20. Net-30 in §4's cost table** (§4; §11 11.24)
Decision: Adopt. In P1 every section bills with dueTurn = issuedTurn; net terms arrive with vendor accounts in P4. Note it in §4's cost table.
Class: integrator · Owning: §11 11.24; §4 4.12 · Affects: s04, s11 · Dup: —

**S11-21. Outsourced bookkeeping fee** (§11 11.22h, 11.24)
Decision: Adopt. The $900/month fee starts in P4, with the bookkeeper and controller. P1 G&A is entity fees, sponsorship and office wages only.
Class: integrator · Owning: §11 11.24 · Affects: s11 · Dup: —

**S11-22. Owner-loan interest** (§1 1.9, 1.16, 1.20)
Decision: Adopt. Loan-form injections are allowed in P1 with no interest accrual until P4, which brings `owner/repayLoan` and the subordination rules. Note it in 1.9.
Class: integrator · Owning: §1 1.9 · Affects: s01, s11 · Dup: s01-structure#14

**S11-23. Forecast cost** (§2 2.13; BALANCE O-13; §11 11.19.6)
Decision: Adopt.
- Memoize `forecast13Week` in `memo.ts`, keyed on turn plus the identities of the slices it reads (Immer structural sharing makes these exact).
- Compute it once per week in step 16 for `cash.projectedNegative`.
- Cache statement aggregations per (period, ledger slice identity).
- Measure in `test:perf` once §7 lands.
Class: integrator · Owning: §11 11.19.6 · Affects: s11, perf · Dup: rel s13-ui#20

**S11-24. Settlement when funds run short** (§11 11.4)
Decision: Modify.
- Bills are paid in priority order. The boundary bill is paid partially if `allowPartial` (`payroll.net` pro rata within the category), and every later bill then fails.
- A non-partial bill that cannot be fully funded fails, and the walk continues to the next bill with the remaining funds, so cash is never stranded.
- In P1 every pipeline bill is `allowPartial: true`.
Class: integrator · Owning: §11 11.4 · Affects: s11 · Dup: —

**S11-25. Loan obligations horizon** (§11 11.4)
Decision: Adopt. Each loan keeps obligations for its next 6 scheduled non-zero payments, refreshed in 14c (skipped seasonal months are not counted).
Class: integrator · Owning: §11 11.4 · Affects: s11, s13 (calendar) · Dup: —

---

## s12-events (16)

**S12-1. Edge messages never expire** (§13 13.10; T26)
Decision: Adopt, plus a check.
- Retention drops any message with no open decision and lastTurn < turn − `game.alerts.inboxRetentionWeeks` (104), unless it is an open level message. The UI's archived flag stays presentation only.
- T26 is measured on the year-10 fixture early. If the inbox exceeds 0.3 MB, add `game.alerts.infoEdgeRetentionWeeks` (26) for info edge messages before touching the budget.
- Record a §13 decision.
Class: integrator · Owning: §13 13.10 · Affects: inbox package, s13 · Dup: —

**S12-2. Decision ↔ message link** (§13 13.10; §2 2.2)
Decision: Adopt.
- `AlertSignal` gains `decisionId?`. The owner emits one signal (its own kind, e.g. `staff.recallDecision`) with every decision it creates.
- Collation copies the decisionId and sets severity `blocking` for a blocking decision.
- `decision/answer` sets the message to `answered` at action time; collation sets `defaulted` at step 16.
- Test: every decision has exactly one message.
Class: integrator · Owning: §13 13.10; §2 2.2 · Affects: Wave 0, inbox, every decision owner · Dup: rel s08-staff#14

**S12-3. Action-time collation** (§13 13.10; §2 2.2)
Decision: Adopt. `collateAlerts(state, signals, turn, mode)`:
- `'action'` mode does grouping, sort, dedupe, level update or reopen, edge create and id assignment, with no auto-resolve sweep, no retention and no stop candidates.
- `'week'` mode (step 16) does everything.
Class: integrator · Owning: §13 13.10, 13.23 · Affects: inbox, s02 · Dup: —

**S12-4. §12 P1 scope** (§12 12.21)
Decision: Modify.
- **P1 builds:** the full `EventsSlice` shape (every director, cooldown, budget and mercy field at neutral values, so P3 and P5 need no migration); `EventDef`/instance types; the hook registry and `effective()`; rolling (probability × frequency mult, severity, magnitudes); the director's base path; and applying effects to modifiers and alerts.
- **Wiring and tests:** wired into step 4 and inert on the shipped empty catalog; tested on fixture `EventDef`s held in test files.
- **Later phases:** the director rule groups 12.21 phases later (cooldowns, grace and weekly cap in P3; budget and mercy in P5) ship then, behind `rulesAtLeast`. So do one-shot dispatch, `event/respond` and preps (P3+).
Class: integrator · Owning: §12 12.21 · Affects: s12 package, Wave 0 (slice) · Dup: —

**S12-5. Hook lists disagree** (§12 12.3 vs §3–§10, §14)
Decision: Modify.
- **Registry content:** the union of every owner's published hooks. Neutral 1 for `*Mult`, 0 for `*Add`; ops from the name; scope dims from the reading formula (at least district and claim for site values; machine, model and brand for fleet values). Each row gets `consumerPhase` and `base` (S12-14).
- **DESIGN:** add the missing rows to 12.3 in the same commit.
- **Test:** each owner exports its hook keys from its system folder, and a registry test checks the union against them, alongside the lint rule on raw hook reads. This replaces the proposed DESIGN-parsing test.
- **Specific rows:** S08-1 (staff) and S10-10 (market).
Class: integrator · Owning: §12 12.3 · Affects: Wave 0 (registry), every system package · Dup: s02-architecture#12, s07-ops#14 (ops part); s08-staff#1 and s10-gold#10 point here

**S12-6. "Event hooks live in P5"** (§7 7.20, §8 8.17, §9 9.14 vs D-12.7)
Decision: Adopt. "Live" means the writers arrive. Every hook is registered in P1 with a `consumerPhase`; every P1 consumer reads through `effective()` now, and later consumers do so when they ship. The lint rule enforces this from P1. Fix the three phase-plan wordings.
Class: integrator · Owning: §12 12.21; D-12.7 · Affects: s07, s08, s09 · Dup: —

**S12-7. Non-effective() notations; missing queries** (§3, §7, §9, §10; §12 12.3)
Decision: Adopt. Every such read is `effective(state, key, q)` with the shared query builders (`qDistrict`, `qClaim` → `{ districtId, claimId }`, `qMachine` → `{ districtId, claimId, machineId, modelId, brandId }`, `qEmployee`). A read-coverage test drives each P1 consumer under a scoped fixture modifier. Normalize the notation in those sections in the same change.
Class: integrator · Owning: §12 12.3 · Affects: Wave 0 (builders in `systems/events`), s03, s07, s09, s10 · Dup: —

**S12-8. season.phaseChange double stop** (§13 13.9, 13.10; §1)
Decision: Adopt. `season.phaseChange` becomes info (an inbox record), and the editable `seasonPhase` stop rule is its only stop path. This changes one taxonomy cell.
Class: integrator · Owning: §13 13.10 · Affects: s01, s13, inbox · Dup: rel s02-architecture#17

**S12-9. Obligation alerts in P1** (§6 6.16, 6.18; §13 13.4, 13.10, 13.24)
Decision: Adopt.
- §6's sub-step j obligation alerts run in P1. They cap at info, because every P1 obligation is billable (`needsAction` false).
- Signals carry params `{ category, dueTurn, amountUsd }` and subject [obligation ref].
- Misses: §6 emits `obligation.missed` for §6, §5 and §1 items; §11 emits only its own kinds (`loan.paymentMissed`, `payroll.missed`) for its obligations. No double alert.
Class: integrator · Owning: §6 6.16; §13 13.10 · Affects: obligation-store package, s11, inbox · Dup: rel s05-land#1, s13-ui#13

**S12-10. Flapping level alerts** (§13 13.10; BALANCE O-13)
Decision: Adopt. Keep the collation rule (T3 depends on it). The P1 sim reports stops by kind. Where a kind flaps, the emitter adds hysteresis under its owner's tuning keys (raise at the threshold, clear at e.g. 0.8 × threshold). Collation is not loosened.
Class: integrator · Owning: §13 13.10 (rule); owners' tuning · Affects: s07, s11, balance loop · Dup: rel s02-architecture#17

**S12-11. Stale message subject; no stored action** (§13 13.10)
Decision: Adopt. On every re-emit, collation copies `subject`, `action` and `explain` from the latest signal, as it already copies params and dueTurn. `InboxMessage` gains `action?` and `explain?`.
Class: integrator · Owning: §13 13.10 · Affects: Wave 0 (types), inbox · Dup: —

**S12-12. Template location; machine-readable taxonomy** (§13 13.10, T21; §2 2.10)
Decision: Adopt. Templates live in `data/text/alerts.ts` (keys `alert.<kind>[.<variant>]`; see S13-14). The engine table `systems/inbox/taxonomy.ts` lists owner, severity rule, trigger, phase and threshold keys per kind. T21 checks them against each other and against the emitters' kinds.
Class: integrator · Owning: §13 13.10 · Affects: inbox, UI foundation · Dup: s13-ui#14 (template part)

**S12-13. lease.anniversarySoon row** (§13 13.10)
Decision: Adopt. `lease.anniversarySoon` is info, level, within 4 weeks; `staking.windowSoon` is warning, level, within 3 weeks (P2). Fix the row's wording.
Class: integrator · Owning: §13 13.10 · Affects: s05, inbox · Dup: rel s05-land#20

**S12-14. HookDef.neutral for tuning-based hooks** (§12 12.3; §2 2.10)
Decision: Modify. `HookDef` gains `base: 'neutral' | 'tuning'`, an optional `baseKey` (set-only hooks such as `permits.noticeMaxAcresSet` → `permits.noticeMaxAcres`, P2), `consumerPhase`, ops and `scopeDims`. The existing `effective()` already falls back to `neutral` when the tuning key is absent, so no new fallback is needed. The schema test requires the tuning key (or `baseKey`) to exist once `consumerPhase` ≤ the build's phase.
Class: integrator · Owning: §12 12.3 · Affects: Wave 0 (registry schema) · Dup: —

**S12-15. T4 needs statutory obligations** (§13 13.27; §6 D-6.38)
Decision: Same ruling as S13-13. In P1, T4 runs on synthetic statutory and billable obligations created through §6's `createObligation`; it re-runs on §6's real obligations in P2.
Class: integrator · Owning: §13 13.27 · Affects: inbox, obligation store · Dup: s13-ui#13

**S12-16. Morale alert keys** (§13 13.25; §8 8.15)
Decision: Adopt. `game.alerts.moraleWarnAvg` (40) and `moraleWarnKey` (30) stay §13 keys, and §8 reads them. Note it in §8's Consumes.
Class: integrator · Owning: §13 13.25; §8 8.16 · Affects: s08 · Dup: rel s08-staff#20

---

## s13-ui (22)

**S13-1. Editable stop rules needed in P1** (§13 13.21, 13.24, 13.9; §1 1.15)
Decision: Adopt. `ui/setStopRules` ships in P1 limited to the built-in rules' fields: `seasonPhase` enabled, `everyCleanup` claimIds and enabled, `cashBelow` cents and enabled. Deadline-within N stays fixed at 2, with no muting. Error `RULE_INVALID`. 13.21's phase cell becomes "P1 (built-in) / P2 (custom, N, muting)".
Class: integrator · Owning: §13 13.21 · Affects: s13 · Dup: —

**S13-2. firstShort needs §11's priority walk** (§13 13.9; §11 11.4, 11.19.6)
Decision: Modify. §11 publishes `fundingPreview(state, { extraFundsCents? })` → `{ needCents, fundCents, autoGoldCents, shortfallCents, firstShort: { category, shortCents, consequenceKey } | null }`. It computes the standing-order gold itself: the P10 cleanup inflow, plus held gold at `netSalePerFineOz` under `keepCashAbove` (S10-9). The UI only formats and shows the actual-quote cell.
Class: integrator · Owning: §11 11.23; §13 13.9 · Affects: s10, s11, s13 · Dup: rel s11-finance#14

**S13-3. No warnings channel** (actions/types.ts; §8 8.12; §9 9.5; §13 13.7)
Decision: Follow s07-ops#3. This file's position: `validateAction` and a successful `ActionResult` return `{ ok: true; warnings?: ActionWarning[] }`, with warning codes registered like error codes. Warnings in P1: `SMALL_CREW_ENDS`, `CAMP_FULL`, `TRANSPORT_WINDOW_RISK`, `TRANSPORT_UNFUNDED`, and the plan-in-use notice on sell and move. §7's plan warnings stay in `projectOpsVisible`'s result. This lands in Wave 0, before the UI packages.
Class: integrator · Owning: §2 2.2 · Affects: Wave 0, s07, s08, s09, s13 · Dup: s07-ops#3

**S13-4. Wizard start position** (§13 13.14; §1 1.8, 1.18)
Decision: Adopt. §1 exports a pure `previewStart(setup, overrides?)` → `StartPreview` (no world generation; resolved tuning; §9 `resaleEstimate` of the inherited fleet spec at turn 0), with `explain.startPreview`, through `engine/index.ts`. `sim/metrics/startNetWorth` uses the same function, which settles the sim's start-NW source.
Class: integrator · Owning: §1 1.18 · Affects: s01, s09, s13, sim/metrics · Dup: rel s01-structure#19, s02-architecture#15

**S13-5. Closed ExplainerName union** (§2 2.8; explain/types.ts; ui/explain/resolve.ts)
Decision: Adopt.
- Engine `explain` is a typed registry composed from per-owner explainer files (each package adds its own file; `explain/index.ts` only spreads them).
- `ExplainerName = keyof typeof explain`.
- The UI calls `explain[name](state, ...args)` generically.
- A registry test covers every explainer.
Class: integrator · Owning: §2 2.8 · Affects: Wave 0, all owners, s13 · Dup: rel s02-architecture#11, s04-prospecting#23

**S13-6. Report calc key convention** (§13 13.13; §2 2.2)
Decision: Adopt.
- Keys follow `<systemFolder>/<metric>/<entityId>[/<lineId>]`, e.g. `ops/directCostPerBcy/clm_000012/L1`.
- Each owner exports key builders, and the UI builds refs only through them.
- Test: every report ref the UI builds on the mid-game fixture resolves.
Class: integrator · Owning: §2 2.8 · Affects: Wave 0, s07, s08, s11, s13 · Dup: —

**S13-7. Ledger query in the UI** — Same ruling as S11-19.
Class: integrator · Owning: §11 11.1 · Affects: s11, s13 · Dup: s11-finance#19

**S13-8. HISTORY_METRICS in the UI** (§2 2.5, D-2.54)
Decision: Adopt. §2 publishes `HISTORY_METRIC_INFO` beside `HistorySlice` in P1, including S11-15's new fields. The UI imports it and removes its own table in the same change.
Class: integrator · Owning: §2 2.5 · Affects: s02, s13 · Dup: —

**S13-9. Previews without owner selectors** (§13 13.5; §3, §4, §5)
Decision: Adopt.
- §4 `previewProgram(state, draft)`, §3 `siteVisitQuote(state, claimId, ownerTime?)` and §5 `valuationView(state, claimId)` (max price at the target return at P50, seller-implied $/oz, sale vs lease PV at P10/P50/P90, walk-away loss), each with an explainer.
- `previewOffer` gains `forecastAfterClose`, computed by §11 `forecast13Week(state, { hypothetical: { cashDeltaCents, obligations } })`.
- No dry-run `applyAction` in the UI.
Class: integrator · Owning: §3 3.14, §4 4.18, §5 5.17, §11 11.23 · Affects: s03, s04, s05, s11, s13 · Dup: —

**S13-10. P1 save fixtures for UI tests** (§13 13.27 T8, T9, T13, T26)
Decision: Adopt.
- Generator scripts `tests/fixtures/make-p1-midgame.ts` (arid, with production, lots, decisions and messages) and `make-p1-year10.ts` (two claims) are driven by the P1 `cautious` bot on fixed seeds. Their `.gmt.json.gz` outputs are committed and regenerated only together with goldens.
- e2e loads them through the Saves import chooser.
- Scheduled after the bots package.
Class: integrator · Owning: §13 13.27 · Affects: tests, sim/bots, s13 · Dup: rel s02-architecture#2

**S13-11. Tutorial memory** (§13 13.14, 13.18, D-13.23)
Decision: Adopt.
- Only the active step is evaluated, on each route or state change, and completion latches; step order supplies "afterwards".
- `UiPersisted.tutorial.anchors: Record<stepId, { turn; planRev?; fleetIds? }>` is captured at completion; step 11 compares against step 10's anchor.
- Bump `UI_PERSISTED_VERSION` 2 → 3 with a `readUiPersisted` migration.
- `tutorial.enabled` is initialized from `setup.tutorial` at `ui/newGame`; UiPersisted is authoritative afterwards.
Class: integrator · Owning: §13 13.14, 13.18 · Affects: s13 · Dup: —

**S13-12. Scramblers and retained reports** (§13 T8, T23; §2 2.14)
Decision: Adopt.
- Each P1 owner registers its state scrambler: §1 season drivers and unrevealed dates, §3 seller honesty, §10 true fineness, buyer bias and error, §8 truth (S08-26).
- Add `scrambleReportHidden` for the truth fields of retained `WeekReport`s and their hidden calc nodes.
- T8 runs on S/S′ with retained reports that are identical except for scrambled hidden fields.
- §9 has no P1 scrambler (S09-20).
Class: integrator · Owning: §2 2.14; §13 13.27 · Affects: s01, s03, s08, s10, sim/bots, s13 · Dup: rel s08-staff#26, s09-fleet#20, s01-structure#27

**S13-13. Who owns T3–T5; obligation grouping phase** (§13 13.27, 13.24, D-13.46)
Decision: Adopt.
- P1's engine inbox package builds the full collation: ladder, grouping by (category, due week), the self-settling info cap, and `Pay all` targets.
- It owns T3, T4 (on synthetic statutory and billable obligations created through §6's `createObligation` test helper) and T5's P1 clauses. T4 and T5 re-run on §6's real obligations in P2.
- The UI package owns only the rendering.
- Amend 13.24: grouping is P1; P2 keeps what needs §6's statutory obligations.
Class: integrator · Owning: §13 13.24, 13.27 · Affects: inbox package, obligation store, s13 · Dup: — (s12-events#15 is a duplicate of this)

**S13-14. Text catalogs** (§13 13.10, 13.19, T21; §2 2.10)
Decision: Adopt. The UI foundation package creates:
- `data/text/alerts.ts` (`templateKey` → `{ title, body, groupTitle? }` with `{param}` placeholders);
- `data/text/decisions.ts`, `data/text/glossary.ts`, `data/text/tutorial.ts`;
- zod schemas in `tests/data/schemas.ts` and the T21 cross-check.

Owners use `templateKey` = kind unless they need a variant.
Class: integrator · Owning: §13 13.10; §2 2.10 · Affects: UI foundation, all emitters · Dup: — (s12-events#12 overlaps)

**S13-15. Welcome and estate letters** (§1 1.15; §13 13.14, 13.10)
Decision: Adopt. In P1 the letters are the coach's start-specific step-1 body plus a Profile panel on Company & owner (`data/text/tutorial.ts`), with no inbox kind. `newGame` runs no collation, so no turn-0 signal is needed.
Class: integrator · Owning: §13 13.14; §1 1.15 · Affects: s01, s13 · Dup: s01-structure#11

**S13-16. Export log after reload** (§13 13.14, 13.16, D-13.75)
Decision: Adopt.
- When `runStatus` leaves `active` during a session, the client writes a manual "End of run" slot carrying the action log before routing to `#/end`. This is allowed in Ironman because the run is over.
- A loaded save without a log shows the export button `aria-disabled` with the reason.
Class: integrator · Owning: §13 13.16 · Affects: s13, persistence · Dup: —

**S13-17. Command palette** (§13 13.1, 13.15, T24)
Decision: Adopt. A minimal Ctrl+K palette ships in P1: screens, entities by name or id, and verbs that navigate to the owning screen. It never dispatches engine actions. T24 checks it.
Class: integrator · Owning: §13 13.24 · Affects: s13 · Dup: —

**S13-18. Machine "assign" action** (§13 13.7; §9 9.11; §7)
Decision: Adopt. Machine detail's Assign opens the claim's plan editor with the machine card selected, or offers `fleet/move` when the machine is elsewhere. Amend 13.7 to name `ops/setMinePlan` and `fleet/move`.
Class: integrator · Owning: §13 13.7 · Affects: s13 · Dup: —

**S13-19. useSel memoizes on the whole state** (§13 13.18, T13)
Decision: Adopt. The foundation package implements useSel's declared-deps form (`deps: s => [s.finance, s.clock]`) for heavy selectors and measures the dashboard on the year-10 fixture early. It relies on engine `memo.ts` where owners already cache (S11-23).
Class: integrator · Owning: §13 13.18 · Affects: s13 · Dup: —

**S13-20. Main-thread week budget** (§2 2.13; §13 13.18, T13)
Decision: Adopt.
- T13's main-thread-week check joins `test:perf` as soon as §7 and §4 land on the P1 fixture.
- If the week is over budget, compute §7's hints only for claims with an operating week this turn.
- The estimator's incremental production path is mandatory (s04).
Class: integrator · Owning: §2 2.13 · Affects: s04, s07, s13, perf · Dup: s02-architecture#20, s04-prospecting#2

**S13-21. Overlapping claim routes** (§13 13.1)
Decision: Adopt. The second segment parses as a claim id when it matches the registered `clm_` prefix, else as a tab. Claim detail resolves the open listing from the claim id through §5 and shows Offer only when a listing exists.
Class: integrator · Owning: §13 13.1 · Affects: s13 · Dup: —

**S13-22. Disclaimer phase** (§13 13.14 step 7, 13.24, D-13.67)
Decision: Adopt. The disclaimer stays in P2, as 13.24 says. In P1 the World step shows the jurisdiction labels only. Mark 13.14 step 7's note "(from P2)".
Class: integrator · Owning: §13 13.14 · Affects: s13 · Dup: —

---

## Owner questions

None. No ruling in s08–s13 changes save compatibility without a migration path, pipeline steps or their order, RNG stream names or registered key shapes, money or gold units, a scenario's win condition, a BALANCE band, or the brief's intent. Three choices were made specifically to stay out of owner territory:
- S10-14 uses the registered `market-buyers (districtId)` key instead of a new `(districtId, 2)` key.
- S08-8 uses the registered `(turn, districtId)` shape with turn 0.
- S10-2 passes the step context to `dueThisWeek` instead of moving §7's billing out of 14c.

**Integrator calls to flag in the P1 phase report** (they change BALANCE text, not bands):
- S08-21: fixture staff-noise overrides and cooks in the bots' crew rule.
- S09-1: `matureNorth` under P1 rules.
- S09-19: T-09 (c) evaluation point.
- S09-24: mid fleet tier.
- S11-10: score of a liquidated P1 run.
- S12-8: `season.phaseChange` demoted to info, which affects O-13.

## Cross-area conflicts (resolved)

| # | Interface | Section A says | Section B says | Resolution |
|---|---|---|---|---|
| 1 | Estimated alloy fineness | §10 10.9 / 10.18: district prior until a refinery assay | §5 5.12, §4 4.7: §4 finenessP50 with P1 sample assays | §10 `claimFineness.alloy` = §4 finenessP50 in P1–P4 (S10-1) |
| 2 | `dueThisWeek` vs standing orders | §11 11.23: open bills + estimated payroll + loan dues | §10 10.14 runs in step 12, before §7 cost lines are billed in 14c (§2.6) | `dueThisWeek(state, pending)` takes this week's unbilled costs from `ctx.week` (S10-2, S09-16) |
| 3 | Lien payoff in P1 | §11 11.16 P1 levers; §9 `fleet/sell` P1 `LIEN_SHORTFALL` | §5 5.18 and §11 11.24: liens in P4 | P4; P1 collateral is display only (S11-3) |
| 4 | `crew.noForeman` emitter | §7 7.18 step 16 | §8 8.15; §13 "whichever" | §8 only (S08-20) |
| 5 | Hook registry | §12 12.3 table | owners' hook lists (§4, §5, §6, §7, §8, §9, §10, §14) | Union, with `consumerPhase` and `base`; code-level registry test (S12-5, S12-14) |
| 6 | Event-hook phase | §7, §8, §9 phase plans: "hooks live P5" | D-12.7: read through `effective()` from P1 | Registered and read in P1; writers arrive later (S12-6) |
| 7 | Ripples in P1 | §10 10.18: return base; §4, §9: "no ripples" | §3 3.11 and §5 call ripple in P1 | Final pure API on a flat index in P1 (S10-15) |
| 8 | `ACCESS_CLOSED` | §9 9.5: any closed scheduled week | §9 9.11/9.17 and §1 1.4.5: closed for the rest of the year | §1 1.4.5 for buy and move; scheduled closed/uncertain = warning (S09-10) |
| 9 | P1 machine rate | §9 9.14: spec × grade × skill | §9 9.7.2, §7 7.6: includes cold C and events E | Include C and E (S09-7) |
| 10 | Owner salary line | §11 11.3: owner `PayrollLine` from §8 | §8: emits no owner line | §8 emits the corp owner line; P1 skips WC on it (S08-18) |
| 11 | `ownerSkill` | §1 1.18 provides it | §8 8.16 provides it | `staff/owner.ts`, re-exported by §1 (S08-19) |
| 12 | Ledger query | UI `ui/explain/ledger.ts` | §11 `queryLedger` | §11, paged, with txnIds; UI copy deleted (S11-19) |
| 13 | Stop-rule editing | §13 13.21: P2 | §13 13.24, 13.9, 13.14 and §1 1.15 need it in P1 | P1 for built-in rules (S13-1) |
| 14 | Obligation grouping | §13 13.24 P1 (Inbox `Pay all`) | §13 13.24 P2 (ladder and grouping) | Engine collation complete in P1 (S13-13) |
| 15 | §6 disclaimer | §13 13.14 step 7 | §13 13.24: P2 | P2 (S13-22) |
| 16 | `season.phaseChange` | §13 13.10: warning alert | §13 13.9: separate `seasonPhase` stop rule | Alert is info; the rule is the only stop (S12-8) |
| 17 | Production counter | §7 7.10: gross weighed raw | §10 test 13: sample est fine net of in-kind; §1 1.12: fine oz | Gross recovered est fine oz incl. in-kind (S10-13, s01-structure#21) |
| 18 | Inheritor hand stream | §1 1.8.2: `s.hand` | §8 8.3: `staff-cand` | `addCandidate` takes a caller-supplied stream (S08-7) |
| 19 | Payroll arrears vs P1 counter | §11 11.16: any failed payment opens it | §11 11.4: owner category deferred without penalty | Owner items never open it (S11-8) |
| 20 | `DISTRESS_BLOCKED` | §1 1.16: P1 validation | §11 11.5: stage stub is P2 | Stub stage in P1, plus "counter open" (S11-17) |
| 21 | Vendor terms | §4 cost table: net 30 | §11 11.24: no vendor terms in P1 | Due the week issued in P1 (S11-20) |
| 22 | Morale alert thresholds | §13 13.25: `game.alerts.*` "§8 may own" | §8 8.15: quotes 40/30 | §13 keys, read by §8 (S12-16) |
| 23 | Non-blocking warnings | §8 `SMALL_CREW_ENDS`, §9 windows, §7 plan warnings | §2 2.2 `ValidationResult` has no warnings | `{ ok: true; warnings? }` in Wave 0 (S13-3, s07-ops#3) |
| 24 | Decision ↔ message | §2 2.2 `PendingDecision` | §13 13.10 `InboxMessage.decisionId` with no producer | `AlertSignal.decisionId`; answer/default status rules (S12-2) |
| 25 | Machine "assign" | §13 13.7: dispatches §9's assign | §9 has no assign action | Plan editor (`ops/setMinePlan`) or `fleet/move` (S13-18) |
| 26 | Catalog vs BALANCE fixtures | §9 9.2.7: 18 P1 models | BALANCE `matureNorth`, T-09 (b): P3 models | Phase-3 rows as data in P1; P1 terms stated in BALANCE (S09-1, S09-2, S09-19) |
| 27 | Type names | DESIGN §10: BuyerId, MoveId, FwdId | `core/ids.ts`: LocalBuyerId, CourierMoveId, ForwardId | Keep code names; align DESIGN (S10-16) |
| 28 | CLD in P1 | §8 8.17: "CLD 0.5" stub | §8 8.4 pool example (no ×0.75 before P5) | CLD 0 in the pool term; 0.5 only in the logits (S08-2) |
