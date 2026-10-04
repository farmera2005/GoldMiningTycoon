# R1: U.S. Federal Mining Law, Permitting and Compliance (Placer Gold): Fact Sheet

Prepared 2026-10-04 for Gold Mining Tycoon system design (System 2: Licensing, permitting, compliance).
Scope: unpatented placer claims on BLM land under the 1872 Mining Law. Covers 43 CFR 3809 surface management,
bonds, Clean Water Act sections 402 and 404, water rights, state overlays, MSHA, enforcement, and real timelines.

**How these figures were checked.** I ran web searches against agency documents (BLM fee tables and mining packets,
the Federal Register, MSHA, EPA, USACE, Alaska DNR and DEC, Nevada NDEP and NDOM, and GAO). The network blocked direct
page fetches, so most numbers come from search-engine extracts of those primary documents.
- **(MK)** marks a figure that is *unverified, from model knowledge*.
- **(verify)** marks a figure from a secondary source, or one whose extract looked ambiguous.
- Unit conversions: 1 acre = 0.405 ha, 20 ac = 8.09 ha, 160 ac = 64.7 ha. $/acre x 2.471 = $/ha.

---

## Most important numbers

1. **Staking cost per new placer claim (BLM)** is $25 processing + $49 location + $200 first-year maintenance = **$274 for a claim of 20 acres or less**.
   - These are the fees for claims located on or after 2024-09-01.
   - The $200 maintenance fee is charged per 20 acres. The $25 and $49 are charged per claim (MK nuance, consistent with the BLM table layout).
   - So a 160-acre association placer costs about $25 + $49 + $1,600 = **$1,674** to record.
2. **Annual maintenance fee** is **$200 per 20 acres or fraction**. A 141–160 acre association placer pays **$1,600 per year**.
   - Due **on or before September 1**, the start of the noon-to-noon assessment year. It shifts to the next business day when Sept 1 falls on a weekend or holiday (Sept 2, 2025; Sept 1, 2026 is a Tuesday).
   - Missing it means **forfeiture by operation of law**.
   - Rates were unchanged for the 2027 assessment year (due 2026-09-01).
3. **Small Miner Waiver** works as follows.
   - Eligibility: **10 or fewer claims or sites nationwide**, counting all related parties.
   - File **Form 3830-2 by Sept 1**. There is no fee.
   - Perform **at least $100 of labor per claim** during the assessment year.
   - File the **Affidavit of Assessment Work (Proof of Labor) by December 30** after that assessment year ends, with **$15 per claim** BLM processing.
   - Missing affidavit = forfeiture.
4. **Recording** must be done with the **BLM state office within 90 days of location**, and with the county under state law.
   - County fees: about **$12 per claim** for Nevada intent-to-hold filings, plus a state filing fee of up to **$6 per claim**.
   - Arizona charges a flat **$30 per document**.
5. **The three 43 CFR 3809 tiers**
   - **Casual use**: hand tools, panning, non-motorized sluicing, sometimes small suction dredges. No mechanized earth-moving.
   - **Notice**: *exploration only*, **5 acres or less** of disturbance, bulk sample **under 1,000 tons**. File **15 calendar days** ahead; BLM reviews for completeness within 15 days. A bond is required. Valid **2 years**, extendable by 2 years.
   - **Plan of Operations**: required for **all mining and processing of any size**, for exploration over 5 acres, for bulk samples of 1,000 tons or more, and for *any* above-casual work in special-status areas.
6. **Plan approval time**
   - GAO studied 68 BLM and Forest Service mine plans approved in FY2010–14. Approval took **1 month to more than 11 years, averaging about 2 years**.
   - Recent small placer EAs (2025–26) went from public comment to decision in about **5–8 months**.
   - Statutory caps since 2023: EA within **1 year**, EIS within **2 years**. Public comment on a plan runs **at least 30 days**.
7. **Bonding** is full cost: what BLM would pay a third-party contractor. Indirect costs add roughly **35–60%** on top of direct earthwork cost.
   - Alaska state default bond: **$750 per acre**.
   - Alaska statewide bond pool: **$150 per acre** ($112.50 refundable deposit + $37.50 non-refundable fee). BLM accepts it on federal land.
   - Nevada bond pool, notice level: 100% deposit + 2% per year premium.
   - Montana small-miner placer bond: capped at **$10,000**.
8. **Water quality**
   - Federal effluent guideline for gold placer: **settleable solids 0.2 mL/L**. Alaska turbidity standard: **5 NTU or less above natural** when background is 50 NTU or less.
   - Alaska general permit **AKG370000** runs 2023-06-01 to 2027-12-31. Annual fee: **$315** with a mixing zone.
   - Maximum EPA administrative penalty (Class II): **$27,378 per day**, capped at **$342,218** (2025).
9. **Section 404 (fill in wetlands and streams)**
   - **NWP 44 (Mining)** allows up to **½ acre** of loss. The 2026 NWP set runs **2026-03-15 to 2031-03-15**.
   - Corps average processing time in FY2024: **55 days** for an NWP pre-construction notification, **253 days** for a standard individual permit.
   - Alaska placer regional general permit: **10 acres of WOTUS (waters of the U.S.) per 5-year term**, no anadromous streams. Reissuance was proposed in July 2025.
10. **MSHA**
    - Legal-ID filing (**Form 2000-7**) is due **within 30 days** of opening.
    - **A placer gold mine is a metal mine, so Part 48 Subpart B applies, not Part 46.** New miners need 24 hours of training, at least 8 of them before starting work. Annual refresher: 8 hours.
    - Surface mines get **at least 2 inspections per year**.
    - Penalties (2025 amounts; the 2026 inflation adjustment was cancelled): **$168 minimum, $90,649 maximum** for regular assessments, up to **$332,376** for flagrant violations.
    - Average assessed penalty is about **$700 per citation**. Small-mine citations typically run **$130–$500**.

---

## 1. The 1872 Mining Law and placer claims

**Basics**
- Locatable minerals (gold included) on open federal land can be claimed by any U.S. citizen or entity that makes a **discovery of a valuable mineral deposit**.
  - The tests are the prudent-person test and marketability (MK).
  - Before discovery, a prospector in active occupation has only *pedis possessio* protection against rival locators (MK).
- **Placer claim:** up to **20 acres per locator**.
  - An **association placer** can reach **160 acres with 8 locators**, at 20 acres each.
  - A corporation counts as one locator, so a corporation alone can locate only 20 acres per placer claim (MK).
  - On surveyed land, placer claims must conform to legal subdivisions (aliquot parts, i.e. survey fractions such as quarter-quarter sections) (MK).
  - Gold in gravel is staked as a placer. A lode claim, up to 1,500 x 600 ft, covers veins in place (MK).
- **Unpatented claim:** the holder owns the **mineral rights plus reasonably incident surface use**. Title stays with the United States.
  - The claim is real property: it can be sold, leased, mortgaged or inherited.
  - Under the Surface Resources Act of 1955, the surface remains open to other public uses (MK).
  - Living on a claim (camps, trailers, gates) needs BLM occupancy concurrence under 43 CFR 3715 (MK).
