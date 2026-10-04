# R5: Small-business finance, the gold market, and taxes (fact sheet)

Prepared 2026-10-04 for Gold Mining Tycoon system designers (§10 Market, §11 Finance; also §6 bonds and §8 payroll burden).
Everything is in USD, troy oz (ozt) and cubic yards unless noted.

**Verification status. Read this first.** This session had no working web access. The shared WebSearch budget was already used up, and WebFetch was blocked by the egress proxy for every domain tried (sba.gov, irs.gov, ssa.gov, uscourts.gov, law.cornell.edu, law.justia.com, kitco.com, gold.org, fred.stlouisfed.org, wikipedia.org).
- **[M]** means *(unverified, from model knowledge)*, with a knowledge cutoff of about mid-2026. Every [M] figure needs a check before it is shipped as "real".
- **[V-R1] / [V-R2]** means the figure was verified from primary sources by the sibling sheets R1 and R2 in this folder. I have not re-checked them.
- **[D]** means I derived or calculated the figure from the inputs shown.
- **Not checked this session:** the October 2026 gold spot price, the prime rate after early 2026, and the FY2026 SBA fee schedule.

---

## Most important numbers

1. **Rate ladder for 2026.** Prime was **6.75%** after the 2025-12-10 Fed cut, held into early 2026 [M]. Typical all-in rates by lender [M]:

   | Lender | Rate |
   |---|---|
   | Local bank term loan | prime + 1–3% (7.75–9.75%) |
   | SBA 7(a) over $350k | capped at prime + 3% (9.75%) |
   | Equipment finance, A-tier | 7.5–9.5% |
   | Equipment finance, B-tier | 10–14% |
   | Equipment finance, C-tier | 14–20% |
   | Equipment finance, D-tier / startup | 20–30% |
   | Dealer captive promo (new iron, A-tier only) | 0–3.99% |
   | Hard money | 12–18% + 2–5 points |
   | Business cards | 20–29% APR |
   | Merchant cash advance | 40–150% effective APR |

2. **Most community banks restrict or prohibit mining.** Unpatented claims have almost no collateral value. Lending happens against the iron, any patented land, and the owner's personal assets, and is backed by an **unlimited personal guarantee (PG) from every owner of 20% or more** [M].
3. **Covenant norms.** DSCR (debt service coverage ratio) **≥ 1.20–1.25x**, tested on the trailing 12 months. Total liabilities to tangible net worth **≤ 3–4x**. A minimum-liquidity test. **Annual CPA statements within 90–120 days** of year end. A **monthly borrowing-base certificate** on revolvers [M].
4. **Default timeline.**
   - Late fee after a **10–15 day** grace period.
   - Reported to credit bureaus at **30 days** past due.
   - Default notice and acceleration at **60–90 days**.
   - Self-help repossession under UCC 9-609, with no court needed if there is no breach of the peace.
   - Auction yields **40–70% of retail**, less 5–10% commission. The **deficiency is still owed by the guarantor** [M].
5. **Selling gold.**
   - Local buyer: **~75–90% of fine-gold value**, in cash the same day.
   - Refinery: **~97–99% of fine value** net of fees on lots of 50 oz or more, falling to ~93–97% on 5–10 oz lots. Cash arrives **3–10 business days** after the refinery receives the gold.
   - Melt loss is **1–5% of raw weight** on clean gold (R3). It is mostly not gold [M/D].
6. **Gold price statistics.**
   - Long-run volatility is **~16% a year**, a **weekly σ of about 2.2%** [M/D]. Realized volatility ranges from 8% to 45%.
   - Drawdowns: **−65% (1980–82)**, **−70% nominal over 1980–99**, **−33% in 7 months (2008)**, **−45% (2011–15)**, **−22% (2020–22)** [M].
   - Price doubled within about 3 years in 2008–11 and again in 2022–25 [M].
7. **2024–26 regime.** Gold rose **+27% in 2024** and about **+64% in 2025**. It first closed above **$4,000 on 2025-10-08** and peaked near **$4,380 on 2025-10-20** (R2 confirms a record of C$6,114 that day). A record near **$5,500 in late January 2026** was followed by a one-day fall of about **9–10% on 2026-01-30** [M]. The $4,200 seed is a plausible "recent" level but probably sits **below** 2026 spot.
8. **U.S. federal tax (2026).**
   - C-corporations pay **21%**.
   - Pass-through owners pay **10–37%** on income plus **self-employment (SE) tax of 15.3%** up to the **$184,500** wage base, then **2.9%** above it.
   - The **20% QBI deduction is now permanent** under OBBBA (P.L. 119-21, signed 2025-07-04).
   - **100% bonus depreciation is permanent** for property acquired after 2025-01-19. **§179** allows **$2.5M**, phasing out from **$4.0M**.
   - **Percentage depletion for gold is 15%** of gross income from the property, capped at **50% of that property's net income**.
   - **NOLs** carry forward indefinitely but offset at most **80%** of taxable income [M].
9. **Payroll burden.**
   - Employer FICA is **7.65%**. FUTA is **0.6% on the first $7,000** ($42 per employee). SUTA is **~1–5.4%** on a **~$42–55k** wage base. Workers' comp for surface mining runs **~$3–12 per $100 of payroll**. Together that is **≈ 1.18–1.30x wages** [M/D].
   - Withheld taxes that are not deposited trigger the **100% Trust Fund Recovery Penalty, assessed personally**. Bankruptcy does not discharge it [M].
10. **State taxes.**
    - **Alaska:** mining license tax of **0% up to $40k of net income, $4,000 + 7% above $100k**, with a **3.5-year new-mine holiday** [V-R2]. Plus a **3% net-income royalty on state land** [V-R2] and corporate income tax up to **9.4%** [M].
    - **Nevada:** no corporate or personal income tax. **Net Proceeds of Minerals tax of 2–5% of net proceeds** [V-R1 range]. The gold excise tax applies **only above $20M gross** [M].
    - **Subchapter V** (small-business Chapter 11) debt limit is **$3,424,000** (from 2025-04-01) [M].

---

## 1. Rate environment and lender landscape (2025–2026)

**Prime rate [M].**
- **7.50%** from December 2024 through mid-September 2025.
- **7.25%** from 2025-09-17, **7.00%** from 2025-10-29, **6.75%** from 2025-12-10.
- It appeared to be held in early 2026. Changes after that are unverified.
- Prime is set at Fed funds upper bound + 3.00%, which is how the anchor `prime = base + 3%` is built.

**Lender appetite tracks gold [M].**
- In the 2013–15 bust, junior mining equity raises fell roughly 60–80%, equipment lenders added mining to their restricted lists, and auction prices for used iron dropped.
- In 2024–26, with record margins, equipment lenders and private capital returned. Banks stayed cautious.

**Equipment-finance industry health, 2025 (ELFA-type portfolio data) [M].**
- 30+ day delinquencies about 1.8–2.5%.
- Charge-offs about 0.4–0.7% a year.
- Credit approval rates about 75–78%.

These are prime-heavy portfolios. Mining and startup borrowers default several times more often.

> **Game implication:** use `finance.primeRate = market.baseRate + 0.03` and price every product as prime + a spread chosen by credit tier and lender type. Apply a `lenderAppetite(goldTrend)` multiplier, for example spreads +1–3 points and maximum LTV −10–20 points when the 52-week gold trend is below −15%.

---

## 2. Local and community banks and mining [M]

**Typical stance.** Mining, and gold placer above all, sits on many community banks' restricted or prohibited industry lists. The reasons:
- commodity volatility and seasonality;
- remote collateral that is hard to inspect or repossess;
- environmental lender liability (CERCLA "operator" exposure);
- examiners' scrutiny of concentrated, high-risk credits.

**What they will lend against.**
- New or late-model equipment: **≤ 75–80% of cost**, or **50–70% of appraised orderly-liquidation value (OLV)** for used units.
- Patented or private land: **50–65% of appraised value**.
- CDs or cash: up to 90–100%.
- The owner's home equity.

**Unpatented claims** are mortgageable possessory interests, but they get **little or no collateral value**. Their validity depends on discovery and on fees being paid, and title insurance is generally not available.

**Requirements.**
- **2–3 years of tax returns showing profit.**
- A PG from every owner of 20% or more.
- Global cash flow, meaning business plus personal, **≥ 1.25x**.
- Deposit relationship required, often the operating account.
- Annual renewal of credit lines.

**Pricing.**
- Term loans and lines: **prime + 1–3%**, with 0.5–1% origination.
- Equipment terms of 3–7 years; real estate amortizing over 15–25 years with a 5–10 year balloon.

**Northern reality.** A few Alaska banks with long resource-industry books will lend to established placer families on equipment, but rarely to newcomers. State programs (for example AIDEA loan participations) exist mainly for larger projects.

> **Game implication:** the local bank should **decline every borrower without 2 or more profitable seasons**. After that it is the cheapest money in the game, and its covenants are the strictest. The "banker" owner background might relax the first rule.

---

