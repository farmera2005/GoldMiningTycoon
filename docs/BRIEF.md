# Original Project Brief

> This is the owner's original brief for Gold Mining Tycoon, preserved verbatim so every future
> session works from the same source requirements. `DESIGN.md` expands it; where the two disagree,
> `DESIGN.md` → "Decisions" records why.

---

You are building Gold Mining Tycoon, a single-player business simulation that runs in the browser. The player founds a gold mining company and runs it as the Owner. This is a game about the business of gold mining: acquiring ground, getting permitted, financing and maintaining a fleet, hiring and managing a crew, and selling gold into a moving market. The player never operates equipment. There is no digging minigame, no 3D, no driving. Every week the player makes owner-level decisions and the simulation resolves what the crew produced, what broke, what it cost, and what the gold was worth.

The design target is depth and realism. A good session should feel like running a real small mining company: thin margins, big capital bets, incomplete information about the ground, and cash flow that can kill a profitable operation. Favor mechanics with real trade-offs over mechanics that only add clicks.

## How to work

1. Plan before you code. Before writing game code, produce three files and stop for my review:
   * `DESIGN.md` — the full game design, expanding every system below into concrete rules, formulas, and data shapes.
   * `CLAUDE.md` — project conventions, commands, architecture rules, and the phase plan, so future sessions stay consistent.
   * `BALANCE.md` — the economic targets (see Calibration) and how the headless simulator will verify them.
2. Build in phases (listed at the end). Each phase must end with a playable game, passing tests, and a short changelog. Do not start a phase until the prior one is solid.
3. Ask me when a design decision would be expensive to reverse. Otherwise make a sensible call, record it in `DESIGN.md` under "Decisions," and keep moving.
4. Keep content in data, not code. Equipment catalogs, staff roles, permit types, loan products, event tables, and tuning constants live in typed data files so I can rebalance without touching logic.

## Tech and architecture

* TypeScript, React, Vite. Zustand (or similar) for UI state. Recharts (or similar) for charts. Tailwind for styling.
* The simulation engine is a pure TypeScript module with no UI or browser dependencies. State in, actions in, new state out. The UI is a thin layer over it.
* Deterministic seeded RNG everywhere. A given seed plus a given action list must always produce the same game. This is required for testing and balancing.
* Headless simulator script (`npm run sim`) that plays hundreds of seeded games with simple bot strategies (cautious, aggressive, undercapitalized) and prints outcome distributions: bankruptcy rate, median net worth by year, cost per ounce, share of claims that were profitable. Use it to tune.
* Vitest unit tests on every economic formula (loan amortization, royalty math, wear, recovery, tax).
* Saves: versioned JSON in IndexedDB, with multiple slots, autosave each turn, and export/import to file.
* All money in USD. Gold in troy ounces. Volume in cubic yards.

## Game structure

* Time: one turn = one week. A "run to next decision" control fast-forwards through quiet weeks (off-season, waiting on permits) and stops on any event needing input.
* Seasons matter. Northern ground has a mining season of roughly 20–26 weeks set by breakup and freeze-up, which vary by year. Off-season is for permitting, financing, buying equipment at auction, repairs and rebuilds, hiring, and prospecting planning. Lower-latitude ground has longer seasons but is constrained by water.
* Setup: player names the company, picks an entity type (sole proprietor, LLC, corporation — affects liability, taxes, and how lenders treat personal guarantees), picks an owner background (former operator, mechanic, geologist, banker, or land man — each gives one meaningful edge), and picks a start:
  * Bootstrapper — modest cash, good personal credit, nothing else.
  * Backed — much more cash, but an investor holds equity or a production royalty and expects returns.
  * Inheritor — a family claim of unknown quality, worn-out equipment, and existing debt.
* Modes: open-ended sandbox plus goal scenarios (first 1,000 oz; debt-free by year 5; reach a target net worth). Three difficulty levels that scale ground quality honesty, lender patience, and event severity.
* Losing: insolvency. Missed payroll, loan default, repossession, and finally bankruptcy. Make the slide visible and give the player ways to fight it (sell assets, renegotiate, bring in a partner on bad terms).