- **Patented claim:** fee simple, meaning private land. The statutory purchase price is **$2.50 per acre for placer and $5.00 per acre for lode** (MK).
- **Patent moratorium:** an Interior appropriations rider has blocked new patent applications **since 1994-10-01**. It has been renewed every year since.
  - About 626 applications were pending in 1994. **405 were grandfathered**, having received First Half Final Certificates. **221 were frozen**.
  - Result: patented placer ground is a fixed, shrinking stock.
- **Withdrawn and segregated lands** (parks, wilderness, many monuments, selected Native or state lands) are closed to new location.
  - Plans on withdrawn lands trigger a **validity examination** before approval (43 CFR 3809.100).
  - In January 2025 Interior revoked ANCSA 17(d)(1) withdrawals on **about 9.7 million acres in NW Alaska**. Unencumbered lands opened to mineral entry; state and Native-selected lands stay segregated.
- **Active-claim stock in 2026:** NV about 218,000; UT 41,700; CA 26,950; MT 18,592; OR 10,578.
  - Source: third-party aggregators of BLM MLRS data (verify).
  - Nevada has about 1.37 million claims ever recorded, of which only about 16% are active. Ground churns constantly.

**Surprising or misunderstood**
- There is **no federal royalty** on gold from unpatented claims. The cost of holding is fees plus labor, permitting and bonds. (Bills such as H.R. 6674, the "CLAIM Act of 2025", propose tiered fees but are not law.)
- A claim gives no right to mine without surface-management approval (Section 3 below).

**Game implication.** Model claims as 20-acre units. An association claim is 1 to 8 units, so fee = $200 x ceil(acres/20).
- Stocks: patented ground is a finite, non-replenishing stock; unpatented ground can be listed and forfeited.
- An event can open withdrawn land (like the Alaska d-1 revocations), creating a staking rush.

## 2. BLM fees, deadlines and forfeiture

| Item (assessment year 2026–27) | Amount | Notes |
|---|---|---|
| Processing fee, notice of location | $25 per claim | Adjusted yearly by the IPD-GDP inflation index (43 CFR 3000.12). BLM table dated 2026-02-09 says "may change July 1, 2026". |
| Location fee (one-time) | $49 per claim | Was $40 before 2024-09-01. |
| Initial maintenance fee | $200 per 20 ac (placer) | Paid at recording; covers the assessment year the claim was located in. |
| Annual maintenance fee | $200 per 20 ac or fraction | Was $165 before 2024-09-01. 160 ac = $1,600. |
| Small miner waiver (Form 3830-2) | $0 | Due Sept 1. |
| Affidavit of assessment work | $15 per claim | Due Dec 30. |
| Notice of Intent to Hold | $15 per claim | Due Dec 30. |
| Transfer of interest | $15 per claim per transferee | |

- **Fee history.** BLM's final rule of 2024-07-01 raised fees by CPI, effective 2024-09-01: maintenance $165 to $200, location $40 to $49. By statute (30 U.S.C. 28j) these fees adjust for CPI every 5 years, so the next step is about 2029 (MK).
- **Timing trap (MK).** A claim located in, say, July 2026 pays $274 at recording, which covers the year ending 2026-09-01. It then owes another $200 per 20 ac by 2026-09-01 for the 2027 year. Summer staking means **paying twice within weeks**.
- **Forfeiture.** Failure to pay or waive by Sept 1 forfeits the claim **automatically**. There is no grace period and no reinstatement; others may then relocate the ground (MK on relocation mechanics).
  - The **partial-payment direct final rule** was published 2025-09-02 and set to take effect 2025-11-03 absent adverse comment. Under it, BLM applies partial payments to claims **in serial-number order**. Unfunded claims forfeit unless topped up by Sept 1.
- **Recording.** File with the BLM state office within **90 days of location** (in Alaska, the Fairbanks district office also accepts filings). Record with the county per state law; some states require 30 or 60 days.
  - Nevada counties: Lyon and Humboldt charge **$12 per claim** for intent-to-hold.
  - Nevada also charges a separate state filing fee of up to **$6 per claim**, set by the Commission on Mineral Resources.
  - Arizona (Yavapai County documents): **$30 per document**.
  - Nevada also requires a county Affidavit and Notice of Intent to Hold each year (by Nov 1, MK).
- **Staking cost beyond fees (MK).** Field staking is corner monuments plus a location notice. Typical cost is $100–$500 per claim if contracted, much more when fly-in.

**Game implication.** Put Sept 1 (fees or waiver), Dec 30 (affidavit), Nov 1 (state intent-to-hold) and the 90-day recording window on the compliance calendar as hard deadlines.
- Missed Sept 1 means instant forfeiture plus an "ex-claim relisted" market event.
- Holding cost = $10 per acre per year: 80 ac costs $800 per year, 640 ac costs $6,400.

## 3. Small Miner Waiver

- **Eligibility.** The claimant plus *all related parties* (spouse, dependent children, affiliates) own **10 or fewer** unpatented claims or sites nationwide as of Sept 1. A growing company loses eligibility the moment it reaches 11.
  - How an association placer counts is unclear. Secondary sources and BLM practice suggest **one claim regardless of acreage** (verify).
  - The initial-year maintenance fee on newly located claims cannot be waived (MK).
- **Steps**
  1. File **Form 3830-2** by Sept 1. No fee.
  2. Perform **at least $100 of labor or improvements per claim** during the assessment year (Sept 1 to Sept 1).
  3. File the **Affidavit of Assessment Work** by the **Dec 30 after that assessment year ends**, with $15 per claim, and record it with the county.
  - Example: a waiver filed 2026-09-01 covers work done 2026-09-01 to 2027-09-01, with the affidavit due 2027-12-30.
- **What counts (43 CFR 3836.12–13):**
  - drilling, excavations, shafts and tunnels;
  - sampling (geochemical or bulk);
  - road construction on or for the claim;
  - geological, geochemical and geophysical surveys, including magnetics, EM, gravity, seismic and multispectral.
  - One association placer needs only **$100 per year**, not $100 per 20 ac. Work on one claim can credit a contiguous group covering the same deposit.
  - Survey work can be credited only for limited years and must be done by qualified experts (MK).
  - Travel, recreation and equipment purchases do not count (MK).
- **Failure modes**
  - No affidavit by Dec 30: **claims forfeited**, even though the waiver was granted.
  - A timely but *defective* waiver: BLM sends notice and the claimant gets **60 days to cure or pay the fee**. Uncured means forfeiture.
- **Economics.** Ten 20-acre claims save $2,000 per year. Ten 160-acre association claims save **$16,000 per year**, a big incentive to stay at 10 or fewer.

**Game implication.** Offer the waiver as a toggle when 10 or fewer claims are held. It costs $100 per claim of required "assessment work" (a cash or crew-time sink) plus $15 per claim filing.
- Acquiring the 11th claim should trigger a warning: fee liability jumps on *all* claims at the next Sept 1.

## 4. Surface management: 43 CFR 3809 (BLM)

