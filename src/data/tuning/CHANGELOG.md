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