## System 1 — Claims and ground

This is the heart of the game: the player never knows exactly what is in the ground.

**Procedural generation.** Each new game generates several mining districts, each with dozens of claims, and the market continuously lists new ones as others are taken. Every claim has hidden true geology and visible listing information:

* Hidden: pay-layer thickness and depth, overburden depth, gold grade distribution (oz per cubic yard, varying across the claim in cuts or blocks, with nugget-effect variance), gold particle size mix (fine vs coarse — drives which recovery equipment works), fineness (purity, roughly 70–92%), ground conditions (permafrost, clay, boulders, bedrock type), and how much has already been mined out by old-timers.
* Visible: acreage, location and access (highway, seasonal road, winter trail, fly-in), distance to town (drives mobilization, fuel delivery, and parts lead time), water availability, existing permits and bond status, production history as claimed by the seller, asking terms, and any inherited reclamation liability.

Seller honesty varies. Claimed grades can be accurate, optimistic, cherry-picked, or fraudulent. The player reduces uncertainty by spending money and time: panning and test pits (cheap, noisy), a drill program (expensive, much better), reviewing old records, or hiring a geologist. Testing produces a resource estimate with a confidence range that tightens with more samples. Model this properly — samples are draws from the true distribution with measurement noise.

**Ways to acquire ground.** Offer a robust mix at all price points:

* Purchase — unpatented claims (mineral rights only, annual fees to keep), state or territorial claims, and rare, expensive patented/private ground (fee-simple, fewer federal hoops).
* Lease — a production royalty paid in gold at each cleanup, plus an annual minimum or advance royalty, a work commitment, and the lessee covering claim maintenance. Royalty rates should span the real range: low single digits on unproven ground up to 15–25% of gross on proven northern placer ground. Include lease-with-option-to-purchase and royalty buy-down clauses.
* Stake open ground — nearly free, entirely unproven, and the player does all filing.
* Auctions, estate sales, and distressed sellers — bargains with hidden problems.
* Joint ventures — a claim owner contributes ground, the player contributes operations, split of production.

**Negotiation.** Asking terms are a starting point. Counter-offers succeed or fail based on seller motivation, gold price trend, competing bidders, and the player's reputation.

**Claim value moves with the gold price.** Rising gold lifts asking prices and royalty demands and brings competing bidders; falling gold creates distressed sellers.

**Reclamation is a liability.** Every disturbed acre must eventually be reclaimed. Track it on the balance sheet. Abandoning a claim without reclaiming forfeits bonds and damages regulatory standing.

## System 2 — Licensing, permitting, and compliance

Model three regulatory regimes on real ones. Use real-world frameworks as the template, simplify them into game mechanics, and set them in fictional districts. Build the U.S. federal regime first; add the others in a later phase. Accuracy of feel matters more than legal precision.

**Holding a claim (U.S. federal public land):**

* Unpatented claims under the 1872 Mining Law give rights to the minerals, not ownership of the land. A placer claim is up to 20 acres per locator; association claims go up to 160 acres. New patents have been frozen since 1994, which is why patented ground is scarce and pricey.
* Staking costs a location fee (about $49) plus a processing fee and the first year's maintenance fee.
* Annual maintenance fee of $200 per 20 acres of placer claim, due by September 1. Miss it and the claim is forfeited. This should be a real deadline on the in-game calendar.
* Small Miner's Waiver: an owner with 10 or fewer claims can skip the fee by doing at least $100 of assessment work per claim and filing proof by December 30. A growing company loses eligibility.

**Permission to disturb the surface (three tiers):**

* Casual use — hand tools, no notice. Good for early prospecting only.
* Notice — exploration disturbing 5 acres or less and bulk sampling under 1,000 tons. Filed at least 15 days ahead with a reclamation cost estimate and a financial guarantee.
* Plan of Operations — required for actual mining. Triggers environmental review and public comment, takes months to years, and requires a larger bond. Outcomes vary: approved, approved with conditions (seasonal stream restrictions, disturbance caps, concurrent reclamation), sent back for more information, or contested.