**Tier definitions**
- **Casual use:** negligible disturbance from hand tools, hand panning, non-motorized sluicing, *possibly* small portable suction dredges (state rules govern), and vehicles on open routes.
  - Excludes mechanized earth-moving, truck-mounted drills, chemicals and explosives.
- **Notice (3809.21, .301–.336):** *exploration*, not production. Covers **5 acres or less** of total disturbance and a **one-time bulk sample under 1,000 tons**.
  - File **15 calendar days** before starting. BLM checks completeness **within 15 days** and may require changes.
  - A **financial guarantee** must be in place before work begins.
  - Valid **2 years**, extendable 2 years at a time by written notice before expiry with the bond maintained.
  - Splitting a project into serial notices to dodge a plan is prohibited.
  - A notice is not a federal approval, so **no NEPA review** is required (MK; consistent with BLM practice).
- **Plan of Operations (3809.11, .401–.411)** is required for:
  - (a) **all mining and processing** beyond casual use, regardless of acreage, so every production placer mine on BLM land needs one;
  - (b) exploration over 5 acres;
  - (c) bulk sampling of 1,000 tons or more;
  - (d) any above-casual disturbance in **special-status areas**: the California Desert Conservation Area (controlled or limited use zones), Wild and Scenic River corridors (designated or study), ACECs (Areas of Critical Environmental Concern), wilderness, areas closed to off-road vehicles, T&E (threatened and endangered) species habitat, National Monuments and **National Conservation Areas**.
  - In Alaska, the **Fortymile Wild and Scenic River** corridor and the **Steese NCA** mean a plan is needed even for small work there (MK on the designations).

**Plan of Operations process**
1. **Completeness review**, about 30 days (MK).
2. **Public notice and at least 30 days of comment** (3809.411(c)).
3. **NEPA**: usually an **EA (environmental assessment) leading to a FONSI** (finding of no significant impact). A CX (categorical exclusion) is available only for *minor modifications* to approved plans. An EIS (environmental impact statement) is for large or controversial projects.
   - Under the 2023 Fiscal Responsibility Act, an EA must finish in 1 year and run at most 75 pages; an EIS must finish in 2 years and run at most 150 pages (300 if extraordinary). DOI moved its NEPA procedures into a handbook effective **2026-02-24**.
4. **Decision**: approve, **approve subject to changes or conditions**, request more information (the clock effectively resets), or disapprove.
   - Appeals go to the BLM State Director or IBLA (Interior Board of Land Appeals). Lawsuits by NGOs or tribes are possible.
- **Processing cost.** No BLM fee for a notice or an EA-level plan. EIS-level work is cost-recovered case by case (MK).
  - Operators often pay consultants for the EA and baseline studies (cultural, wildlife, hydrology, wetlands); one year of baseline data is common.
  - Indicative all-in permitting, engineering and baseline costs for a small operation: **$10k–$250k**, depending on acreage, water, wetlands and cultural issues (verify).
- **Typical approval conditions:**
  - concurrent reclamation (close each cut before opening the next);
  - settling ponds and closed-loop water;
  - stream buffers and seasonal (fish-window) restrictions;
  - disturbance caps;
  - cultural-site avoidance;
  - weed control;
  - wildlife fencing (desert tortoise exclusion in the Mojave);
  - bond posted before operations.

**Regulatory churn, 2025–26**
- Direct final rules removed obsolete 3809 transition provisions: plans (3809.400(b)–(c)) effective 2025-09-15; notices published 2025-09-25.
- A fee-rules DFR (2025-09-02) codified the partial-payment order.
- **EO 14241** (March 2025, "Immediate Measures to Increase American Mineral Production") is cited in recent small-placer approvals.
- **H.R. 7458, "Domestic ORE Act"** (introduced 2026-02-10, House hearing 2026-02-24) would raise the notice threshold from **5 to 25 acres** and impose a 15-day completeness deadline. Pending, not law.
- **Forest Service proposed rule** (2026-02-20, 36 CFR 228A): objective thresholds, a new "Operating Notice" track, and a plan required over 5 acres or for non-exploration work. Comment period closed 2026-04-21. National-forest districts would play similarly to BLM ones.

**Game implication.** Three tiers, each with its own unlock:
- Casual: free, instant, panning only.
- Notice: 15-day wait, bond, max 5 ac, exploration and test pits, one bulk sample of under 1,000 t (about 700 yd³ in place; MK conversion at ~1.4 t per yd³).
- Plan: needed to produce any gold.
- A special-status-area flag on a claim forces the Plan tier and adds conditions.

## 5. Plan timelines: real data

| Project (field office, state) | Size / scope | Milestones | Elapsed |
|---|---|---|---|
| GAO-16-165 sample (BLM + USFS, FY2010–14) | 68 mine plans, all commodities | Submission to approval | **1 month to more than 11 years; average about 2 years** |
| Denton Gold Danser (Baker FO, OR) | Placer expansion: up to 100 ac across 5 sites over 16 yr, in a 250-ac area (was capped at 5 ac under a notice) | Draft EA comment closed 2025-04-17; decision 2025-09 | About 5 months after comment closed |
| Kast "Hidden Nugget and Sun Dog" (Vale/Baker, OR) | Placer: 3.25 ac across 13 sites over 26 yr, in a 75-ac area | Comment closed 2025-05-15; decision 2025-12 | About 7 months |
| Roarick Mine (Grants Pass FO, OR) | Placer on 22 ac of previously mined gravels; sluice, no chemicals | Draft EA comment 2025-12-18 to 2026-01-07; decision record issued early 2026 | Under about 3 months from comment (exact date unverified) |
| Mesa Gold (Ridgecrest FO, Kern Co., CA) | 5 ac dry-wash placer, 10-yr term, tortoise fencing | Comment closed Aug 4 (2025); approved 2025, the first new gold mine in eastern Kern in about 20 years | Months (verify dates) |
| McCune Bar sapphire placer (Butte FO, MT) | 2.5 ac proposed, 6.1 ac approved, 5-yr term | 30-day comment from 2025-08-07; approved later | Months |
| Persistence Mine (CA, Atolia area) | Placer | Draft EA 2025-08 | Pending at time of search |
| BLM Central Yukon FO (Circle/Central/Wiseman, AK) | Federal placer operations | 8 active (2021) to **18 active (2025)** | Growth with gold price |
| Fortymile district, AK (2013 testimony) | About 657 small placer operations statewide, **77 in Fortymile** | Miners report chronic BLM delays and withdrawal disputes | — |

- **Interpretation**
  - A *clean*, small, previously disturbed placer plan in 2025–26 typically took **4–9 months from public comment to decision**, plus 3–12 months of preparation and completeness back-and-forth before that.
  - Contested, novel or large plans take 1–3+ years.
  - Alaska plans are often approved for multiple years, and a well-documented renewal or amendment can clear in weeks to a few months (MK).
- **GAO's top delay causes:** (1) poor-quality operator submissions; (2) thin agency staffing. Both are things a "permitting specialist" hire could plausibly improve.