## 3. SBA programs [M]

**SBA 7(a) maximum interest rates** (SOP 50 10 7 and later, still in force in 2026).

| Loan size | Maximum variable rate |
|---|---|
| ≤ $50k | prime + 6.5% |
| $50k–$250k | prime + 6.0% |
| $250k–$350k | prime + 4.5% |
| > $350k | prime + 3.0% |

Fixed-rate caps run from about prime + 8% at ≤ $25k down to prime + 5% above $250k.

**Other 7(a) terms.**
- **Maximum loan:** $5M.
- **Guarantee:** 85% of loans ≤ $150k, 75% above.
- **Upfront guarantee fee:** about **2–3.75% of the guaranteed portion** (FY2025–26 schedule; FY2024 waived it for loans ≤ $1M). Plus an annual service fee of about 0.55%.
- **Maturity:** working capital and equipment up to **10 years** (equipment can run to its useful life, about 15 years at most); real estate **25 years**.
- **Prepayment penalty:** 5% / 3% / 1% in years 1–3, only on loans of 15 years or more.

**SOP 50 10 8 (effective 2025-06-01) tightened underwriting.**
- Minimum **FICO SBSS score for 7(a) small loans raised from 155 to 165**.
- **10% equity injection** for startups (under 1 year in business) and changes of ownership.
- PG from every owner of 20% or more.
- Loans over $50k must take all available collateral, including liens on personal real estate with **at least 25% equity**.
- Hazard insurance required.
- A 2025 policy notice required **100% ownership by U.S. citizens, nationals or permanent residents** (rolled out in 2025–26; check the effective date).
- The SBA's own **DSCR floor is about 1.15x**, but lenders usually require **1.25x**.

**Mining eligibility.**
- Placer gold mining is NAICS **212220** (gold ore and silver ore mining). The size standard is about **1,500 employees**, so any small miner qualifies on size.
- **Speculative** businesses are ineligible. The regulations use oil "wildcatting" as an example, and lenders apply the same logic to **exploration without a proven, producing resource**.
- In practice, SBA is reachable for an **operating mine with production history**, and almost never for a startup on untested ground.

**SBA 504.**
- For fixed assets with a 10-year-plus life, such as real estate or heavy long-life equipment.
- Structure: **50% bank first lien, 40% CDC debenture, 10% borrower** (15% for a startup or a special-purpose asset, 20% for both).
- 10- and 25-year debenture rates of about **6.0–6.7%** in 2025–26.
- Usually tied to job creation (about 1 job per $90k).
- Not designed for working capital.

**CAPLines.**
- SBA's seasonal and working-capital revolvers: up to $5M, maturity up to 10 years.
- The **Seasonal CAPLine** fits a placer miner's spring cash need, but it requires a track record.

**Speed.** 30–90 days from application to funding (SBA Express, ≤ $500k, can be faster).

> **Game implication:** make an "SBA-backed bank loan" product. Gate it on 2 or more seasons of production, an owner FICO of 680 or more, an SBSS of 165 or more, and 10% equity. Rate = prime + 2.25–3%, fee = 3% of the guaranteed portion, term 10 years. Approval takes 6–12 weeks, so applying during the off-season has to be planned.

---

## 4. Equipment finance, captive finance and leases [M]

**Rates and terms by credit tier (2025–26).**

| Tier | Typical borrower | Rate (APR) | Down payment | Term |
|---|---|---|---|---|
| A | FICO 720+, 2+ years in business, profitable | 7.5–9.5% (prime + 0.75–2.75) | 0–10% | 36–72 mo (84 on new heavy) |
| B | FICO 680–719 or thin financials | 10–14% | 10–15% | 36–60 mo |
| C | FICO 620–679 or under 2 years | 14–20% | 15–25% | 24–48 mo |
| D / startup subprime | FICO < 620, past derogatories | 20–30%+ | 20–35% | 12–36 mo |

**Rules that apply across tiers.**
- **Used equipment:** add 1–3 points. Lenders often cap equipment age plus term at **10–12 years**.
- **Startup programs** (under 2 years in business) need a personal FICO of **680–700 or more** and are capped at about **$100–250k per deal**.
- Many equipment lenders list **mining (especially precious-metal) as a restricted or high-risk industry**. They respond with a higher down payment, a shorter term, or a decline.

**Dealer captive finance** (for example Cat Financial, Deere Financial, Komatsu Financial, Volvo Financial).
- **0% for 36–48 months** on selected new models during promotions.
- **0.9–3.99% for 48–60 months**; **4.9–6.9% at 72 months**.
- **A/B credit only.**
- Promotional rates often replace a cash rebate of about **3–8%**, so 0% is not free.
- Captives lend more readily to miners than banks do because they understand the iron and can remarket it.
- Captives offer **skip-payment and seasonal plans** (see §5).

**Leases.**
- **FMV (operating) lease** payments: about **1.6–2.4% of cost per month** over 36–60 months, with return or buy at the end.
- **$1-buyout (finance) lease:** this is a purchase for tax purposes, so the lessee depreciates the machine.
- **10% put lease:** in between the two.
- **Accounting:** under ASC 842, leases over 12 months go on the balance sheet as a right-of-use asset and a lease liability.
- **Tax:** true-lease rent is deductible as paid.

**Rental and rent-to-own.**
- Monthly rental ≈ **3–5% of replacement cost**. Weekly ≈ 1/3 of monthly; daily ≈ 1/3 of weekly.
- Rent-to-own credits **50–80%** of rent paid toward the purchase.

**Worked payments [D]** (standard amortizing payment).

| Loan | Monthly payment | Total interest |
|---|---|---|
| $400k at 9%, 60 months | $8,303 | $98k |
| $400k at 14.9%, 60 months | $9,495 | $170k |
| $400k at 0%, 48 months (captive promo) | $8,333 | $0 (forgone rebate of about $12–32k) |
| $250k at 16%, 36 months | $8,789 | $66k |

> **Game implication:** `equipmentLoanRate = prime + tierSpread[tier] + usedAdder + miningAdder(lender)`. Captive promotions are available only on **new** units, to **A/B** borrowers, and with a forgone cash discount. This gives the player a real "0% vs. 5% off" choice.

---

## 5. Seasonal and skip-payment structures [M]

**Structures in common use.**
- **Skip payments:** commonly **3–6 skipped months a year**, so the borrower pays 6–9 months. Interest keeps accruing during skips.
- **Seasonal schedules:** payments are concentrated in the months with revenue.
- **Annual or semi-annual payments:** common in ag finance and available from some captives.
- **Interest-only during the off-season:** for example November–May.

**Who qualifies.** A/B credit and a documented seasonal revenue history (2 or more seasons). C/D borrowers get level monthly payments.

**Example [D].** $400k at 9% over 5 years, paid only June–November (6 payments a year):
- 6 payments of **$16,861**, or **$101k a year**.
- A level schedule costs **$99.6k a year**.
- The seasonal plan costs about **1.5% more** in interest but removes about **$50k** of debt service from winter and spring.

**Bank lines for seasonal businesses.** Most require an **annual 30-day "clean-up"** with the line at zero. For a placer miner it is usually set for **November–December**, after the gold has sold.

> **Game implication:** `PaymentSchedule = 'level' | 'skip' | 'seasonal' | 'annual'`, offered only when `creditTier ≤ B && seasonsOfHistory ≥ 2`. It is the main fix for the brief's "core cash-flow problem".

---

## 6. Hard money, private lenders and other last-resort capital [M]

**Hard money and private lenders** (secured by equipment or land).
- Interest **12–18%**, typically 13–15%. **Origination 2–5 points.** Exit fee 1–2%.
- **Interest-only, 6–36 months, with a balloon.**
- LTV **50–70% of OLV**, or **40–60% of forced-liquidation value (FLV)**.
- Default rate **18–24%**. Closes in **1–3 weeks**.

**Valuation ladder used for collateral.**
- **FMV** (fair market value) = retail used price.
- **OLV** ≈ 70–85% of FMV, for a sale in 3–6 months.
- **FLV** ≈ 50–70% of FMV, for auction in 30–60 days.

**Merchant cash advance (MCA).**
- Buys future receivables at a **factor rate of 1.15–1.50**, repaid by daily or weekly debits over 3–12 months.
- Effective **APR 40–150%+**.
- Often a death spiral for seasonal businesses, because the debits keep running in winter.

**Sale-leaseback of equipment.**
- Raises 50–80% of FMV at an implied rate of **12–20%**.
- Gain over tax basis triggers **§1245 recapture** as ordinary income.

**Family and friends notes.** Usually 0–10%, unsecured and subordinated. They keep relationships at risk rather than assets.

> **Game implication:** hard money should be the "fast, expensive, always available if you have iron" option, approved in 1–2 turns. Price an MCA as a factor rate with weekly debits so it visibly bleeds cash in the off-season.

---

## 7. Revolving lines of credit and the borrowing base [M]