Other approvals that gate operations: water rights and a wastewater discharge permit, a stream/wetlands permit where the work touches water, state reclamation permit, mine safety registration with crew training and periodic inspections, a business and mining tax license, and required insurance. Hard rock (later phase) adds explosives licensing.

**Alaska-style regime:** one consolidated multi-agency application covers the land use permit, reclamation plan, discharge permit, and fish habitat review, and can be approved for multiple years. Annual claim rental plus annual labor filings. Reclamation bond required above 5 acres of disturbance, with a state bond pool option at a per-acre deposit that is partly refunded on reclamation. Annual reclamation statement due December 31. A state mining license and a net-income-based production royalty and license tax.

**Yukon-style regime:** operations fall into Classes 1–4 by scale of disturbance and water use. Class 1 is notification only. Class 4 (large water use or any in-stream work) needs an environmental assessment, First Nations consultation, and a water licence — a long, staged process with multiple review steps. The government royalty per ounce is nominal, so the cost is in time, not tax.

**Game mechanics for all regimes:**

* Each permit is a pipeline: preparation cost → submission → stochastic review time → possible information requests → decision. A good permitting specialist or consultant shortens and de-risks it.
* Existing permits are an asset. A claim that is already permitted and bonded is worth far more than identical raw ground. Some permits transfer with a sale; some must be reissued.
* Permits carry conditions and limits (acres disturbed, water use, season dates). Exceeding them is a player choice with consequences.
* A compliance calendar tracks every fee, filing, renewal, and bond.
* Inspections occur. Violations lead to fines, stop-work orders, bond forfeiture, and a regulator-standing score that slows future approvals.
* Bonds tie up cash or require a surety with its own underwriting and premium.

## System 3 — Operations

Each active claim has a mine plan the player sets and a foreman executes: which cut to work, shifts per day, hours per shift, and equipment assignment. Each week the engine resolves:

1. Stripping — overburden moved, limited by excavator/dozer/truck capacity and ground conditions.
2. Pay hauled and washed — limited by the slowest link: digging, hauling, wash plant throughput, water supply.
3. Recovery — percentage of contained gold captured, based on how well the plant and recovery circuit match the gold's particle size, feed rate versus rated capacity, and plant operator skill. Running a plant too hard loses fine gold.
4. Cleanup — raw gold weighed in. Royalties owed in-kind come off the top.
5. Costs — fuel, wages, parts, camp, consumables.

Bottlenecks must be visible. The player should be able to see that the plant sat idle 30% of the week because there was one rock truck, or that a D-class dozer is the only thing keeping up with stripping.

Prospecting and drilling run as separate programs with their own crews, equipment, and results reports.

## System 4 — Staff

The player hires, pays, assigns, and fires. Roles: foreman/mine boss, equipment operators, mechanics, welder, plant/gold room operator, geologist, driller, permitting and land specialist, safety officer, bookkeeper/controller, camp cook, laborers.

* Each person has skill, reliability, safety, and morale, plus a wage expectation that tracks the labor market. A hot gold market makes good people expensive and scarce.
* Operator skill affects productivity and equipment wear. A bad operator destroys an undercarriage.
* Pay structures: hourly, salary, season-completion bonus, and percentage-of-gold deals. Each has different cash-flow and retention effects.
* Morale responds to pay, hours, camp quality, safety record, and whether paychecks clear. Low morale causes quits mid-season, the worst possible time.
* Injuries happen, driven by hours, fatigue, safety culture, and equipment condition. They carry workers' comp, regulatory, and morale costs.
* Hired managers unlock delegation: a strong foreman lets the player run multiple claims; a controller improves lender terms and catches problems early.

## System 5 — Equipment