**Game implication.** Plan review time is lognormal, with a median of about 9 months and a 10–90% range of 4–30 months.
- A good specialist or consultant cuts the median by about 30% and the chance of an information request from about 50% to about 20%.
- Previously disturbed ground or an existing plan amendment applies a 0.5x multiplier. Special-status area: 1.5x. High public controversy: chance of an appeal or lawsuit adds 6–18 months.
- Suggested outcome odds (designer estimate): approved with conditions 70%, approved as filed 10%, sent back for more information 15%, denied or contested 5%.

## 6. Reclamation bonds (financial guarantees)

**How BLM sizes a bond (3809.552–.554; Handbook H-3809-1, Chapter 6)**
- The bond must equal the **full cost for BLM to hire a third party** to reclaim the site after the operator walks away, including BLM contract administration.
- Bonds are required for **every Notice and Plan**. BLM states certify bond reviews periodically.
- **Direct costs:** equipment hours x rate for backfill and recontouring, pond closure, topsoil and seeding, structure and camp removal, monitoring, plus mobilization.
  - BLM Alaska's bonding guide sets the hourly equipment rate at monthly rental ÷ 200 hours. It assumes a 120-day reclamation season, 10-hour days, 5 days a week, and 6 months of rental to cover mobilization.
- **Indirect add-ons**, from published RCE (reclamation cost estimate) examples:
  - contractor profit 10% and overhead 5%;
  - performance bond, payment bond and liability insurance about 1.5% each;
  - BLM contract administration 7–9.4%;
  - engineering redesign 5–6%;
  - scope contingency 10–12% plus bid contingency about 4%.
  - Total: **about 35–60% on top of direct cost**. California SMARA caps contingency at 10%.
- **Cost inflation.** The Nevada SRCE (Standardized Reclamation Cost Estimator) cost file rose **9.1% from 2023 to 2024**, with Davis-Bacon labor up 8.3%. It is updated every August.

**Per-acre magnitudes**

| Benchmark | $/acre | $/ha | Year / source |
|---|---|---|---|
| Alaska state default placer bond (mined area of 5 ac or more, state land) | **$750** | $1,853 | Current DNR APMA forms |
| Alaska bond pool cost (deposit + fee) | **$150 per year** | $371 | AS 27.19 / 11 AAC 97.425 |
| Alaska small-project RCE example, revegetation-type tasks | $316–$1,146 | $780–$2,830 | 2024 DNR estimate |
| Nevada exploration RCE example (Comstock, private land) | $5,414 | $13,380 | NDEP (year unverified) |
| Montana SMES placer bond | Actual estimate, capped at **$10,000 per operation** (5 ac or less) | — | DEQ |
| Full-cost BLM placer bond, lower 48 | **$3,000–$15,000** (MK estimate) | $7k–$37k | Scales with pond count, highwall, haul distance |
| Full-cost BLM placer bond, Alaska | **$1,500–$6,000** (MK estimate) | $3.7k–$15k | Remote mobilization pushes it up |

- Many reviewers consider the Alaska $750 per acre state figure well below true third-party cost. BLM Alaska therefore requires a detailed RCE for federal plans that use the pool (IM AK-2015-001).

**Acceptable instruments (3809.555)**
- Surety bond from a Treasury Circular 570 surety;
- cash held in a Treasury account;
- irrevocable letter of credit;
- CDs or savings accounts up to the FDIC limit;
- negotiable government or municipal securities, or AAA/AA-rated securities in an SIPC trust account;
- insurance rated A.M. Best "superior".
- **State-approved instruments and state bond pools** are allowed (3809.570–.571).

**State bond pools**
- **Alaska statewide bonding pool**, accepted on BLM land via a 2015 BLM–DNR cooperative agreement:
  - deposit of **15% of the bond, $112.50 per acre**, refundable on reclamation;
  - annual non-refundable fee of **5%, $37.50 per acre**.
  - Petroleum News: about $112 per acre is refunded if the ground is reclaimed the same season; part is retained for each year the ground stays unreclaimed.
- **Nevada Reclamation Performance Bond Pool**, accepted by BLM and NDEP:
  - **Notice level:** deposit 100% of the bond + 2% annual premium.
  - **Plan level:** deposit 50% rising linearly to 80% at the cap; premium **10% per year falling to 5% at the cap**, paid quarterly.
  - Cap: $3M per participant. Termination and **bond forfeiture if the premium is more than 70 days late**.
- **Commercial surety:** annual premium of about **1–10% of face**, depending on credit, history and collateral. New or small miners are often required to post substantial collateral (verify; trade sources).
- **Release (MK):** staged. Earthwork release comes after BLM inspection. Revegetation release takes one or more growing seasons. Bond forfeiture follows failure to reclaim after a noncompliance order.

**Game implication.** Bond = (direct reclamation $/ac x disturbed ac) x 1.45 indirect multiplier.
- Payment options: (a) full cash, which is locked up; (b) surety at 2–6% per year with 0–50% collateral, priced by owner and company credit; (c) a state pool where offered (AK: $150 per acre per year, 75% refundable).
- Reclaimed acres release the bond with a 1–2 season revegetation lag.

## 7. Clean Water Act section 402 (wastewater discharge)

- **Federal effluent guideline, 40 CFR 440 Subpart M** (gold placer mines and dredges using gravity separation):
  - BPT limit: **settleable solids 0.2 mL/L** (the lowest reading an Imhoff cone can measure).
  - BAT/NSPS (best available technology / new source standards) push toward **recycle**: process-water discharge limited to the excess over make-up water, which in practice means closed-loop operation with storm-event allowances (MK on details).
- **Alaska (APDES, state-run):**
  - General Permit **AKG370000 – Mechanical Placer Miners**. Effective **2023-06-01**, expires **2027-12-31**.
  - Covers process wastewater, dewatering water and drainage from open-cut mines and mechanical dredges.
  - Monitoring: **flow, settleable solids, turbidity, arsenic**, plus an annual report.
  - Annual authorization fee (18 AAC 72.956): **$315** for mechanical placer with a mixing zone. Small suction-dredge GP: $25. Medium suction-dredge GP: $90.
- **Alaska water quality standards:** turbidity must stay **within 5 NTU of natural conditions when natural turbidity is 50 NTU or less** (aquatic life and recreation), with settleable solids at 0.2 mL/L.
  - Turbidity complaints have driven TMDLs (total maximum daily load limits), e.g. **Upper Birch Creek, Circle district, EPA 1996**.
- **Lower 48:** most upland placer plants run closed-loop with settling ponds and no surface discharge, so no NPDES permit is needed. States may still require groundwater or WPCF-type permits, e.g. Oregon (MK).
  - Instream **suction dredging** needs an NPDES general permit where allowed: EPA Idaho GP; Oregon DEQ 700-PM (MK).
  - California has had a suction-dredge moratorium since 2009 (MK).
- **Penalty magnitudes**

