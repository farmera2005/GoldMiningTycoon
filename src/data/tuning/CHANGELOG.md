# Tuning changelog

Every tuning or bot change: date, key, old → new, owner section, target ID, before → after, git SHA (BALANCE §8.2).

| Date | Key | Old → new | Owner § | Target | Before → after | SHA |
|---|---|---|---|---|---|---|
| 2026-10-05 | `game.start.bootstrapper.personalCashUsd` | — → 120000 | §1 1.8, 1.20 | — | — | cb28de2 |
| 2026-10-05 | `game.startCompanyCashMult` | — → 1 | §1 1.11, 1.20 | — | — | cb28de2 |
| 2026-10-05 | `game.startPersonalCashMult` | — → 1 | §1 1.11, 1.20 | — | — | cb28de2 |
| 2026-10-06 | `geology.world.nTrib` | U{3..6} → U{5..8} | §3 3.3.1, 3.16 (D-3.49) | §3.18 parcels per district: mean 65–75, ≥ 55 in ≥ 99% of districts | with `tribLengthMi` and `branchP`: mean 61–62 per district, 13–17% of districts under 55 → 69.5 north / 68.1 arid, minimum 60, all ≥ 55 (engine generator, 400 worlds per template, seed bases 1000 and 90000) | f571613 |
| 2026-10-06 | `geology.world.tribLengthMi` | U(1.5, 4) → U(2.5, 5) | §3 3.3.1, 3.16 (D-3.49) | §3.18 parcels per district | joint with `nTrib` (row above) | f571613 |
| 2026-10-06 | `geology.world.branchP` | 0.4 → 0.5 | §3 3.3.1, 3.16 (D-3.49) | §3.18 parcels per district | joint with `nTrib` (row above) | f571613 |
| 2026-10-06 | `northernFederal.benchSideP` (src/data/regions) | — (global `geology.world.benchSideP` 0.6) → 0.5 | §3 3.2, 3.4 (D-3.50) | §3.4 bench share = depositMix.bench 20% ± 5 points | benches 26–28% → 18.5% / 18.1% of parcels (0.45 gave 17.0%) | f571613 |
| 2026-10-06 | `aridFederal.benchSideP` (src/data/regions) | — (global `geology.world.benchSideP` 0.6) → 0.25 | §3 3.2, 3.4 (D-3.50) | §3.4 bench share = depositMix.bench 10% ± 5 points | benches 26–28% → 10.3% / 10.6% of parcels | f571613 |
| 2026-10-06 | `aridFederal.trailDegradeMi` (src/data/regions) | — (global `geology.access.trailDegrade1Mi` / `2Mi` 6 / 18) → 12 / 30 | §3 3.2, 3.3.3 (D-3.50) | §3.2 / §3.18 access mix: arid highway 35% ± 10 points | highway claims 21.7% → 39.3% / 36.5% | f571613 |
| 2026-10-06 | `aridFederal.gMed` (src/data/regions) | 0.0062 → 0.0056 | §3 3.2 (D-3.36, D-3.51) | §3.7 / §3.18 listing-pool shares 60–72 / 18–30 / 5–10 / 0.7–2.5 (BALANCE T-02) | arid pool U / M / G / E 60.2 / 27.6 / 10.5 / 1.6 and 59.8 / 27.6 / 10.9 / 1.7 → 64.1 / 25.9 / 8.8 / 1.1 and 63.0 / 26.5 / 9.3 / 1.2; held median paystreak grade 0.0051 → 0.0045; BALANCE T-01 (b) arid falls to 39.8% / 40.7% (gate 40%, P1) | f571613 |
| 2026-10-06 | `geology.world.dredgedMaxStretches` | — → 6 | §3 3.4, 3.16 (D-3.56) | — | — (new: fixed dredged-stretch draw slots) | f571613 |
| 2026-10-06 | `geology.world.outletEdgeFrac` | — → U(0.25, 0.75) | §3 3.3.1, 3.16 (D-3.56) | — | — (new: outlet position along its map edge) | f571613 |
| 2026-10-06 | `geology.oldTimer.recentGapP` | — → 0.2 | §3 3.6, 3.16 (D-3.56) | — | — (new: one-year gap between recent-operator seasons) | f571613 |
| 2026-10-06 | `geology.oldTimer.kinds` (hydraulic `obMult`) | — → 0.5 | §3 3.6, 3.16 (D-3.56) | — | — (new: hydraulic overburden reduction, P6) | f571613 |
| 2026-10-06 | §3 prose constants registered as `geology.*` keys (no value change) | — | §3 3.16 (D-3.56) | — | — | f571613 |
| 2026-10-06 | difficulty `geology.seller.honestyMix` (easy / hard) | — (no difficulty rows) → easy 0.55 / 0.30 / 0.12 / 0.03, hard 0.20 / 0.35 / 0.30 / 0.15 (accurate / optimistic / cherry-picked / fraudulent) | §1 1.11 (D-1.19) | — | P0 had an empty difficulty table, so every difficulty resolved standard tuning; now as §1 1.11 states | 6af5911 |
| 2026-10-06 | difficulty `geology.seller.tellDetect` (easy / hard) | — → × 1.15 / × 0.85 per cell, capped at 1 | §1 1.11 | — | as §1 1.11 states; the cap keeps each cell a probability | 6af5911 |
| 2026-10-06 | difficulty `game.startCompanyCashMult` (easy / hard) | — → 1.25 / 0.85 | §1 1.11 (D-1.43) | — | easy company cash $500k, hard $340k | 6af5911 |
| 2026-10-06 | difficulty `game.startPersonalCashMult` (easy / hard) | — → 1.1 / 0.9 | §1 1.11 (D-1.43) | — | easy personal cash $132k, hard $108k | 6af5911 |
| 2026-10-06 | `geology.estWorkedOffStreakLik` | 1e-3 → 0.1 | §4 4.10.2, 4.20 | §4.22 calibration (D-4.47 cells) | prior bias arid.vis.dryWash +0.149 → +0.079, arid.vis.recentCat +0.182 → +0.124, north.160ac +0.083 → +0.017 (old world, 1,000 claims per cell); also the floor of the dredge footprint likelihood | aa9f55c |
| 2026-10-06 | `geology.recordsWorkedLogOffset` (handCut, worked) | −0.47 → −0.84 | §4 4.10.2 | §4.22 north.vis.handCut | the value measured on §3's engine generator (virgin selection +0.195, removal −1.086); ≈ −0.03 on north.vis.handCut | aa9f55c |
| 2026-10-06 | `geology.estPriorMedianAdj` | north 0 → 0 (via +0.05), arid 0 → −0.05 (via −0.02) | §4 4.20 (calibration valve) | §4.22 prior-stage bias, visible cells | precision-weighted centring of the visible cells' prior biases on the reviewed world: north visible cells were +0.075 high at +0.05, arid +0.043 high at −0.02 | c2d9dfc |
| 2026-10-06 | `geology.estStreakMisfitScale` | — → 0.5 | §4 4.5.1 | §4.22 north.160ac | new: row-misfit quadrature for §3's wandering paystreak; 160 ac coverage at fences+ 0.66–0.68 → 0.73–0.77, z sd 1.15–1.20 → 0.94–0.98 | aa9f55c |
| 2026-10-06 | `geology.estClaimSharedLogSd` | — → 0.05 | §4 4.4 | §4.22 large pit grids | new: error shared by every sample row of a claim (capture, profile, lab) | aa9f55c |
| 2026-10-06 | `geology.estWorkedCountSlackBlocks` / `geology.estWorkedSetTemper` | — → 2 / 1 | §4 4.10.2 | §4.22 worked-ground cells | new: worked-count likelihood and exchangeable worked-set term; arid dry-washed posterior paystreak blocks 14.5 → ≈ 10.4 (truth 10.4) | aa9f55c |
| 2026-10-06 | `geology.estThinCoverSiteWeight` | — → 0.05 | §4 4.6, 4.10.2 | §4.22 north.vis.handCut | new: visible hand-cut blocks bound depth (§3 hand-cuts only under maxObFt); prior / records / pans +0.180 / +0.167 / +0.068 → +0.009 / +0.010 / −0.016 | c2d9dfc |
| 2026-10-06 | difficulty `geology.recordsFindMult` / `geology.pitStopMult` / `geology.contractorLeadMult` | — → 1.0 / 1.0 / 0.9, 0.7 / 1.0 / 1.3, 0.8 / 1.0 / 1.25 (easy / standard / hard, {set}) | §1 1.11, §4 4.18 | — | as §1 1.11 states; standard unchanged | c2d9dfc |