**Catalog.** Excavators, dozers, articulated rock trucks, wheel loaders, wash plants (trommels, shaker decks, derockers), recovery gear (sluices, jigs, centrifugal concentrators, shaker tables), pumps, generators, drill rigs, conveyors and stackers, service and fuel trucks, lowboy transport, and camp facilities. Use realistic generic size classes with fictional manufacturers, several brands per class with different reliability, parts cost, and resale profiles.

**Every price point.** Factory-new with warranty, certified used from a dealer, private-party used, and auction. Listings are procedurally generated and rotate. Used prices respond to the gold price — a boom makes iron expensive, a bust floods auctions with repossessed equipment.

**Ways to get it:** cash purchase, dealer or bank financing, operating lease, finance lease with buyout, short-term rental (expensive, flexible), and rent-to-own. Include mobilization cost and time to get equipment to remote claims.

**Condition and wear.**

* Each machine tracks hours and the health of major components (engine, hydraulics, undercarriage or tires, drivetrain, electrical, structure).
* Used equipment has hidden condition. Listings show hours and a seller description; true component health is revealed only by an inspection, and the quality of that inspection depends on the mechanic doing it. Auctions are as-is.
* Wear accrues per operating hour and is accelerated by poor operators, hard ground, overloading, skipped maintenance, and cold.
* Worn components reduce productivity, raise fuel burn, and raise the weekly chance of failure. Failures cause downtime, and parts lead time depends on remoteness and brand.

**Mechanics.**

* Preventive maintenance done on schedule slows wear substantially.
* Repairs restore component health; full rebuilds reset a component at high cost and are best done in the off-season.
* Each mechanic has a weekly capacity in labor hours and a skill level that sets repair quality and speed. An understaffed shop builds a backlog and the fleet degrades.
* A stocked parts inventory cuts downtime but ties up cash.
* Without a mechanic, the player pays a field service contractor: slow and expensive.

**Ownership economics:** depreciation, resale value, insurance, and a per-machine cost-per-hour report so the player can decide when to repair, rebuild, or replace.

## System 6 — The gold market

* Weekly spot price from a stochastic model with trend regimes (bull, bear, range-bound), mean reversion, volatility clustering, and occasional jumps. Drive it with a visible macro layer — interest rates, inflation, dollar strength, central bank buying, geopolitical shocks — delivered through a news feed so moves feel explained, not random.
* Seed the opening price around $4,200/oz as a configurable constant, and allow multi-year swings on the scale of real history (gold has both doubled and fallen by a third within a few years).
* The gold price ripples through the whole economy: claim prices, royalty demands, equipment prices, wages, lender appetite, and competitor behavior.
* Selling:
  * Local buyer — immediate cash, noticeable discount to spot.
  * Refinery — better payout on assayed fine gold content after refining and assay fees, minimum lot size, settlement delay.
  * Hold inventory — speculate on price; requires secure storage and insurance, with theft risk.
  * Forward sales and hedging — lock a price for future ounces. Protects cash flow, caps upside, and creates real trouble if production falls short. Lenders may require it.
* Players are paid on fine gold, not raw weight. Fineness varies by claim.

## System 7 — Finance

Build this like real small-business finance.

* Banking: operating account, reserve/savings, payroll runs, a full transaction ledger.
* Credit: separate credit profiles for the owner and the company. The company starts with no history, so early borrowing leans on personal guarantees. Payment history, leverage, time in business, and profitability move the score, and the score moves rates, limits, and approvals.
* Lenders with different appetites: local bank (cheap, conservative, hates mining), equipment finance companies and dealer captive finance (easier, secured by the iron), hard-money and private lenders (fast, expensive), and investors.
* Products:
  * Term loans and equipment loans with amortization schedules and collateral.
  * Operating and finance leases.
  * Revolving line of credit with a borrowing base tied to gold inventory and receivables.
  * Business credit cards and vendor credit (fuel and parts on terms).
  * Gold-backed loans against inventory.
  * Royalty and streaming deals — cash up front for a share of future production.
  * Equity partners — cash for ownership and a say in decisions.