| Case | What happened | Penalty |
|---|---|---|
| Samuel Turner Placer, Petersville AK (EPA CAFO, 2011) | Wash-plant water let into a ditch connected to Spruce Creek; spotted on a July 2010 overflight | **$8,000** |
| R.P. Rice Jr., Idaho (2015) | One day of unpermitted suction dredging, South Fork Clearwater River | **$3,600** |
| Shannon Poe, Idaho | **42 days** of unpermitted dredging; 9th Circuit affirmed Nov 2023; Supreme Court denied review July 2024 | **$150,000**, the largest CWA penalty against an individual in Idaho |

  - Statutory maxima (EPA, effective 2025-01-08):
    - civil judicial **$68,445 per day per violation**;
    - administrative **Class I $27,378 per violation, $68,445 cap**;
    - administrative **Class II $27,378 per day, $342,218 cap**.

**Game implication.** Discharge permit = a cheap general-permit tier ($315 per year in Alaska-like regimes) with a monitoring burden.
- The weekly turbidity-exceedance risk rises with feed rate above pond capacity, heavy rain, and a cheap or undersized pond design.
- Exceedance outcomes: a warning letter, then a CAFO of $5k–$25k for a first offense; repeat or willful violations run $50k–$150k+.

## 8. Clean Water Act section 404 (fill in streams and wetlands)

- **What triggers it:** any placement of dredged or fill material in waters of the U.S. This covers stream diversions or relocations, cuts and tailings in jurisdictional wetlands or floodplain channels, and pond berms in wetlands.
  - **Sackett v. EPA (May 2023)** narrowed wetland jurisdiction to wetlands with a continuous surface connection to relatively permanent waters (MK). Interior Alaska valley-bottom wetlands are often still jurisdictional.
- **NWP 44 (Mining Activities):** up to **½ acre** of loss of non-tidal waters or wetlands. Requires a pre-construction notification and a reclamation plan where other law requires one.
  - The 2026 reissuance (57 NWPs, published 2026-01-08) runs **2026-03-15 to 2031-03-15**.
  - If the Corps does not respond to a complete notification within **45 days**, the activity is generally authorized, except where ESA (Endangered Species Act) or historic-property conditions apply.
- **Alaska Regional General Permit for Mechanical Placer Mining** (POA-2014-00055, proposed as RGP-08):
  - Public notice 2025-07-16. Proposed term 2025-10-01 to 2031-10-31.
  - Changes the old **5-acre rolling footprint** to **10 acres of WOTUS total per 5-year term**.
  - **Excludes anadromous streams** and DEC-designated areas. Stream diversions limited to 1,500 ft, with a waiver process.
- **Corps processing in FY2024:** NWP pre-construction notifications averaged **55 days**; standard individual permits averaged **253 days**. More than 97% of Corps actions use general permits.
  - An individual permit adds a 401 water-quality certification and usually compensatory mitigation (MK).

**Game implication.** A claim attribute "wetland/stream fraction" decides the path:
- 0: no 404.
- Up to ½ acre of fill: NWP, about 2 months.
- Placer RGP in Alaska-like regimes: up to 10 acres per 5 years, no salmon streams.
- Otherwise: individual permit, median about 8 months, plus mitigation cost.
- Unauthorized fill leads to a restoration order plus an after-the-fact permit.

## 9. Water rights (prior appropriation)

- Western states and Alaska use **prior appropriation** ("first in time, first in right") (MK). A placer wash plant (MK: about 500–3,000+ gpm) needs an authorization.
- **Alaska:** a Temporary Water Use Authorization (TWUA) is required for:
  - consumptive use over **5,000 gallons per day from one source**; or
  - over **500 gallons per day for more than 10 days per year**; or
  - non-consumptive use over **30,000 gallons per day (0.05 cfs)**.
  - A TWUA lasts up to **5 consecutive years**. It creates **no priority** and is revocable. A permanent water right is a separate, slower application.
- **Nevada:** the State Engineer's **Mining and Milling waiver** costs a **$120 filing fee** and lasts **1 year at most**. Permits to appropriate carry statutory fees (e.g. $240 + $50 per cfs for stock-water permits; mining purposes have their own schedule; verify).
- **Dry country** (AZ, NV, southern CA deserts): water availability, not law, binds. Expect dry washers or trucked water and recirculation; the Mesa Gold plan uses no water at all.

**Game implication.** Northern claims: cheap TWUA (about 1–3 months, renew every 5 years) with a drought event that caps gpm.
- Desert claims: buy or lease water or a well, or run dry-wash equipment at lower recovery on fine gold.

## 10. State overlays, licenses and taxes (federal-land operations still need them)

| State | Reclamation / mining permit trigger | Notable numbers |
|---|---|---|
| Alaska | APMA (Application for Permits to Mine in Alaska): one consolidated application covering DNR land use and reclamation, DEC discharge, DF&G fish habitat, BLM coordination | Since 2025, approvals can run **up to 10 years** (was 5). Historic fees: $100 first year + $50 per later year (verify). Bond at 5 ac or more. **Annual reclamation statement due Dec 31.** Exempt: recreational dredges with a 6 in. or smaller hose and 18 hp or less. |
| Nevada | NDEP reclamation permit: exploration over 5 ac, or mining over 5 ac and/or **36,500 tons per year** | One surety satisfies both BLM and NDEP. |
| California | SMARA: more than **1,000 yd³** or more than **1 ac** requires a reclamation plan and financial assurance through the county lead agency | Contingency 10% or less. |
| Oregon | DOGAMI operating permit: more than **1 ac or 5,000 yd³ per 12 months** (placer: or more than 5 ac total) | Minimum cost about **$10–15k**: application fee of $1,750 or more, survey of $3k or more, security of $5k or more. |
| Arizona | Mined Land Reclamation Act: reclamation plan and financial assurance through the State Mine Inspector for more than **5 contiguous ac** (private land) | BLM land is handled through the BLM plan. |
| Montana | SMES (Small Miner Exclusion Statement): up to **2 operations of 5 ac or less each**; placer bond capped at $10,000 | Larger operations need a full operating permit. |

- **Taxes and licenses**
  - Alaska business license: **$50 per year** (2025).
  - Alaska mining license tax: **new mines exempt for 3.5 years**. Rates: 3% on net income from $40k to $50k; $1,500 + 5% from $50k to $100k; above $100k, **$4,000 + 7%** (9% was proposed in 2016; verify which is current).
  - Nevada net proceeds of minerals tax: **2–5%** sliding scale.
  - Arizona severance tax: **2.5% of the net severance base**.
  - Federal: income tax only, no federal royalty.

**Game implication.** Each district carries a state-overlay record: its acreage or volume trigger, a permit-prep cost of $2k–$15k, a review time of 1–6 months, and a tax formula. The Alaska-style regime (Phase 6) reuses the APMA fields.

## 11. MSHA (Mine Safety and Health Administration)

- **Jurisdiction:** every mine, regardless of size, including one-person seasonal placers.
  - Real case: Alaska Goldmine LLC (Pedro Creek, Fairbanks) refused MSHA entry in 2022 and was hit with 17 citations. DOL went back to federal court for an inspection order in April 2026.