**Bank line of credit (LOC).**
- $50k–$1M for small borrowers, at **prime + 1–3%**.
- Commitment fee 0.25–1%; unused-line fee 0.25–0.5% a year.
- Blanket UCC-1 lien on all business assets, plus a PG.
- 12-month term, renewed annually; a 30-day clean-up is common.

**Borrowing-base advance rates** (standard asset-based lending practice).

| Asset | Advance rate |
|---|---|
| Eligible receivables | **75–85%** |
| Finished-goods inventory | **50–65% of cost**, or up to **85% of net orderly liquidation value** |
| Raw materials | lower |
| Work in process | ~0% |
| **Refined gold in an approved third-party vault** (with a bailee or control agreement, marked to market daily) | **70–85% of spot** |
| **Gold delivered to a refinery and awaiting settlement** (a receivable from a creditworthy refiner) | **80–90%** |
| **Raw gold in the miner's own safe** (no third-party control, unassayed) | **ineligible** or 0–50% |
| Gold in the ground or in a stockpile | **0%** |

**Receivable ineligibles:** over 90 days past due, cross-aged accounts, concentration above 25%, related parties, foreign accounts.

**Reporting.** A **borrowing-base certificate monthly** (weekly when stressed). **Field exams 1–2 times a year at $5–15k each** (often waived under about $1M). An over-advance must be cured within days.

> **Game implication:** `borrowingBase = 0.80 × refineryReceivables + 0.75 × vaultedFineOz × spot + 0 × campGold`. That rewards shipping gold to a refinery or vault rather than hoarding it in camp. A falling gold price shrinks the base and can force a paydown, which is a realistic squeeze.

---

## 8. Business credit cards and vendor credit [M]

**Business credit cards (2025–26).**
- Purchase APR about **18–29%** (median about 23–24%, with Fed G.19 consumer averages around 21–23%).
- Cash advance about **29%** plus a 5% fee.
- Opening limits for a new business **$2k–$25k**.
- **A personal guarantee is always required.**
- Charge cards (pay in full each month) carry no APR but charge late fees of about 2.5–3%.