* Covenants and consequences: debt service coverage, minimum cash, reporting. Breaches trigger rate increases, called loans, and repossession of specific collateral. Late payments damage credit. Lenders tighten when gold falls.
* Seasonality is the core cash-flow problem. Costs are front-loaded in spring; gold arrives through summer and fall; debt payments run all year. Offer seasonal payment structures to borrowers with good credit.
* Insurance: equipment, general liability, workers' comp, with premiums tied to claims history.
* Taxes: income tax by entity type, payroll taxes, equipment depreciation, royalties and production taxes by regime. Keep it simplified but directionally real.
* Reporting: income statement, balance sheet, cash flow statement, per-claim profit and loss, cost per ounce (cash cost and all-in), a 13-week cash forecast, and a debt schedule. These reports are a main part of the interface, not an afterthought.

## Events and competitors

* Events: early freeze-up, late breakup, floods, drought, wildfire closures, major breakdowns, theft, injuries, surprise inspections, fuel price spikes, claim boundary disputes, a key employee poached, a lender changing policy. Events should stress a specific system and reward preparation.
* AI competitors: other mining companies bid on claims and auction equipment, hire from the same labor pool, and go bust in downturns, putting their ground and iron on the market.

## Interface

Think business software, not arcade game: a dashboard, tables, ledgers, charts, a calendar, and an inbox. Main screens: Dashboard (cash, gold price, alerts, this week's decisions), Claims market and owned ground, district map (simple 2D), Operations per claim, Equipment market and fleet/shop, Staff, Permits and compliance calendar, Bank and loans, Gold sales, Reports, News. Every number should be clickable down to how it was calculated. Desktop-first; keep it clean and readable.

## Calibration

Fictional world, tuned to real-world magnitudes. Put all of this in tunable data files and validate with the headless simulator.

* Placer grades mostly in the range of 0.005–0.03 oz per cubic yard, with rare rich pockets. Most ground offered should be marginal or uneconomic once stripping is counted; finding the good ground is the game.
* A small starter operation washes roughly 30–75 yards per hour; a mature one 150–300+.
* Equipment prices span roughly $15k for a tired small machine at auction up to $1.5M+ for a new large dozer or wash plant, with mid-size used excavators, loaders, and rock trucks in the low-to-mid six figures.
* Fuel and wages dominate operating cost; debt service and royalties decide whether a season was worth it.
* Balance targets: a careful player on standard difficulty survives the first two seasons about 60–70% of the time; a first-season profit is possible but not typical; an undercapitalized, untested-ground strategy usually fails; no single strategy dominates.

## Build phases

* Phase 0 — Foundation. Planning docs, project scaffold, engine/UI separation, seeded RNG, save/load, turn loop, test harness, headless simulator skeleton.
* Phase 1 — Core loop. Company setup, claim generation and market (buy and lease), basic prospecting, a small equipment catalog bought for cash, hiring, weekly operations and cleanup, flat gold price with local-buyer sales, bank account, basic P&L. Playable start to bankruptcy or profit.
* Phase 2 — Licensing. U.S. federal regime in full: claim fees and deadlines, the three permit tiers, bonds, compliance calendar, inspections, violations, reclamation liability.
* Phase 3 — Equipment depth. Full catalog, new/used/auction markets, hidden condition and inspections, component wear, mechanics, parts, breakdowns, rental and leasing.
* Phase 4 — Finance depth. Credit profiles, all lenders and products, covenants, default and repossession, insurance, taxes, full reporting and cash forecast.
* Phase 5 — Living market. Dynamic gold price with macro drivers and news, refinery and forward sales, market ripple effects, events, AI competitors, negotiation.
* Phase 6 — Expansion. Alaska-style and Yukon-style regimes and districts, multi-claim management with delegation, joint ventures and investors, scenarios and difficulty, then hard rock mining as an optional late-game track.

After every phase: run the simulator, report results against `BALANCE.md`, and list what you tuned.

## Start now

Read this prompt fully, then write `DESIGN.md`, `CLAUDE.md`, and `BALANCE.md`. In `DESIGN.md`, list any open questions for me at the top. Stop and wait for my review before starting Phase 0.