- **Legal identity:** file **Form 2000-7** within **30 days of opening** to get a 7-digit Mine ID. MSHA must also be notified when operations start or stop (MK).
- **Training** (a commonly misunderstood point):
  - **Part 46** covers only sand, gravel, surface stone, surface clay, colloidal phosphate, surface limestone and shell dredging, plus similar non-metal operations.
  - **Gold placer is a metal mine, so Part 48 Subpart B (surface) applies:**
    - New miner: **24 hours**, of which **at least 8 before work duties**, with the remainder (up to 16) **within 60 days**, under close supervision until complete.
    - **Annual refresher: 8 hours.**
    - Plus task training, experienced-miner training and hazard training.
  - **The Part 48 training plan must be MSHA-approved and delivered by MSHA-approved instructors.** Part 46 lets the operator write its own plan.
  - Records go on Form 5000-23 (MK).
- **Inspections:** **at least 2 per year** for surface mines. Seasonal or intermittent operations are inspected less often, when found operating. Spot inspections follow complaints, as in the Alaska Goldmine case.
- **Enforcement tools:**
  - **104(a) citation** with an abatement deadline. **S&S** (significant and substantial) means reasonably likely to cause a reasonably serious injury (the Mathies test, MK).
  - **104(b) withdrawal order** if a violation is not abated in time: miners withdrawn from the area until it is fixed.
  - **104(d)** unwarrantable-failure chain.
  - **107(a)** imminent-danger order.
  - Pattern-of-violations status for chronic offenders.
- **Penalties (30 CFR 100).** The 2025 inflation-adjusted amounts stay in force for 2026 because the 2026 adjustment was cancelled:
  - Regular assessment range: **$168 – $90,649**.
  - 104(d)(1) minimum: **$3,022**. 104(d)(2) minimum: **$6,041**.
  - Failure to notify MSHA of an accident within 15 minutes: **$7,555 – $90,649**.
  - Failure to abate: up to **$9,820 per day**.
  - Flagrant violation: up to **$332,376**. Miner smoking violation: $414.
  - Formula points come from violation history, mine size (hours worked), negligence (up to 50 points), gravity (up to 88 points) and good faith. A **10% reduction** applies for timely abatement (MK).
- **Volume and averages**

| Year | Mines | Citations and orders | Assessed | Average per citation |
|---|---|---|---|---|
| FY2025, all mines | 12,568 | 87,372 | $62.4M | **≈ $714** |
| FY2024, all mines | ≈ 12,721–12,789 | ≈ 94,400–94,600 | $68.9–71.1M | **≈ $728–750** |
| 2024, metal/non-metal only | — | 55,693 (18% S&S) | $37.1M | **≈ $666** |

- **Small-mine citation examples** (FMSHRC sand-and-gravel cases, about 2021–22):
  - tail-pulley guarding (56.14107): **$139**;
  - S&S missing berm (56.9300): **$159**;
  - an older non-S&S berm citation: $50.
  - **Alaska Goldmine LLC (placer, 2022): 17 citations totalling $8,134**, about $478 each. Items cited:
    - damaged dozer windows;
    - no berms;
    - unguarded chain, belt, tail pulley and rollers;
    - unsloped highwall with loose material;
    - no flotation devices near water;
    - a jump-start van parked on a grade;
    - electrical box knockouts missing;
    - no traffic signs;
    - no first-aid supplies.

**Game implication.** MSHA registration is a one-time task, and new hires carry a training cost: 24 hours of paid time before full productivity, with 8 hours before day one.
- Two inspections per season. Expected citations per inspection = f(safety officer, equipment condition, housekeeping), with a typical small placer getting 2–8.
- Draw penalties lognormally around $300 (non-S&S about $150, S&S $500–$3,000).
- An unabated citation becomes a 104(b) order that idles the affected plant or machine until fixed.
- A rare flagrant or fatality event costs $50k–$300k+ and triggers an investigation.

## 12. Typical violations at small placer mines, by agency

| Agency | Common violation | Typical consequence / magnitude |
|---|---|---|
| BLM (3809) | Disturbance beyond notice or plan limits; mining under a notice; unreclaimed pits or ponds; unapproved occupancy or structures; lapsed bond | **Noncompliance order**, then **suspension**, then plan revocation or notice nullification, bond forfeiture and a U.S. Attorney civil action. Criminal referral under 3809.700 (FLPMA misdemeanor; MK: up to 12 months, with fines under the federal Alternative Fines Act). **BLM has no administrative civil-fine authority under 3809** (MK), so its leverage is stop-work, bond and standing. |
| EPA / state DEC (402) | Unpermitted discharge; turbidity or settleable-solids exceedance; missing monitoring or reports | CAFO of **$3.6k–$8k** (single-incident placer cases) up to **$150k** (repeat or defiant). Cap: $342,218 administrative. |
| Corps (404) | Unauthorized stream diversion or wetland fill | Cease-and-desist and restoration order, after-the-fact permit, possible referral (MK). |
| MSHA | Guarding, berms, highwalls, drowning hazards, first aid, mobile-equipment defects, training records | **$130–$500** each typically; 104(b) closure if unabated. |
| State reclamation | Missed annual reclamation statement (AK, Dec 31); acres over the bond | Permit hold, bond call, loss of bond-pool eligibility (MK). |

**Game implication.** Each violation adjusts four things: cash (fine), time (stop-work weeks), bond (forfeiture), and a **regulator-standing score**. The standing score multiplies future review times by 0.8x to 2x and raises inspection frequency.

---

## Suggested tuning constants (US-federal regime, as of 2026)

| Constant | Value |
|---|---|
| CLAIM_UNIT_ACRES | 20 |
| ASSOC_PLACER_MAX_ACRES | 160 |
| LOCATION_FEE | 49 (per claim) |
| PROCESSING_FEE_LOCATION | 25 (per claim) |
| MAINT_FEE_PER_20AC | 200 |
| FILING_FEE_PER_CLAIM | 15 |
| Fee due date | Sept 1 (week 35) |
| Affidavit due date | Dec 30 |
| BLM_RECORDING_WINDOW_DAYS | 90 |
| SMW_MAX_CLAIMS | 10 |
| SMW_LABOR_PER_CLAIM | 100 |
| NOTICE_MAX_ACRES | 5 |
| NOTICE_BULK_SAMPLE_TONS | <1,000 |
| NOTICE_WAIT_DAYS | 15 |
| NOTICE_TERM_YEARS | 2 |
| PLAN_COMMENT_DAYS_MIN | 30 |
| PLAN_REVIEW_MEDIAN_MONTHS | ~9 (lognormal) |
| BOND_INDIRECT_MULT | 1.45 |
| AK_POOL_PER_ACRE_DEPOSIT / FEE | 112.50 / 37.50 |
| NV_POOL_NOTICE | 100% deposit + 2%/yr |
| TURBIDITY_LIMIT_NTU_ABOVE_BG | 5 |
| SETTLEABLE_SOLIDS_ML_L | 0.2 |
| NWP44_MAX_ACRES | 0.5 |
| NWP_DAYS | ~55 |
| IP_DAYS | ~253 |
| MSHA_NEW_MINER_HRS / PRE_WORK_HRS / REFRESHER_HRS | 24 / 8 / 8 |
| MSHA_INSPECTIONS_PER_YEAR | 2 |
| MSHA_PENALTY_MIN / MAX / FLAGRANT | 168 / 90,649 / 332,376 |