**Vendor and trade credit.**
- Parts and supplies: **net 30**, or **"2/10 net 30"**. Taking the 2% discount is worth about **37% annualized**.
- Fuel distributors: **net 10–30** for established accounts, **COD or prepay** for new ones.
- Remote sites buy **bulk fuel prepaid** in winter or on barge schedules.
- Late charges **1.5% a month (18% APR)**.
- Vendors pull trade references and may want a **PG**.
- Unpaid suppliers and laborers can file **mechanics' or miners' liens** on the mine and its output in western mining states (check each state's statute).
- Dealer parts accounts may require a credit application and run 2–4 weeks to set up.

> **Game implication:** vendor credit is free 30-day float with a hard limit. Paying late adds 1.5% a month and damages the company's Paydex. After 60–90 days unpaid, the vendor puts the account on COD and may file a lien, which blocks sale of the claim.

---

## 9. Personal guarantees, covenants, default, repossession and cross-default [M]

**Personal guarantees.**
- Nearly universal for small-business credit. Usually **unlimited, joint and several**.
- SBA requires them from every owner of 20% or more. Limited guarantees are possible for minority owners.
- **Reg B (ECOA)** bars lenders from requiring a **spouse's** guarantee unless the spouse co-owns the business or the pledged collateral.

**Common covenants.**
- **DSCR ≥ 1.20–1.25x**, defined as (EBITDA − cash taxes − distributions) ÷ (principal + interest). Mining-focused lenders may ask 1.35–1.5x.
- **Total liabilities to tangible net worth ≤ 3–4x**, or **funded debt to EBITDA ≤ 3–3.5x**.
- **Minimum liquidity**, for example unrestricted cash of at least 3 months' debt service or a fixed dollar amount.
- **Minimum tangible net worth.**
- Capital-expenditure limits.
- No new debt or liens without consent (negative pledge).
- Restrictions on distributions.
- Change-of-control and key-person clauses.
- Insurance with the **lender named as loss payee**.

**Reporting covenants.**
- Annual CPA-reviewed or compiled statements within **90–120 days** of year end.
- Quarterly interim statements within **45 days**.
- Annual personal financial statement and tax returns from each guarantor.
- Borrowing base monthly.
- Late reporting is a **technical default**.

**Breach consequences.**
- Waiver fee **$500–$5k**.
- **Default interest +2–5%**.
- Repricing, required paydown or extra collateral.
- Forbearance agreement, then acceleration.
- Bank **setoff** against the borrower's deposit accounts.

**Payment default sequence.**
1. Grace period of **10–15 days**, then a **late fee of about 5% of the payment** (capped by state law).
2. **30 days** past due: reported to the business bureaus (SBFE, D&B, Experian). It reaches **personal** reports if the borrower's account or the guarantee is reported, or once it is charged off or sent to collections.
3. **60–90 days:** notice of default and acceleration. Equipment lenders move faster (**30–60 days**) because the collateral is mobile and depreciating.

**Repossession under UCC Article 9.**
- **Self-help repossession** is allowed without breach of the peace (9-609).
- The lender must send a **reasonable authenticated notice of disposition**. **10 days** is a safe harbor in commercial deals (9-611/9-612).
- Disposition must be **commercially reasonable**, usually by auction.
- Costs: recovery, transport and storage of **$1.5–10k per machine** in road-accessible areas, much more at fly-in sites. Auction commission **5–10%**.
- The **deficiency** (balance minus net proceeds) remains owed by the company and guarantors. Any surplus goes back to the debtor.

**Cross-default and cross-collateral.**
- A default on any other debt (often above a threshold of $25–100k) defaults this loan too.
- **Dragnet or cross-collateral clauses** let one lender's collateral secure all debts owed to it, so paying off one machine does not free its title.
- **Blanket UCC liens** from a bank line can block other lenders from taking a first lien.

> **Game implication:** model a per-loan `status: current → late(1–29d) → delinquent(30–59) → default(60+) → accelerated → repossessing → closed(deficiency)`, plus cross-default propagation across loans whose `crossDefaultThreshold` is exceeded. Repossession removes the machine, credits FLV × (1 − 0.075) against the balance, and leaves a deficiency attached to the guarantor's personal credit.

---

## 10. Credit scores: personal and business [M]

**Personal FICO (300–850) bands.**
- Exceptional 800+, very good 740–799, good 670–739, fair 580–669, poor below 580.
- The U.S. average was about **715** in 2025, down from 717–718 as student-loan delinquencies reappeared.

**Score shocks.**
- A **30-day late** payment: **−60 to −110 points**. A higher starting score drops more.
- A charge-off or collection: **−100 to −150**.
- Bankruptcy: **−130 to −240**. It stays on the report **10 years** for Chapter 7 and **7 years** for Chapter 13.
- A hard inquiry: **−5 to −10**.
- Revolving utilization above **30%** hurts; above **70–90%** hurts badly.
- Recovery takes about 12–24 months of clean history to regain most of a late-payment hit.

**Rate tiers from FICO.** 720+ → A; 680–719 → B; 620–679 → C; below 620 → D.

**Business credit.**
- **D&B Paydex** (1–100): **80 = pays on time**, 90–100 = pays early, **below 50 = 30 or more days late**. It needs **3 or more trade lines reporting**, so it takes about 6–12 months to establish.
- **Experian Intelliscore Plus:** 1–100, a risk score.
- **Equifax business scores:** Payment Index 0–100; failure score about 1,000–1,880.
- **FICO SBSS** (Small Business Scoring Service, 0–300): blends the owner's personal credit, business bureau data and financials. **SBA 7(a) small-loan minimum is 165** (since 2025-06); many lenders want **180 or more**.

**Time in business.**
- Banks want **2–3 years**.
- SBA accepts startups, but with more scrutiny and 10% equity.
- Online lenders want **6–12 months** and **$100–250k a year in revenue**.
- Equipment lenders run separate startup programs for businesses under 2 years old.

> **Game implication:** keep `owner.fico` (300–850) and a `company.bizScore` (0–100, Paydex-like), with an SBSS-like blend of the two. The company starts as "no file". For roughly the first 2 years, approvals key off the owner's FICO plus a PG. After that, the company score and its financials take over.

---

## 11. Gold-backed loans, streams, royalties, prepays and equity [M]

**Loans against bullion.**
- From dealers, depositories and private banks: **LTV 50–70%** (typically about 60%) of spot.
- **Margin call at 75–80% LTV**; **forced sale at about 85–90%**.
- Rate **6–12%** (2025–26). Minimum loan $10–50k.
- Only **refined, recognized bars or coins held in an approved vault** are accepted. **Raw placer gold and doré are not accepted until refined.**

**Gold loans in metal** (borrow ounces, repay in ounces).
- A historical tool for producers.
- **Lease rates** normally run 0.1–2%. They spiked during the 2025 London liquidity squeezes.
- Not available to small miners.

**Refinery advances.** Some refiners pay **70–90% of estimated value on receipt** to established clients, for a fee of about 0.25–1%. The balance follows the assay.

**Streams.**
- Upfront deposit, typically **20–50% of project capital** in larger deals.
- In return, the streamer buys a fixed share of payable gold (**2–10%**) at an **ongoing price of 10–30% of spot**. Older deals used a fixed **$400–650/oz** with an inflation escalator.
- The share often **steps down after a delivery threshold**, for example halving after X oz.
- Target return to the streamer: **~6–10% IRR** on low-risk producing assets, **12–20%+** on small or junior producers.
- Industry consolidation in 2025 (for example Royal Gold–Sandstorm, EMX–Elemental Altus) left fewer buyers for small deals. Deals **under about $5M are rare**.

**NSR royalty sales by juniors.**
- An NSR (net smelter return royalty) of **1–3%** sells for **0.5–1.2x the NPV** of the royalty stream (discounted at about 5–8%). The multiple is lower for unproven ground.
- Buyback options are common, for example the right to buy back half the NSR for $X.

**Small private placer analogs.**
- **Production payment or prepay:** cash now for X oz delivered over 12–36 months. Implied cost **15–25%+**.
- **Royalty with a payback multiple:** for example, the investor advances $500k for **10% of gross gold until 1.5–2.0x is returned, then 2–3% for life**.

**Equity in small private miners.**
- Angels and family investors target **25–40% IRR**.
- Common terms:
  - **20–49% common equity**; or
  - **preferred equity with an 8–12% preferred return**, then a 70/30 or 80/20 split; or
  - **"carry" deals** where the investor funds 100% of season costs and takes **50% of net until capital is repaid, then 20–35%**.
- Investor rights: monthly reporting, budget and capex approval (for example any item over $50k), a board seat, drag-along and tag-along rights, and **pay-to-play dilution** if more capital is needed.
- Securities law: **Reg D 506(b)/(c)** with a Form D filing. Accredited investor = $1M net worth excluding the home, or $200k income ($300k joint).

> **Game implication:**
> - Stream offer: `upfront = PV(stream share × expected production × (spot − ongoingPrice), rate 15–20% for a small producer)`.
> - Investor-royalty offer: `upfront ≈ E[annual royalty] × 2–4`, with ×1–2 on unproven ground and ×3–5 on proven ground.
> - In-kind deliveries come off the top at cleanup. A production shortfall builds a **delivery arrears** liability, which is itself a default trigger.

---

## 12. Selling gold: local buyers, refineries, assay, transport, storage [M unless tagged]

**Local gold buyers** (northern towns, pawn shops, small dealers).
- They estimate fineness by **XRF or density**, then pay a percentage of spot on the estimated fine content.
- **Clean placer gold, lots over 10 oz:** about **80–92% of fine value**.
- **Small lots under 1–2 oz, or dirty gold:** about **65–85%**.
- **Pawn shops:** about **50–70%**.
- Some buyers quote **per raw ounce**. At 0.80 fineness, "75% of spot per raw oz" equals only 60% of spot per fine-oz equivalent before any haircut.
- They pay cash or check the same day. A cash payment over **$10,000** triggers **Form 8300** filing by the buyer.
- **Nuggets** over about 1 g can bring a **10–100%+ premium** from collectors (R3).

**Refinery terms for raw placer gold or doré** (2025–26 typical).

| Item | Typical value |
|---|---|
| Minimum lot | 5–25 oz for small-miner programs; 100–1,000 oz for industrial toll refining |
| Gold payable | **99.5–99.9%** of assayed Au |
| Silver payable | 90–95% if Ag exceeds about 1–3% (placer typically carries 8–20% Ag) |
| Refining charge | **$1–4/oz** on lots over 500 oz; **$5–15/oz or 0.5–2% of value** on 10–100 oz; minimum $150–500 per lot |
| Melt and homogenization | $50–150 per lot |
| Fire assay | $40–100 per sample (R3: $30–80); umpire assay $150–300 |
| Penalties | mercury, lead or base metals: $/oz or rejection; black sand or magnetite: cleaning charge |
| Pricing | spot or LBMA PM on the assay day, or a client "lock" within a window |
| Timing | assay 2–7 business days after receipt; wire 1–5 days after assay; **3–10 business days from receipt to cash**, plus 1–5 days of shipping |

**Worked comparison [D]** at $4,200 spot, 0.82 fineness.

| Lot | Channel | Net | Share of spot fine value |
|---|---|---|---|
| 100 raw oz (82 fine oz) | Local buyer at 85% | **$292.7k** | 85% |
| 100 raw oz (82 fine oz) | Refinery (99.5% payable, $3/oz, $225 lot fees, $400 + 0.2% shipping/insurance) | **$340.4k** | **98.9%** |
| 10 raw oz | Refinery | — | **97.2%** |

On the 100 oz lot, the refinery pays about $48k more but takes about 1–2 weeks longer. That gap is the core trade-off.

**Assay methods.**
- **Fire assay** (cupellation and parting) is the settlement standard. Precision is about **±0.1–0.5 parts per thousand** on doré.
- **XRF** reads only the surface. Placer grains carry **leached high-fineness rims**, so XRF can over-read by **2–10%**. Buyers haircut for that.
- **Density (Archimedes) test:** gold SG 19.3, silver 10.5. Rough, about ±2–5%.
- **Disputes:** both parties assay retained splits. If the results differ by more than the splitting limit (about 0.3–1 part per thousand), the gold goes to an **umpire lab, and the party further from the umpire result pays**.

**Fine-gold accounting (frequent misunderstanding) [D].** Melt loss (1–5%, R3) is mainly sand, oxides, moisture and mercury, not gold.
- If fineness is defined on the **cleaned raw particles**: fine oz ≈ raw oz × fineness × (0.98–0.995).
- If fineness is defined on the **doré**: fine oz = doré oz × doré fineness.
- Doing both double-counts the loss. R3's chain (100 raw → 97 doré → 79.5 fine at 0.82) treats 0.82 as doré fineness.

**Transport.**
- **Armored or precious-metals carriers** (Brink's, Loomis, Malca-Amit): about **$500–3,000+ per shipment** from Alaska or Yukon to a refinery, plus transit insurance of **0.05–0.3% of value**.
- **USPS Registered Mail** is the cheap option for small lots, with insured value capped at about $50k.
- Mainstream parcel carriers generally exclude bullion from declared value.

**Storage, security and insurance.**
- **Depository storage:** **0.1–0.5% of value a year**, insured, with minimum fees.
- **Bank safe-deposit box:** contents are not insured by the bank or by FDIC.
- **Rated safe** (UL TL-15/TL-30): $3–15k.
- A standard business owner's policy covers money and securities only to about **$5–25k**.
- **Specie or cash-in-safe coverage** for gold kept at a **remote camp**: about **1–3%+ of value a year**, with alarm, safe and guard conditions and high deductibles. It is often **not available** for unrefined gold in camp.
- **High-grading (theft by crew)** is the classic placer leak. Anecdotal estimates put it at **1–10% of production** where gold-room controls are weak.

> **Game implication:**
> - `localBuyerPct ~ U(0.80, 0.90)`, with **−10 points** for lots under 2 oz. The buyer's fineness estimate = true fineness × N(0.97, 0.03), because buyers haircut to cover XRF over-reads.
> - Refinery: `net = fineOz × 0.997 × spot − max(minFee, rate × fineOz) − assay − shipping`, with cash at **+1–2 turns**.
> - Gold held in camp carries a weekly theft hazard that falls with a safe, a gold-room operator and a guard. Vault storage costs 0.3% a year but cuts theft to near zero and makes the gold eligible for the borrowing base.

---

## 13. Hedging and forward sales for small producers [M/D]

**Who will hedge a small miner.**
- **Bullion banks** need an ISDA agreement, credit lines and size (typically **10–20k+ oz a year**). A placer miner producing 200–2,000 oz a year **cannot get bank hedges**.
- **Realistic routes:**
  - Some **refiners and dealers offer forward "price locks"** for 30–180 days to established clients, with a **10–20% deposit** or margin.
  - **Exchange futures through a broker:** COMEX **GC (100 oz)**, **MGC (10 oz)**, **1OZ (1 oz)**.
  - **Buying puts.**

**Futures margins.**
- Initial margin is about **5–8% of notional**. At $4,200, one GC contract has a $420k notional and needs **about $21–34k** of margin. CME raised margins repeatedly during the October 2025 and January 2026 volatility spikes.
- Variation margin is daily: a **$100/oz move costs $10k per GC contract** in cash. A hedger can be **profitable on paper and still out of cash** in a rally.

**Forward price [D].** Forward = spot × e^{(r − lease rate)·T}. With r ≈ 4% and lease ≈ 0.5% (2025–26), a **1-year forward at $4,200 spot ≈ $4,350**. Gold trades in **contango of about 3–4% a year**, so a hedge locks in *more* than spot.

**Put option cost [D]** (Black-Scholes, no volatility skew, r = 4%, spot $4,200). Gold implied volatility is normally 12–20%; it spiked to 30–40%+ in October 2025 and January 2026 [M].

| Tenor | At-the-money put (20% vol) | 90%-strike put (20% vol) | ATM put at 16% / 25% vol |
|---|---|---|---|
| 3 months | **3.5%** ($147/oz) | 0.6% | — |
| 6 months | **4.6%** ($195) | 1.4% | — |
| 12 months | **6.0%** ($252) | 2.5% | 4.5% / 7.9% |

**Zero-cost collar [D].** Buying a 90% put is paid for by selling a call at about **117% of spot (6 months)** or **123% (12 months)**.

**When lenders require hedging.** Project-finance lenders typically require **30–60% of production hedged for 1–3 years**. Small-business lenders rarely do, but a "backed" investor or a prepay might.

**Production shortfall.** Undelivered forward ounces must be **bought back at market**. If the price has risen, that is a cash loss. Industry history shows the damage: Ashanti in 1999 nearly failed on its hedge book, and Barrick spent about $5.6B buying back hedges in 2009.

> **Game implication:**
> - Forward price = `spot × (1 + 0.035 × years)`. The deposit is 15% of notional, with **variation margin calls each week** when spot rises above the locked price.
> - Shortfall settles at `(spot − lockedPrice) × missingOz`.
> - Puts cost `premiumPct(vol, tenor)` from the table above.
> - Hedging is available only after the company has a refiner relationship and at least 1 season of deliveries.

---

## 14. Gold market structure and price statistics [M unless tagged]

**Market structure.**
- **London OTC (LBMA):** loco-London 400 oz Good Delivery bars. The **LBMA Gold Price** auction runs twice daily, at 10:30 and 15:00 London. Most refinery and royalty settlements reference the **LBMA PM** price or spot.
- **COMEX** futures in New York.
- **Shanghai Gold Exchange.**
- Trading runs about 23 hours on weekdays; there is **no weekend trading**, so a weekly step is natural.

**Supply and demand (2024–25).**
- Mine supply about **3,600–3,700 t a year**; recycling about **1,300–1,400 t**.
- **Central-bank buying above 1,000 t a year in 2022, 2023 and 2024**, and about 850–900 t in 2025.
- **Record ETF inflows in 2025.**
- Large producers' **all-in sustaining cost (AISC) was about $1,450–1,650/oz in 2025**. That margin explains why lender appetite and iron prices were hot in 2025–26.

**Regimes and drawdowns** (nominal USD per oz; London fix or close).

| Episode | Dates | Move |
|---|---|---|
| Bear | Dec 1974 $186 → Aug 1976 $103 | −45% in 20 months |
| Bull | 1976 → 21 Jan 1980 $850 | about 8x in 3.5 years |
| Crash | Jan 1980 → Jun 1982 ~$297 | −65% in 2.4 years |
| Secular bear | Jan 1980 → Jul 1999 / Apr 2001 ~$252–256 | **−70% nominal, about −85% real**, 19–21 years |
| Secular bull | 2001 → 6 Sep 2011 $1,895 fix ($1,921 intraday) | **about +640%** in 10 years |
| GFC liquidation | 17 Mar 2008 $1,011 → 24 Oct 2008 ~$712 | **−30–33% in 7 months**, then a new high by late 2009 |
| Bear | Sep 2011 → 17 Dec 2015 $1,050 | **−45%** in 4.3 years; 2013 alone −28% |
| Recovery | Dec 2015 → Aug 2018 ~$1,160 (range) → 7 Aug 2020 $2,067 | +97% over 4.6 years, most of it in 2019–20 |
| Correction | Aug 2020 → Sep/Nov 2022 ~$1,620 | −22% in about 2 years |
| Bull | Nov 2022 → 20 Oct 2025 ~$4,380 | **+170% in about 3 years**; 2024 +27%; 2025 about +64%, the best year since 1979 |
| Blow-off | Jan 2026 ~$5,500 → early Feb 2026 | −15–20% peak to trough within days (exact low unverified) |

**Annual returns, roughly:**
- 2002–2012: +25, +20, +6, +18, +23, +31, +6, +24, +30, +10, +7 (%)
- 2013–2015: −28, −2, −10 (%)
- 2016–2023: +9, +13, −2, +18, +25, −4, 0, +13 (%)
- 2024–2025: +27, ~+64 (%)

**Largest moves.**

| Horizon | Biggest moves |
|---|---|
| **Days** | 22 Jan 1980 about −13%; **15 Apr 2013 −9%** (two days, about −13%); **21 Oct 2025 about −5 to −6%** (largest since 2013); **30 Jan 2026 about −9 to −10%**; 17 Sep 2001 about +6% |
| **Weeks** | Since 1990, the extreme weekly moves are roughly **±8–12%** (Sep 2011 about −10%; late Mar 2020 about +9%; Oct 2008; Jan–Feb 2026). In 1980, ±20%+ |
| **Typical week** | σ about 2.2% [D]. A 5% week is about a 2.3σ event, so roughly 1–3 times a year in a calm regime and more often in turbulent ones |

**Volatility.**
- Long-run annualized vol is about **15–17%** since 1990, and about **19–20% including the 1970s and 1980**.
- 30-day realized vol has been as low as **8–10%** (2019, 2023) and as high as **35–45%** (Oct 2008, Apr 2013, Mar 2020, and probably Jan 2026).
- **CBOE gold volatility index (GVZ):** long-run mean about 17–18; low about 9; high about 48 (2008).
- Daily returns are fat-tailed (excess kurtosis about 5–10).
- Gold shows an **"inverse leverage effect"**: volatility rises *more after up-moves* than after down-moves (Baur 2012). That is the opposite of equities.

**Drivers and rough sensitivities.**
- **Real rates.** Over roughly 2006–2021, a **+100 bp move in the 10-year TIPS yield** went with about **−15 to −25% in gold** (correlation about −0.8). The relationship **broke down in 2022–25**: gold more than doubled while real yields sat near +2%, driven by central-bank and ETF demand.
- **U.S. dollar.** Weekly return correlation with DXY is about **−0.3 to −0.5**. A beta of about **−0.5 to −1.0** means a 10% stronger dollar goes with roughly 5–10% lower gold.
- **Central banks.** Their **1,000 t+ a year** of buying (2022–24) is widely credited for the 2022–25 bull run. A rough rule of thumb is a few percent of price per 100 t of incremental demand, but estimates vary widely.
- **Inflation.** Gold keeps pace over decades (1971 $35 → 1980 $850) but has a near-zero short-run correlation: it was flat through the 2021–22 inflation spike and lost about 85% in real terms over 1980–2001.
- **Geopolitics.** Typically **+2–8% over days to weeks, then fading within 1–3 months** unless policy follows. Examples: Feb–Mar 2022 +8% then fully reversed; 9/11 +6% in a day.
- **Liquidity crises.** Gold is **sold first** (Mar 2020 −12% in about 8 days; 2008 −30%), then recovers ahead of other assets.
- **Policy surprises.** The 30 Jan 2026 drop followed the nomination of a Fed chair seen as hawkish.

**Recommended stochastic model (weekly) [D/M].** Weekly log return = μ_s·Δt + σ_t·ε_t + J_t, where:
- s ∈ {bull, range, bear} is a Markov regime;
- σ_t follows GARCH(1,1) scaled by regime;
- ε_t is Student-t with ν = 4–6, rescaled to unit variance;
- J_t is a jump with weekly probability about **0.02–0.04** (about 1–2 a year) and size about N(0, 4–6%), with its sign biased by the news event;
- an optional slow pull toward a macro "fair value" F_t: κ·(ln F_t − ln P_t)·Δt, with κ ≈ 0.15–0.35 a year (half-life 2–4.5 years).

Regime parameters:

| Regime | Drift μ (per year) | Base vol σ | Mean duration | Weekly exit probability |
|---|---|---|---|---|
| Bull | +15 to +20% | 16–18% | 3–5 years | 0.004–0.0064 |
| Range | 0 to +3% | 11–13% | 1–3 years | 0.0064–0.019 |
| Bear | −10 to −15% | 17–20% | 2–4 years | 0.005–0.0096 |

On exit, suggested transitions are bull → range 70% / bear 30%; bear → range 60% / bull 40%; range → bull 50% / bear 50%.

- **GARCH (weekly):** α ≈ 0.08–0.10, β ≈ 0.85–0.88, ω = σ²_target·(1 − α − β). At a 16% target, **ω ≈ 2.0–2.5e-5** [D]. Clamp weekly σ to [1%, 6%].
- **Merton-style jump diffusion (daily equivalent):** λ ≈ 3–6 a year, jump SD 2–4%.
- **Sanity targets** for 10-year simulated paths [D, designer judgment]:
  - median maximum drawdown about 30–40%;
  - P(the price doubles within 5 years) about 15–25%;
  - P(a −30% drawdown within 3 years) about 20–35%;
  - annualized vol 14–20%.

> **Game implication:** the macro layer, not white noise, should change real rates, the dollar and central-bank demand. The model maps those into μ_s, the regime-switch hazard and jump triggers, and pushes news items into the feed. Ripple effects (claim prices, iron prices, wages, lender spreads) key off a 13–26 week smoothed price trend, not spot.

---

## 15. U.S. federal taxes (2025–2026, simplified but directionally real) [M]

**Entity tax treatment.**

| Entity | How it is taxed |
|---|---|
| **C-corporation** | **21% flat** (permanent). Dividends are taxed again at 0/15/20% plus the 3.8% net investment income tax, so the top combined rate is about 39.8%. The 15% corporate minimum tax applies only above $1B of income, so it is irrelevant here. |
| **Sole proprietorship or single-member LLC** (Schedule C) | Owner's ordinary rates + SE tax |
| **Multi-member LLC** | Partnership; owner's ordinary rates + SE tax |
| **S-corporation election** | SE tax only on a "reasonable salary"; distributions avoid the 15.3% |

**2026 brackets** (single; married filing jointly ≈ 2x except at 35%).

| Rate | Single, up to | Married filing jointly |
|---|---|---|
| 10% | $12,400 | |
| 12% | $50,400 | |
| 22% | $105,700 | |
| 24% | $201,775 | up to $403,550 |
| 32% | $256,225 | up to $512,450 |
| 35% | $640,600 | up to $768,700 |
| 37% | above | |

Standard deduction **$16,100 single / $32,200 MFJ**. OBBBA made these rates permanent.

**Self-employment tax.**
- **15.3% on 92.35% of net SE earnings**: 12.4% Social Security up to the wage base (**$176,100 in 2025; $184,500 in 2026**) plus 2.9% Medicare with no cap.
- **+0.9% additional Medicare** above $200k single / $250k MFJ.
- Half of SE tax is deductible.

**QBI deduction (§199A).**
- **20% of qualified business income, made permanent by OBBBA.**
- The phase-in range widened to $75k / $150k, and there is a new $400 minimum deduction.
- Above the threshold (about **$201,750 single / $403,500 MFJ** in 2026), the deduction is capped at the greater of **50% of W-2 wages** or **25% of W-2 wages + 2.5% of the unadjusted basis of qualified property**. Equipment-heavy miners benefit from the property prong.
- Mining is **not** a specified service business.

**Depreciation.**
- **Bonus depreciation:** OBBBA restored **100%, permanently**, for property **acquired and placed in service after 2025-01-19**. Property acquired earlier gets 40% if placed in service in 2025.
- **§179:** **$2.5M** limit, phasing out dollar for dollar above **$4.0M** of purchases (tax years beginning after 2024; inflation-indexed from 2026). Unlike bonus depreciation, §179 is **limited to business taxable income**, and the excess carries forward.
- **MACRS classes:** **asset class 10.0 Mining = 7-year** (general system; 10 years under the alternative system). Construction equipment is 5-year; heavy trucks 5-year; land improvements 15-year; buildings 39-year.
- **7-year schedule** (200% declining balance, half-year convention): 14.29%, 24.49%, 17.49%, 12.49%, 8.93%, 8.92%, 8.93%, 4.46%.
- **5-year schedule:** 20%, 32%, 19.2%, 11.52%, 11.52%, 5.76%.
- **Mid-quarter convention** applies if more than 40% of the year's additions are placed in service in Q4.
- **Recapture:** on sale, gain up to prior depreciation is **ordinary income (§1245)**. Distress sales of fully expensed iron create **taxable income with no cash to pay it**.

**Depletion.**
- **Percentage depletion for gold from U.S. deposits: 15%** of gross income from the property (IRC 613(b)). Foreign or "other" minerals get 14%.
- **Limited to 50% of taxable income from the property** before depletion.
- It **can exceed cost basis**, which makes it a permanent subsidy.
- **C-corporations lose 20%** of the excess over adjusted basis (§291).
- For individuals, the excess over basis is an AMT preference.
- **Cost depletion** = basis × (oz sold ÷ estimated remaining recoverable oz). Each year the taxpayer takes the **greater** of cost and percentage depletion.
- **Gross income from the property** excludes royalties the lessee pays out. Lessors and royalty holders deplete their own royalty income.

**Depletion example [D].** Gold sales $1.9M, less a 10% lease royalty, gives gross income from the property of $1.71M; 15% of that is $256.5k. If the property's taxable income before depletion is $400k, the 50% cap allows only **$200k**.

**Exploration and development costs.**
- Exploration (§617, elective, recaptured at production) and development (§616) are deductible now.
- **Corporations must capitalize 30%** and amortize it over 60 months (§291(b)).
- **Pre-production stripping counts as development. Stripping during production is a production cost.**

**Interest.**
- §163(j) caps interest at 30% of adjusted taxable income (EBITDA basis again from 2025).
- **Small-business exemption: average gross receipts ≤ about $31M (2025) / $32M (2026)**, so small miners deduct all interest.
- The same test allows the **cash method** of accounting.

**Losses.**
- **NOLs** from 2018 on carry forward **indefinitely**, offset **at most 80% of taxable income**, and **cannot be carried back**.
- Non-corporate owners also face the **excess business loss** limit (§461(l), made permanent by OBBBA): about $313k single / $626k MFJ in 2025, re-indexed in 2026, roughly $256–320k single.
- Owners also face at-risk and passive-activity rules. The owner must **materially participate**.

**Character of gold income.** A miner's gold is **inventory, so sales are ordinary income**. The 28% "collectibles" rate applies only to investors.

**Reclamation.** Reclamation costs are deducted when performed. The **§468 election** allows deducting additions to a qualified reclamation reserve in advance.

**Estimated taxes.**
- **Individuals:** Apr 15, Jun 15, Sep 15, Jan 15. Safe harbor: 100% of last year's tax (**110% if AGI over $150k**) or 90% of this year's.
- **C-corporations:** 15th day of months 4, 6, 9 and 12 (Apr 15, Jun 15, Sep 15, Dec 15).
- Underpayment interest = federal short-term rate + 3%, about **6–7%** in 2025–26.
- The **annualized-income installment method** lets seasonal miners pay when income actually arrives, without a penalty.

**Returns.** C-corporation Form 1120 due Apr 15. S-corporation and partnership returns due Mar 15. Individuals Apr 15. 6-month extensions are available for filing but **not for payment**.

> **Game implication:**
> - Tax engine per entity: `taxableIncome = revenue − cash costs − royalties − interest − depreciation(MACRS or bonus) − max(costDepletion, min(0.15 × GIFP, 0.5 × propertyIncome))`, then NOL at 80%.
> - Corporation: 21%. Pass-through: bracket table + SE tax + 20% QBI.
> - Quarterly estimate obligations go on the compliance calendar.
> - A **"bonus depreciation now vs. later"** toggle creates real trade-offs: a lower tax bill now, but recapture on sale and NOLs that offset only 80%.

---

## 16. Payroll taxes, and state and territorial taxes [M unless tagged]

**Federal payroll taxes.**
- Employer FICA **7.65%**: 6.2% Social Security to $184,500 (2026) + 1.45% Medicare.
- The employee pays the same amount through withholding, plus federal income tax withholding.
- **FUTA 6.0% on the first $7,000**, less a credit of up to 5.4% for paying state UI, nets to **0.6% = $42 per employee per year**. "Credit reduction" states pay more; California was the one in 2025. Alaska and Nevada are not affected.

**Payroll deposits.**
- Through EFTPS: **monthly** (due the 15th of the next month) if lookback-year liability was ≤ $50k, otherwise **semi-weekly**. Next-day deposit applies at $100k or more.
- **Form 941** is filed quarterly (Apr 30, Jul 31, Oct 31, Jan 31). Form 940 and W-2s are due Jan 31.
- **Failure-to-deposit penalties:** 2% (1–5 days late), 5% (6–15 days), 10% (over 15 days), 15% after an IRS demand.

**Alaska.**
- **No personal income tax and no state sales tax** (some boroughs and cities levy local sales taxes).
- **SUTA:** taxable wage base about **$51.7k (2025)**, rising each year. Employer rate about **1.0–5.4%**. Alaska is one of very few states where **employees also pay UI tax** (about 0.5%).
- **Corporate income tax (C-corporations only):** 0% under $25k, rising in roughly $25k steps through 2%…9%, to **9.4% above about $222k**.
- **Mining license tax** [V-R2]: net income $0–40k 0%; $40–50k 3%; $50–100k $1,500 + 5%; above $100k **$4,000 + 7%**. **New operations are exempt for 3.5 years.** Return due **Apr 30**.
- **Production royalty:** **3% of net income** on **state land** [V-R2], with rental credited against it.
- Mineral resources are exempt from local property tax in some areas; others tax equipment. This varies by borough.

**Nevada.**
- **No corporate or personal income tax.**
- **Net Proceeds of Minerals tax** (NRS 362), 2–5% [V-R1 range]. The rate rises with the **ratio of net proceeds to gross proceeds**:

  | Net ÷ gross | Rate |
  |---|---|
  | under 10% | 2.0% |
  | 10–18% | 2.5% |
  | 18–26% | 3.0% |
  | 26–34% | 3.5% |
  | 34–42% | 4.0% |
  | 42–50% | 4.5% |
  | 50% or more | 5.0% |
  | **net proceeds over $4M in a year** | **5.0% flat** |

  - Net proceeds = gross yield − direct mining, processing, transport and marketing costs and the depreciation of assets used. Administrative overhead and income taxes are **not** deductible.
  - The annual statement is due mid-February for the prior calendar year. Nevada has used estimated prepayments.
  - **Example [D]:** gross $1.9M, deductible costs $1.3M → net $600k → ratio 31.6% → rate 3.5% → **$21k**.
- **Gold and silver excise tax** (2021): **0.75% of gross revenue on $20–150M, 1.1% above $150M**. Small miners are **exempt**.
- **Commerce Tax:** applies only to Nevada gross revenue **over $4M**; mining rate about 0.051%.
- **Modified Business Tax** (payroll): mining employers about **1.853% of quarterly wages over $50k**.
- **SUTA:** wage base about **$42–44k**, new-employer rate about **2.95%**, plus a 0.05% surcharge.
- Personal property tax on equipment is about **1% of depreciated value a year**.

**Federal land.** There is **no federal royalty** on unpatented claims [V-R1].

**Yukon (Phase 6).**
- Royalty **C$0.375 per oz, exported gold only** [V-R2].
- Canadian federal corporate tax **15%**, or **9% on the first C$500k** of active small-business income.
- Yukon corporate tax **12%**, or **0% small-business rate**. A small Canadian-controlled private corporation (CCPC) placer company pays about **9% combined** on its first C$500k.

> **Game implication:** each regime has a `productionTaxFn(year)`: AK = licenseTax(net, holiday) + 0.03 × net on state land; NV = rateByRatio(net/gross) × net; federal land = 0; Yukon = 0.375 C$/oz exported. Corporate income tax applies by entity: AK C-corporations only; none in NV.

---

## 17. Insurance for small mines [M]

**General liability.**
- **$1M per occurrence / $2M aggregate** costs about **$5–25k a year** for a small surface mine (2025–26).
- Rated per $1,000 of payroll or receipts, with an audited final premium.
- Many standard carriers decline mining, so it is often placed in the **excess and surplus (E&S) market**.
- **$1M umbrella** about $2.5–10k. **Pollution liability** about $2.5–15k.
- **Commercial auto** for road trucks about $3–10k per heavy unit. Auto and umbrella rates rose about 8–15% a year in 2023–25 (hard market).

**Inland marine (contractor's equipment floater).**
- About **1.0–2.5% of scheduled value a year**: about 1–1.5% for road-access construction, **2–3% for remote mining**.
- Deductible $2.5–25k, or 1–2% of value.
- Covers theft, fire, overturn, collapse and flood. **Excludes wear and mechanical breakdown**; an equipment-breakdown add-on costs about +0.25–0.5%.
- **Lender is named as loss payee.** If coverage lapses, the lender **force-places** insurance at **2–3x** the price.
- **Camp and building property:** about 0.5–1.5% of value.

**Workers' compensation.**
- **NCCI class 1164** (surface mining, not coal): about **$3–12 per $100 of payroll**, varying by state. Alaska is among the costliest states; Nevada is moderate.
- Clerical (8810) about $0.10–0.30 per $100. Trucking about $5–15.
- Minimum premium $750–2,500. Deposit premium based on estimated payroll, then audited.
- Sole proprietors, partners and LLC members are usually excluded unless they elect in. Corporate officers can often opt out.
- **Experience modification (EMR):** 1.00 is average; observed range about **0.70–2.0**.
  - A business becomes eligible once premium reaches about **$5–10k a year** over 2–3 years. Until then it is rated at 1.00, or surcharged in the assigned-risk pool (+10–50%).
  - The EMR uses **3 completed policy years, excluding the most recent**, so a claim affects premium for about **3 years starting about 1 year later**.
  - **Primary losses** (the first ~$20k of each claim) count fully. Excess losses are damped, so **many small claims hurt more than one large claim**. Medical-only claims count at 30% in most states.
  - **Example:** one $50–100k lost-time claim at a small employer can push the EMR from 1.0 to about **1.2–1.6**.
  - An EMR above about 1.25 can disqualify a company from contract work.
- **Renewal on equipment and GL:** clean history gets 0 to −10%. One major theft or fire claim brings **+15–50% or non-renewal**.

> **Game implication:**
> - `wcPremium = payroll/100 × classRate × EMR`, with `EMR = clamp(1 + k × (primaryLosses − expected)/expectedLosses, 0.7, 2.0)` lagged 1–3 years.
> - Equipment insurance = 1.5–3% of insured value, with lender-required coverage on financed iron.
> - Uninsured events, such as an uninsured theft or a mechanical failure, fall on cash.

---

## 18. Reclamation obligations: asset retirement obligation (ARO) accounting [M/D]

**ASC 410-20 (U.S. GAAP).**
- When ground is **disturbed**, recognize a liability at fair value: the PV of expected reclamation cash flows, escalated about 2–4% a year and discounted at the **credit-adjusted risk-free rate**. For a small private miner that rate is about **7–12%** (2025–26).
- **Capitalize the same amount** into the asset (an asset retirement cost) and depreciate it.
- Each period, **accretion expense** unwinds the discount and grows the liability.
- Revise the estimate as it changes. When reclamation is done, book a gain or loss on settlement versus the liability.

**Example [D].** 10 acres disturbed × $5,000/acre = $50k, due in 3 years, discounted at 9%:
- Initial ARO of **$38.6k**.
- Year-1 accretion **$3.5k**.

**Magnitudes.** Real third-party cost runs **$1.5–6k/acre in Alaska** and **$3–15k/acre in the lower 48** [V-R1, model estimate]. The Alaska $750/acre bond understates true cost [V-R1].

**Small-company practice.**
- Many file tax-basis or compiled statements that omit the ARO.
- **Lenders subtract the ARO and any restricted bond collateral from tangible net worth.**
- **Cash bonds are restricted assets.** They do not count toward minimum-liquidity covenants.
- Surety premiums are an operating expense.

**Tax.** Reclamation is deductible when performed. The §468 reserve election is an alternative.

> **Game implication:** post `liab.reclamation` at PV when acres are disturbed and `exp.reclamationAccretion` each year. Covenants use **tangible net worth after the ARO**. Abandoning a claim converts the liability into a bond forfeiture plus a standing penalty.

---

## 19. Insolvency ladder and entity liability [M]

**1. Missed payroll.**
- **FLSA:** unpaid minimum wage or overtime brings **liquidated damages equal to the unpaid amount**. Owners or officers with operational control can be **individually liable** as an "employer".
- **Alaska:** late final wages can incur a penalty of the employee's regular wage for up to **90 days** (AS 23.05.140).
- **Nevada:** daily wages for up to **30 days** (NRS 608.040–.050).
- Unpaid mine labor may hold **statutory liens** on the mine and its output (check each state).
- Crews quit at once, mid-season.

**2. Trust fund taxes.**
- Withheld income tax plus the employee's 7.65% FICA (about 15–25% of gross wages) are held **in trust**.
- If they are not deposited, the **Trust Fund Recovery Penalty (IRC 6672)** assesses **100% of the trust portion personally** against every "responsible person" who acted **willfully**. Paying other creditors while knowing the taxes are due counts as willful.
- The penalty is **not dischargeable in bankruptcy**. Federal tax liens and levies follow.
- **Example [D]:** a $100k monthly payroll carries about $19.7k of trust funds.

**3. Default, acceleration and repossession** (see §9).

**4. Out-of-court options.**
- **Forbearance:** 3–6 months, for a fee of 0.5–2%, default interest, extra collateral and a reaffirmed PG.
- **Restructuring:** term extension, interest-only months, re-amortization.
- **Voluntary surrender:** cuts repossession costs but the deficiency remains.
- **Asset sales at OLV**, or a sale-leaseback.
- A **rescue partner** on distressed terms, for example 30–60% equity or a high gross royalty.
- **Assignment for the benefit of creditors** (state-law liquidation, cheaper than Chapter 7).
- **Receivership** requested by a lender.

**5. Bankruptcy chapters.**

| Chapter | Key features |
|---|---|
| **Chapter 7** (liquidation) | Trustee sells assets and the business stops. **LLCs and corporations get no discharge.** A sole proprietor gets a personal discharge, except for nondischargeable taxes (including the trust fund penalty and recent income taxes) and fraud. Filing fee about $338. 3–6 months. |
| **Chapter 11** (traditional) | Debtor-in-possession, creditors' committee, **absolute priority rule** (equity is wiped out unless creditors are paid in full or consent), disclosure statement, U.S. Trustee quarterly fees. Professional fees **$100k–$1M+**, 12–24 months. Filing fee about $1,738. |
| **Subchapter V** (SBRA 2019) | Debt limit **$7.5M until 2024-06-21**, then reverted to **$3,024,725**, then indexed to **$3,424,000 from 2025-04-01**. Bills to restore $7.5M were introduced; status unverified. At least 50% of debts must be business-related. **No committee. Only the debtor files a plan, within 90 days. No absolute priority rule:** owners **keep their equity** by committing **all projected disposable income for 3–5 years**. A standing trustee facilitates; no quarterly fees. Costs about $30–150k; confirmation in about 6 months. |
| **Chapter 13** | Individuals, including sole proprietors. 2025 limits about **$526,700 unsecured / $1,580,125 secured**. |
| **Chapter 12** | Family farmers and fishermen only. Miners do not qualify. |

**6. Priority order in bankruptcy.**
1. Secured claims, up to the value of their collateral.
2. Administrative expenses.
3. **Employee wages earned within 180 days, up to $17,150 per person** (11 USC 507(a)(4), from 2025-04-01).
4. Benefit-plan contributions.
5. Priority taxes.
6. General unsecured claims.
7. Equity.

**Liability by entity type.**

| Entity | What the owner is exposed to |
|---|---|
| **Sole proprietorship** | **Unlimited personal liability** for all business debts and torts. Homestead exemptions shelter some home equity: **Nevada about $605k**, **Alaska about $73k**. |
| **LLC or corporation** | Limited liability, **but** not for: personal guarantees (which lenders demand anyway); the **trust fund penalty**; the owner's own torts and negligence; **veil piercing** (commingling funds, undercapitalization, missing formalities); FLSA "employer" liability; CERCLA operator liability; and Mine Act §110(c) personal penalties for agents who **knowingly** authorize violations. |
| **In practice** | Entity choice protects against **trade creditors, tort plaintiffs and lessors without guarantees**, **not against banks**. |

> **Game implication:**
> - Distress ladder: cash shortfall → payment priority (payroll and trust taxes first) → late/missed payments → covenant breach → forbearance offer → acceleration → repossession → bankruptcy choice.
> - A sole proprietor's personal net worth is fully exposed. LLC and corporation owners are exposed only through guarantees and the trust fund penalty.
> - **Subchapter V** is a "survive with a 3–5 year disposable-income plan" option when total debt is ≤ $3.424M. Above that, only traditional Chapter 11 is available, at $100k+ in fees, or Chapter 7 (game over).

---

## 20. Surprising or commonly misunderstood

- **A profitable miner can be insolvent.** Spring burn, gold that arrives in summer and fall, payment 1–2 weeks after shipping, debt service every month, and a Jan 15 estimated-tax payment on fall gold all compound.
- **Gold forwards trade above spot** (contango of about 3–4% a year). A hedge "sells high", but it costs **variation margin in cash** when gold rallies.
- **Melt loss is mostly not gold.** Applying both a melt loss and fineness to the same ounce double-counts.
- **Gold sold by a miner is ordinary income**, not 28% collectibles gain.
- **Percentage depletion can exceed what the owner paid**, but it is capped at **50% of the property's net income**, so it does almost nothing in a marginal year.
- **100% bonus depreciation can push taxable income negative**, but the resulting NOL offsets only 80% later. **Selling expensed iron in a crisis creates taxable recapture income.**
- **Unpatented claims are near-worthless as bank collateral**, even when they hold real gold.
- **An LLC does not protect against a personal guarantee or the trust fund penalty.** Paying vendors instead of payroll taxes is the worst choice a distressed owner can make.
- **Gold volatility (about 16%) is no higher than equities**, but a miner's margin is levered. At a $3,000/oz cash cost and $4,200 gold, a 10% price drop cuts margin by 35%.
- **The real-rate link broke in 2022–25.** Central-bank demand dominated. A model driven only by real rates would have missed the largest gold rally since the 1970s.
- **Gold volatility rises in rallies** (the inverse leverage effect), and the biggest single-day drops of 2025–26 came right after record highs.
- **Subchapter V's limit fell from $7.5M to about $3.4M in 2024–25.** A mid-size placer company with a big fleet loan can be over the limit.

---

## Sources

**Verified by sibling sheets.** I did not re-fetch these; see R1 and R2 for details.
- https://law.justia.com/codes/alaska/title-43/chapter-65/ and https://law.onecle.com/alaska/title-43/43.65.010.html: Alaska mining license tax brackets; 3.5-year new-mine exemption (R1, R2).
- https://dnr.alaska.gov/mlw/cdn/pdf/factsheets/production-royalty.pdf: Alaska 3% net-income production royalty on state land; rental credit (R2).
- https://tax.nv.gov (net proceeds bulletin): Nevada Net Proceeds of Minerals tax, 2–5% sliding scale (R1).
- https://regulations.justia.com/states/alaska/title-11/part-6/chapter-97/article-4/section-11-aac-97-425: Alaska $750/acre bond and $150/acre bond pool (R1, R2).
- https://yukon.ca/en/doing-business/funding-and-supports-business/learn-what-royalties-are-collected-mining: Yukon C$0.375/oz royalty (R2).
- https://www.rcinet.ca/eye-on-the-arctic/2026/02/10/as-gold-prices-soar-some-miners-call-territorys-low-royalty-rate-a-bit-ridiculous/ and the Yukon Geological Survey placer industry report: 2025 average gold price (US$3,476 / C$4,811) and the C$6,114 record on 2025-10-20 (R2).
- BLM Handbook H-3809-1 and Nevada bond pool documents (via R1): reclamation cost magnitudes and surety premium ranges.

**Recommended verification targets.** I could not fetch these; egress was blocked. Every [M] figure should be checked against them.
- https://www.federalreserve.gov/releases/h15/ and https://fred.stlouisfed.org/series/DPRIME: prime rate history for 2025–26.
- https://www.sba.gov/partners/lenders/7a-loan-program/terms-conditions-eligibility and SBA SOP 50 10 8 (sba.gov/document/sop-50-10-lender-development-company-loan-programs): 7(a) rate caps, fees, the 165 SBSS minimum, equity injection, collateral, ownership rules.
- https://www.ecfr.gov/current/title-13/chapter-I/part-120/subpart-A/section-120.110: SBA ineligible ("speculative") businesses.
- https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions and IRS Rev. Proc. 2025-32: OBBBA bonus depreciation, §179, QBI; 2026 brackets and standard deduction.
- https://www.ssa.gov/oact/cola/cbb.html: Social Security wage base ($176,100 for 2025; $184,500 for 2026).
- https://www.law.cornell.edu/uscode/text/26/613 (and 26 USC 611–617, 291, 172, 461(l), 468, 6672, 1245): depletion 15% / 50% limit; corporate cutback; NOL 80%; excess business loss; reclamation reserve; trust fund penalty; recapture.
- https://www.irs.gov/publications/p946 and Rev. Proc. 87-56: MACRS asset class 10.0 Mining = 7-year.
- https://www.irs.gov/publications/p15 and https://www.irs.gov/taxtopics/tc759: deposit schedules; FUTA 6.0%/5.4% credit.
- https://www.leg.state.nv.us/nrs/nrs-362.html: Nevada net proceeds rate table (NRS 362.140); https://tax.nv.gov: Commerce Tax, Modified Business Tax.
- https://www.akleg.gov/basis/statutes.asp (AS 43.20.011 corporate rates; AS 43.65.010; AS 23.05.140): Alaska corporate tax, license tax, wage penalty.
- https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/subchapter-v and the Judicial Conference §104 adjustment notice (April 2025): Subchapter V limit ($3,424,000); Chapter 13 limits; 507(a)(4) wage priority ($17,150).
- https://www.cmegroup.com/markets/metals/precious/gold.margins.html: COMEX GC / MGC margins in 2025–26.
- https://www.lbma.org.uk/prices-and-data/precious-metal-prices and https://www.gold.org/goldhub/data/gold-prices: historical LBMA prices, 2025–26 records, central-bank and ETF demand (World Gold Council *Gold Demand Trends*).
- https://www.cboe.com (GVZ index): gold implied-volatility history.
- https://www.elfaonline.org (MLFI-25 monthly reports): equipment-finance delinquencies, charge-offs, approval rates.
- https://www.ncci.com: experience rating plan (split point, primary/excess losses, eligibility); state class 1164 rates (Alaska Division of Workers' Compensation for AK rates).
- https://www.fico.com/en/blogs (average FICO 2025) and https://www.fico.com/en/products/fico-sbss: score bands and the SBSS scale.
- Baur, D. G. (2012), "Asymmetric volatility in the gold market", *Journal of Alternative Investments*: the inverse leverage effect.
- Erb, C. and Harvey, C. (2013), "The Golden Dilemma", *Financial Analysts Journal*: gold vs. real-yield correlation.
- FASB ASC 410-20 (asset retirement obligations) and ASC 842 (leases): ARO and lease accounting.
- UCC Article 9 §§9-609, 9-610, 9-611, 9-612, 9-615 (Cornell LII): self-help repossession, notice, commercially reasonable disposition, deficiency.