---

## Sources

- https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-minerals/mining-claims/fees: BLM fee schedule ($25 / $49 / $200; placer per 20 acres).
- https://www.blm.gov/sites/default/files/docs/2025-07/2026_Mining_Season_508.pdf: 2026 mining-season packet (waiver due 2025-09-02; $15 affidavit and NOI; 10-claim rule).
- https://www.blm.gov/sites/default/files/docs/2026-03/2027_Mining_Season_508.pdf: 2027 packet (due 2026-09-01; $200 rates unchanged; Form 3830-2 no fee).
- https://www.blm.gov/sites/default/files/docs/2026-02/20260209_Encl.%207_MiningClaimFeesEffective.pdf: BLM fee table of 2026-02-09 ($15 fees; $1,600 for 141–160 ac; "may change July 1, 2026").
- https://www.federalregister.gov/documents/2024/07/01/2024-14301/required-fees-for-mining-claims-or-sites: 2024 CPI rule ($165→$200, $40→$49).
- https://www.federalregister.gov/documents/2025/09/02/2025-16755/revisions-to-regulations-regarding-locating-recording-and-maintaining-mining-claims-or-sites-fees and https://www.federalregister.gov/documents/2025/09/02/2025-16754/revisions-to-regulations-regarding-locating-recording-and-maintaining-mining-claims-or: 2025 DFRs (partial-payment order; effective 2025-11-03).
- https://www.federalregister.gov/documents/2025/07/17/2025-13399/rescission-of-regulations-regarding-plans-of-operations-for-mining-claims and https://www.federalregister.gov/documents/2025/09/25/2025-18595/rescission-of-regulations-regarding-operations-conducted-under-notices-for-mining-claims: 2025 3809 rescissions.
- https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-materials/annual-maintenance: waiver eligibility, Form 3830-2, Dec 30 affidavit.
- https://www.law.cornell.edu/cfr/text/43/3836.12 (via search extract): what counts as assessment work.
- https://www.blm.gov/sites/default/files/congressional_testimony_documents/Congressional_%2020170726_%20S.884%20Small%20Miner%20Waiver.pdf: 60-day cure for defective waivers; forfeiture for a missing affidavit.
- https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-minerals/mining-claims/recording: 90-day BLM recording.
- https://minerals.nv.gov/uploadedFiles/mineralsnvgov/content/Programs/Mining/MiningClaimFilingRequirementsInNV(1).pdf: Nevada $6 state filing fee; county fee practice.
- https://www.energy.senate.gov/services/files/CBC20CB4-BEC5-4F50-8D13-3C4539C513BC (DOI testimony): patent moratorium, 405 grandfathered and 221 frozen applications.
- https://www.blm.gov/press-release/after-nearly-50-years-interior-revoke-public-land-withdrawals-northwestern-alaska: 9.7M-acre d-1 revocation.
- https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-materials/surface-management and https://www.law.cornell.edu/cfr/text/43/3809.11: notice and plan thresholds; special-status areas.
- https://www.law.cornell.edu/cfr/text/43/3809.5, https://www.law.cornell.edu/cfr/text/43/3809.332, https://www.law.cornell.edu/cfr/text/43/3809.333 and https://ecfr.io/Title-43/Section-3809.311: casual use; notice term; 15-day review.
- https://www.law.cornell.edu/cfr/text/43/3809.555: bond instruments.
- https://www.law.cornell.edu/cfr/text/43/3809.411: plan review and 30-day comment.
- https://www.gao.gov/products/gao-16-165: 68 plans, 1 month to 11+ years, about 2-year average; causes of delay.
- https://www.govinfo.gov/content/pkg/FR-2026-02-24/pdf/2026-03708.pdf (DOI NEPA final rule) and https://perkinscoie.com/insights/update/department-interior-finalizes-major-overhaul-nepa-implementing-regulations: NEPA handbook; FRA deadlines and page limits.
- https://www.congress.gov/bill/119th-congress/house-bill/7458: Domestic ORE Act (25-acre notice proposal).
- https://www.govinfo.gov/content/pkg/FR-2026-02-20/pdf/2026-03364.pdf and https://www.minerallawblog.com/mining/the-forest-services-proposed-rule-on-locatable-minerals-clearer-thresholds-streamlined-review-what-it-means-for-idaho-and-the-west/: USFS proposed 228A rule.
- https://www.blm.gov/press-release/blm-seeks-comments-placer-gold-mine-expansion-proposal and https://www.blm.gov/announcement/blm-vale-issues-decision-mining-plan-operations-and-occupancy: Denton Gold Danser.
- https://www.blm.gov/announcement/blm-issues-decision-record-environmental-assessment-hidden-nugget-sun-dog and https://www.blm.gov/announcement/blm-seeks-input-proposed-gold-mining-kast-claims-baker-county: Kast claims.
- https://www.blm.gov/announcement/blm-seeks-initial-input-proposed-gold-mine-near-cave-junction, https://www.blm.gov/announcement/decision-notice-roarick-mine-environmental-assessment and https://www.theivnews.com/2026/01/14/residents-tour-site-of-proposed-22-acre-gold-mine-near-holland/: Roarick.
- https://www.blm.gov/announcement/blm-approves-mesa-gold-mining-plan-kern-county and https://www.blm.gov/announcement/blm-seeks-input-proposed-five-acre-mining-project-kern-county: Mesa Gold.
- https://www.blm.gov/announcement/blm-seeks-comments-proposed-placer-mining-lewis-and-clark-county-montana and https://www.blm.gov/announcement/blm-approves-sapphire-mining-project-lewis-and-clark-county: McCune Bar.
- https://www.doi.gov/sites/default/files/documents/2025-08/21-report2025-october-blm-central-yukon-field-office-reportfinal508.pdf: CYFO had 18 active federal placer operations in 2025.
- https://naturalresources.house.gov/UploadedFiles/MaierTestimony10-10-13.pdf: 657 Alaska placer operations, 77 in Fortymile (2013).
- https://www.blm.gov/policy/ak-im-2015-001, https://www.blm.gov/sites/blm.gov/files/policies/Policy_IMAK2015-001_a3_Cooperative_Agreement%20between_BLM_and_ADNR.pdf and https://www.petroleumnews.com/pnarchpop/828865920.shtml: Alaska pool accepted on BLM land; $150 per acre; RCE requirement.
- https://www.blm.gov/sites/blm.gov/files/documents/files/Minerals_Alaska_Reclamation_Bonding_Guide-Ver10.pdf: BLM Alaska RCE method (rental ÷ 200 hours; 120-day season).
- https://dnr.alaska.gov/mlw/forms/apma/2024/pdf/2024-Reclamation-Plan-Placer.pdf and https://regulations.justia.com/states/alaska/title-11/part-6/chapter-97/article-4/section-11-aac-97-425: $750 per acre; 15% deposit + 5% fee; Dec 31 annual statement.
- https://www.idl.idaho.gov/wp-content/uploads/sites/2/rulemaking/20.03.02-2019/research/Indirect_Cost_Comparison.pdf and https://www.blm.gov/policy/im-2009-153: RCE indirect-cost percentages.
- https://ndep.nv.gov/land/mining/reclamation/reclamation-cost-estimator and https://ndep.nv.gov/uploads/land-mining-recl-rce-docs/20240805_2023-2024_SRCE_Anual_Cost_Comparison_Final.pdf: SRCE +9.1% (2024).
- https://minerals.nv.gov/uploadedFiles/mineralsnvgov/content/Programs/BP/BP_RegsInANutshellForPOO_20251104.pdf and https://www.minerals.nv.gov/siteassets/content/programs/bp/bp_regsinanutshellfornla_20251104.pdf: Nevada bond pool terms (Nov 2025).
- https://deq.mt.gov/files/Land/Hardrock/Forms/SMES/SMESInformationandFAQ.pdf: Montana SMES $10k placer bond cap; 2 x 5 acres.
- https://www.epa.gov/sites/default/files/2015-10/documents/ore-mining_gold-placer-subcat_dd_1988.pdf and https://www.law.cornell.edu/cfr/text/40/440.140: 40 CFR 440 Subpart M.
- https://dec.alaska.gov/media/12688/akg370000-ar-form-141212.pdf and https://regulations.justia.com/states/alaska/title-18/chapter-72/article-7/section-18-aac-72-956: AKG370000 monitoring; $315, $25 and $90 fees; 2023–2027 term.
- https://dec.alaska.gov/media/14702/upper-birch-creek-turbidity-tmdl-epa-1996.pdf: 5 NTU standard; 0.2 mL/L.
- https://www.epa.gov/archive/epapages/newsroom_archive/newsreleases/5d467c2273b76c2a852578450075750d.html: Samuel Turner $8,000 CAFO.
- https://archive.epa.gov/epa/newsreleases/epa-settles-idaho-gold-miner-clean-water-act-discharge-violation.html: Rice $3,600.
- https://idahoconservation.org/blog/court-levies-150000-fine-against-suction-dredge-miner-who-polluted-idahos-clearwater-river and https://idahocapitalsun.com/2024/07/08/scotus-declines-to-review-case-of-california-gold-miner-who-violated-clean-water-act-in-idaho/: Poe $150,000; 42 days.
- https://www.govinfo.gov/content/pkg/FR-2025-01-08/html/2025-00206.htm: EPA 2025 penalty inflation figures.
- https://www.govinfo.gov/content/pkg/FR-2026-01-08/pdf/2026-00121.pdf and https://environmentalhealthsafetybrief.sidley.com/2026/01/09/u-s-army-corps-of-engineers-finalizes-2026-nationwide-permit-reissuance-and-modifications/: 2026 NWPs.
- https://aws.state.ak.us/OnlinePublicNotices/Notices/Attachment.aspx?id=156162 and https://aws.state.ak.us/OnlinePublicNotices/Notices/View.aspx?id=220223: Alaska placer RGP (10 ac per 5 years; no anadromous streams; July 2025 notice).
- https://policyrisk.com/federal-register/2026-00121 (search extract citing the Corps): FY2024 averages of 55 days (NWP) and 253 days (individual permit).
- https://dnr.alaska.gov/mlw/water/twua/ and https://dnr.alaska.gov/mlw/cdn/pdf/factsheets/water-rights-in-alaska.pdf: TWUA thresholds; 5-year term.
- https://water.nv.gov/uploads/water-docs/4024F_Mining_and_Milling_MM_Waiver.pdf and https://water.nv.gov/uploads/water-docs/6-2024_Statutory_Fees.pdf: Nevada $120 waiver; statutory fees.
- https://dnr.alaska.gov/mlw/mining/apma/ and https://dnr.alaska.gov/mlw/forms/apma/2025/pdf/2025-APMA-Complete-Application.pdf: APMA terms of up to 10 years.
- https://www.ndep.nv.gov/uploads/land-mining-docs/reclamation_permit.pdf: Nevada 5-acre and 36,500-ton triggers.
- https://www.inyocounty.us/services/planning-department/surface-mining-and-reclamation-act-smara: SMARA 1,000 yd³ / 1 acre thresholds.
- https://www.oregon.gov/dogami/mlrr/Pages/surfacemining.aspx and https://apps.oregonlegislature.gov/liz/2017R1/Downloads/CommitteeMeetingDocument/114454: DOGAMI thresholds; $10–15k minimum cost.
- https://asmi.az.gov/node/136: Arizona AMLRA 5-acre trigger.
- https://law.justia.com/codes/alaska/title-43/chapter-65/: Alaska mining license tax brackets; 3.5-year exemption.
- https://tax.nv.gov (net proceeds bulletin) and https://law.justia.com/codes/arizona/2005/title42/05202.html: Nevada 2–5%; Arizona 2.5%.
- https://www.commerce.alaska.gov/web/Portals/5/pub/bus4181.pdf: Alaska $50 business license.
- https://www.govinfo.gov/content/pkg/CFR-2013-title30-vol1/xml/CFR-2013-title30-vol1-part48.xml and https://www.law.cornell.edu/cfr/text/30/48.25: Part 48 rules (24 hours, 8 before work, 60 days).
- https://blogs.mtu.edu/mine-safety/part-46-vs-48-faq/ and https://arlweb.msha.gov/training/part46/compguide/compguide.pdf: Part 46 scope (sand, gravel, stone and similar).
- https://www.msha.gov/p13-iii-01-0 and 30 CFR 41.11: Form 2000-7 within 30 days.
- https://www.msha.gov/regulations/rulemaking/department-labor-federal-civil-penalties-inflation-adjustment-act-catch and https://www.msha.gov/sites/default/files/Assessments/Special_Assessment_GENERAL_PROCEDURES-2025.pdf: 2025 penalty amounts.
- https://www.fisherphillips.com/en/insights/insights/what-mine-operators-need-to-know-about-no-increase-to-safety-fines: 2026 adjustment cancelled.
- https://www.msha.gov/sites/default/files/MSHA-Glance/FY2025-MSHA-At-A-Glance.pdf and https://www.msha.gov/sites/default/files/Data_Reports/Charts/FY2024-MSHA-ataGlance-1-31-2025.pdf: citation and dollar totals.
- https://fmshrc.gov/sites/default/files/decisions/alj/ALJd_6032022-LAKE%202021-0122.pdf: $139 guarding and $159 berm examples.
- https://adn.com/business-economy/2023/09/23/us-department-of-labor-asks-federal-judge-to-force-inspections-of-fairbanks-area-gold-mine/ and https://alaskabeacon.com/2026/04/28/labor-department-seeks-federal-court-order-to-inspect-alaska-gold-mine/: Alaska Goldmine (17 citations, $8,134; 2026 court action).
- https://www.msha.gov/compliance-enforcement/mine-inspections: 2 inspections per year for surface mines.
- https://www.law.cornell.edu/cfr/text/43/3809.604 and https://govinfo.gov/content/pkg/CFR-2011-title43-vol2/pdf/CFR-2011-title43-vol2-sec3809-601.pdf: BLM noncompliance and suspension orders; civil action; 3809.700 criminal.
