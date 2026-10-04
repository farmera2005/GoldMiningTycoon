# R3 Fact Sheet: Placer Geology, Sampling, and Gold Recovery Processing

Prepared 2026-10-04 for Gold Mining Tycoon system designers (§3 World & geology, §4 Prospecting & estimation, §7 Operations/recovery).

**How reliable this sheet is (read first).** This session could not reach the web. The shared WebSearch quota was already used up (200/200), and the egress proxy returned 403 for every domain tried (usgs.gov, yukon.ca/ygsftp, alaska.gov, wikipedia, 911metallurgist, google). So:
- **[U]** = *unverified, from model knowledge.* This applies to **every figure without another tag**, even where the tag is left out of a line to save space. Treat [U] numbers as informed starting magnitudes for tuning, not citations.
- **[V-R2]** = verified from a primary source by the sibling R2 sheet this session (YGS, Alaska DGGS). Sources are listed at the end.
- **[D]** = arithmetic derived here from stated inputs. The math is exact; the inputs carry their own tags.
- Units: 1 troy oz = 31.1035 g. 1 yd3 = 0.7646 m3. **1 g/m3 = 0.0246 oz/yd3**, so 0.01 oz/yd3 = 0.41 g/m3 [D]. In-place gravel is about 2.0 t/m3, so 1 bcy is about 1.53 t (1.69 short tons). That makes **1 g/t about 0.049 oz/bcy**, and 0.01 oz/bcy about 0.2 g/t [D]. **1 ft of thickness over 1 acre = 1,613 bcy** [D].

---

## Most important numbers

1. **Grade bands (raw oz per bank yd3 of mined pay):** background <0.003; marginal 0.003–0.007 (0.12–0.29 g/m3); average 0.008–0.02 (0.33–0.8 g/m3); good 0.02–0.05; rich 0.05–0.2; bonanza >0.2, found only as pockets of hundreds to a few thousand bcy. Modern Klondike and Interior Alaska pay commonly runs **0.3–1.5 g/m3 = 0.007–0.037 oz/bcy** [U; R2 gives the same range].
2. **Geometry:** the pay is the bottom **3–10 ft of gravel plus 1–3 ft of bedrock**. Northern overburden is **5–50 ft**: frozen muck, plus barren upper gravel. Dominion Creek has 2–16 m of muck over 3–4 m of gravel [V-R2]. Strip ratio (waste:pay, bcy) runs **2:1–10:1, typically 3–6:1** in the north. Desert placers have **0–15 ft** of cover and ratios of **0.5–3:1**.
3. **Vertical concentration:** **50–80% of the gold** in a section sits in the bottom 1–3 ft of gravel and the top 1–3 ft of bedrock. Bedrock cleanup alone holds **10–30% of a cut's gold**, locally over 50% in fractured schist or slate.
4. **Nugget effect:** a sample needs **at least ~20 gold particles for ±50% (95% confidence)** and **~400 for ±10%** (Poisson, 1/√N). At 0.01 oz/bcy, coarse gold (>2 mm, ~150 mg each) averages **~2 particles per bcy**. A 6-inch drill hole through 5 ft of pay is ~0.036 bcy, so it **misses the coarse gold ~93% of the time if all the gold is coarse, and ~98% for a 30%-coarse mix** [D].
5. **Lognormal skew:** small-sample grades have log-σ of **1.5–2.5**. At σ = 1.5 the mean is **3.1× the median**, and the top 10% of samples carry **~59% of the gold** [D]. A typical single sample therefore *understates* the grade, and a lucky one overstates it 5–20×.
6. **Fineness:** Klondike averages **~0.80** (YGS: impurities ~20% of crude mass [V-R2]), with a range of 0.70–0.88 by creek. Interior Alaska runs 0.80–0.92 (Fortymile, Circle, Nome about 0.85–0.90). California 0.85–0.93. Nevada **0.60–0.85**, often silver-rich. Melting raw gold to doré loses **1–5%** of its weight.
7. **Sampling costs (2025 USD):** excavator test pit **$500–1,500** with your own machine, **$2–5k** contracted. Sonic drilling **$100–200/ft** all-in in the remote north, plus **$20–100k** to mobilize. RC/Becker **$50–150/ft**. Bulk sample of **100–600 bcy** at roughly the operating cost (**$15–35/bcy**). Consulting geologist **$900–1,600/day**.
8. **Confidence vs spacing:** drill or pit fences **400–800 ft apart** (holes 25–50 ft apart on each line) support *inferred*. Fences **100–300 ft** apart plus a bulk test support *indicated*. *Measured* is rare without production reconciliation. Actual production commonly comes in at **0.6–1.5× the pre-mining estimate**.
9. **Recovery by size (well-run sluice):** +20 mesh **95%+**; 20–60 mesh **80–90%**; 60–100 mesh **60–80%**; 100–150 mesh **40–60%**; −150 mesh **10–35%**. A jig or centrifuge on screened fines lifts −100 mesh to **60–90%**. Feeding **25–50% over rated capacity** roughly **doubles fine-gold losses**.
10. **Plant throughput and water:** small plants **30–75 yd3/h**, mature **150–300+**, the largest Klondike plants **400–500**. Average effective throughput is **60–80% of nameplate**. Water ~**15 gpm per yd3/h** (650–2,000 gal per yd3 [V-R2]). Cleanups every **1–2 weeks** cost **0.5–1 shift** of plant time. Stripped, drained frozen gravel thaws **~3–6 ft per summer** (5–10 cm/day at peak), so operators **strip a season ahead**.

---

## 1. Placer deposit geometry

**Deposit types (and how they play)**
- **Creek (valley-bottom) placers.** Examples: Klondike creeks (Bonanza, Hunker, Dominion, Sulphur), Fortymile, Circle, Fairbanks creeks. Gravel is 3–15 ft thick on bedrock. Pay is the lower 1–6 ft plus 1–3 ft of bedrock. In the north it is buried under frozen organic silt ("muck"). The paystreak is **30–300 ft wide**, often 1/4–1/2 of the valley floor, and can wander away from the modern creek. Dominion Creek: 2–16 m muck / 3–4 m creek gravel / >5 m older gravel. Indian River pay is ~5 ft (1.5 m) [V-R2].
- **Bench (terrace) placers.** These are remnants of older channels on the valley sides, 30–300 ft above the creek. The type case is the **Klondike White Channel Gravel** (Pliocene). It is quartz-rich, bleached, and tightly packed or semi-cemented, and is **tens of metres thick (up to ~30–45 m)**, under younger Klondike Gravel. Gold is spread through the unit but richest in the bottom few metres and on bedrock. It needs ripping, and it was hydraulicked historically. Bench ground is often less frozen (it is better drained) but has high stripping if the gold is only at the base.
- **Paleochannels / deep leads.** These are buried older channels, often offset from the modern valley. Examples: California Tertiary channels under 100–600 ft of volcanic cover; deep Fairbanks ground with bedrock at 30–200 ft; Livengood. Historically they were drift-mined or dredged after thawing. Today they are mostly beyond a small operator unless the cover is thin. Seismic, resistivity (ERT), or GPR surveys find them.
- **Desert placers** (Nevada, Arizona, SE California). These are alluvial fans and dry washes. Gold sits on true bedrock or on **false bedrock** (caliche or clay layers) within 0–20 ft. The gold is finer and the deposits are lower grade and erratic. Water, not season, is the constraint.
- **Beach placers** (Nome). These are modern and raised or buried ancient beach lines. Gold is fine and flaky and sits in thin, laterally continuous layers. They are a niche type for this game.

**Typical numbers by region**

| Region | Overburden | Pay gravel | Bedrock taken | Depth to bedrock | Strip ratio (waste:pay) |
|---|---|---|---|---|---|
| Klondike valley bottoms | 3–50 ft muck (2–16 m on Dominion [V-R2]) | 3–13 ft | 1–3 ft schist | 10–60 ft | 3:1–10:1 [V-R2 range] |
| Klondike benches (White Channel) | 10–100+ ft Klondike gravel and muck | gold through 10–100 ft, richest at the base | 1–3 ft | 20–150 ft | 2:1–8:1 if bulk-mined; higher if base only |
| Interior AK shallow creeks (Fortymile, Circle) | 3–20 ft | 3–8 ft | 1–3 ft | 6–30 ft | 1:1–5:1 |
| Fairbanks deep ground | 20–100+ ft muck | 5–20 ft | 1–4 ft | 30–200 ft | 6:1–20:1 (historically drift or thaw-and-dredge) |
| Nevada / Arizona fans and washes | 0–15 ft | 2–10 ft (often several thin layers) | 0.5–2 ft, or false bedrock | 3–25 ft | 0.5:1–3:1 |
| California river bars / bench | 0–20 ft | 3–15 ft | 1–3 ft | 5–40 ft | 0.5:1–4:1 |

- **Bedrock types and trapping** [U]:
  - Foliated or fractured **schist** (Klondike Schist, Fairbanks area): gold goes **1–3 ft** deep in cracks.
  - **Slate or phyllite with steep cleavage**, and **karst limestone**: deep natural riffles, gold to **3–6+ ft**.
  - **Granite**: weathers to grus, and gold stays near the top.
  - **Basalt or massive volcanics**: smooth, poor traps.
  - **Clay false bedrock**: concentrates gold *on top* of the clay, partway up the gravel column. Gold does not go into it.
- **Bedrock cleanup:** operators rip and wash **1–3 ft** (up to 5 ft in deep-cracked bedrock). It supplies **10–30% of a cut's gold**, sometimes more than half on rich creeks where the gold "went into bedrock". Ripped bedrock swells 1.3–1.5× and wears equipment hard.
- **Pay volume check** [D]: one 1-acre block with 5 ft of pay = 8,067 bcy. At 0.01 oz/bcy that is 81 raw oz per acre. A 20-acre claim with 8 acres in the paystreak holds ~64,500 bcy and ~645 raw oz at 0.01 oz/bcy.
- **Swell and units:** gravel 1.15–1.25 (R2/GUIDE use 1.20); muck 1.3; ripped bedrock 1.3–1.5. Plants are often rated in **loose** yd3/h, so a "100 yd/h" plant processes ~80 bcy/h.
- **Surprises and misunderstandings:**
  - "Pay" is the slice worth mining, not all the gravel. The miner chooses pay thickness: taking more of the column adds ounces but dilutes the grade. That is a cutoff decision.
  - Paystreaks do not follow the modern creek, so cross-valley fences are needed to find them.
- Game implication: generate each claim as a down-valley paystreak mask (width 30–300 ft, with lateral wander) over a barren or low-grade valley fill. Per block, draw `overburdenFt`, `payThicknessFt`, and `bedrockCleanupFt` (1–3 ft, holding 10–30% of block gold). Make "pay thickness mined" a player choice that trades ounces against grade.

---

## 2. Grade distributions, continuity, and the nugget effect

**Grade bands (raw oz per bcy of mined pay, including bedrock cleanup)** [U]

| Band | oz/bcy | g/m3 | Where you see it |
|---|---|---|---|
| Background / waste | <0.003 | <0.12 | most valley fill outside the paystreak; upper gravels |
| Marginal | 0.003–0.007 | 0.12–0.29 | economic only for large, low-strip, efficient plants at $4,000+ gold. R2: ~0.005 oz/yd3 is now viable for efficient large Yukon operations [S via R2] |
| Average modern pay | 0.008–0.02 | 0.33–0.8 | typical Yukon and Alaska working cuts |
| Good | 0.02–0.05 | 0.8–2.0 | a claim people compete for |
| Rich | 0.05–0.2 | 2–8 | short paystreak sections, bedrock traps, below tributary junctions |
| Bonanza | >0.2 (to several oz/bcy) | >8 | pockets of hundreds to a few thousand bcy. The original Eldorado and Bonanza drift pay; upper Bonanza hand-mined ground returned ~0.26–0.39 oz/yd3 [S via R2] |

- **Historic cutoffs show how much ground old-timers left** [U]:
  - Klondike and Fairbanks drift mining needed roughly **0.25–0.5 oz/yd3** (about $5–10/yd at $16–20.67 gold).
  - Hand open-cut shovelling-in needed ~0.05–0.1.
  - $35-era bucketline dredges worked **0.005–0.015 oz/yd3**. Large California dredge fields went as low as **~0.002–0.005**.
- **Converting old records** [D]: $1/yd at $20.67/oz = 0.0484 oz/yd; at $35/oz = 0.0286 oz/yd. Klondike raw gold traded at about $16/oz in 1898 [U] because of its ~0.78–0.80 fineness, so $1/yd there ≈ 0.0625 *raw* oz/yd. Old reports in "cents per pan" or "$ per yard" are only meaningful once converted at the price of their era.
- **Lognormal behaviour** [D on the math; σ values U]:
  - Mean/median = exp(σ²/2): σ = 1.0 gives 1.65×; σ = 1.5 gives 3.1×; σ = 2.0 gives 7.4×.
  - Share of gold carried by the top 10% of samples: 39% at σ = 1.0, 59% at σ = 1.5, 76% at σ = 2.0.
  - Typical log-σ by support size: pans and small drill samples **1.5–2.5**, zero-inflated (many blanks); test pits (1–10 bcy) **0.8–1.3**; 1-acre blocks within a paystreak **0.4–0.8**; between claims in a district **0.7–1.0**.
- **Spatial continuity** [U]:
  - Grade is strongly anisotropic. Correlation range (variogram) is **~300–1,500 ft along the valley** but only **~50–200 ft across it** (3:1 to 10:1 anisotropy).
  - Rich zones cluster at inside bends, bedrock riffles and ledges, below canyon mouths, and below tributary junctions where a gold-bearing side creek enters.
  - Relative nugget effect (C0/sill) is **40–80%** for drill-size samples and falls to **10–30%** for bulk samples.
- **Why small samples mislead (particle counting).** Use the Poisson behaviour of particle counts.
  - Representative particle masses [D], for flattened flakes of ~0.80-fine gold at ~17 g/cm3: 0.075 mm ≈ 0.0015 mg; 0.15 mm ≈ 0.012 mg; 0.5 mm ≈ 0.4 mg; 1 mm ≈ 3 mg; 2 mm ≈ 30 mg; 4 mm ≈ 300 mg; 10 mm nugget ≈ 5 g (0.17 oz).
  - Expected particles in a sample = grade × sample volume / mean particle mass. The relative standard deviation is ≈ 1/√N. The chance that a sample contains *zero* particles of a size class is e^(−N).
  - Clifton et al. (USGS Prof. Paper 625-C, 1969) [U]: a sample must contain **≥ ~20 particles for ±50% at 95%**. ±10% needs ~400.
  - Heavy-tailed particle masses (one nugget dominating) push the real variance up further. Multiply the Poisson CV by √(1 + CV_mass²); CV_mass of 1–3 gives a factor of **1.4–3.2×** (compound Poisson).

**Worked table** [D]. True grade 0.01 oz/bcy (311 mg/bcy), with gold split 30% coarse / 40% medium / 22% fine / 8% ultrafine by mass. Mean particle masses: 150 / 3 / 0.1 / 0.004 mg.

| Sample | Pay volume | Coarse particles | Medium | Fine | Chance of no coarse | Poisson CV of coarse part |
|---|---|---|---|---|---|---|
| One pan (~1/150 bcy) | 0.0067 bcy | 0.004 | 0.28 | 4.6 | 99.6% | ~1,600% |
| 6-in sonic core, 5 ft of pay | 0.036 bcy | 0.022 | 1.5 | 25 | 98% | ~670% |
| 8-in core / large Becker, 5 ft | 0.065 bcy | 0.04 | 2.7 | 45 | 96% | ~500% |
| Excavator test pit, processed | 3 bcy | 1.9 | 124 | 2,050 | 15% | 73% |
| Trench composite | 20 bcy | 12 | 830 | 13,700 | ~0% | 29% |
| Bulk sample | 300 bcy | 187 | 12,400 | 205,000 | 0% | 7% |

- **Reading the table:** a drill hole with no coarse particle reports ~70% of the true grade. A hole that catches one 150 mg particle adds **~0.13 oz/bcy from that single particle**, 13× the true mean. Drilling therefore gives a low median with rare huge spikes, and in coarse-gold ground the *average* of many holes is what matters.
- Game implication: implement `drawSample` exactly this way. For each size class, draw a Poisson particle count from (grade × share × volume / particle mass), draw particle masses from a lognormal, then apply method noise (volume error, fine-gold processing loss). Bulk samples then converge, and pans and drill holes stay noisy without anything faked.

---

## 3. Old-timer workings and re-mining

- **Klondike drift mining (1897–c.1920)** [U]:
  - Shafts went 10–60 ft through frozen muck to bedrock. Ground was thawed with wood fires (≈1–2 ft of face per overnight burn), then with **steam points** from ~1898.
  - Miners drifted the bottom **4–6 ft** (pay gravel plus some bedrock), left pillars, and hoisted to winter dumps that were sluiced at spring breakup.
  - Fairbanks drift shafts reached **50–250 ft**.
  - Inside a drifted area, **60–90%** of the rich bottom pay was taken. Left behind: pillars (~15–30%), the lower-grade margins and upper gravels (below their 0.25+ oz/yd3 cutoff), deeper bedrock, and caved, ice-filled workings.
- **Hand-era recovery** [U]: rockers and sluices caught coarse gold well but lost much of the −60 mesh fraction. Overall recovery was **~60–85%**. Mercury was used in sluices, so **legacy mercury and amalgam** turn up in old tailings and bedrock cracks. That is a gold-room and health hazard, and it can be an environmental finding.
- **Dredged ground** (Klondike dredges 1899–1966; Fairbanks and California through mid-century) [U]:
  - Dredges reworked valley bottoms to bedrock, but they skipped hard-bedrock zones, boulder patches, deep spots, and areas under camps.
  - They took only the top ~1–2 ft of bedrock and lost fine gold.
  - Dredge tailings usually run **0.001–0.005 oz/bcy**, rarely economic except where bedrock was left uncleaned.
- **Tailings and remnant values** [U]:
  - Pre-1910 hand tailings and dumps: **0.005–0.05 oz/bcy**. Fine-gold losses and careless sluicing in very rich ground make these targets.
  - 1950s–80s bulldozer/sluice tailings: 0.002–0.01.
  - Ground around old drifts: 0.005–0.05, with strong variance from collapsed workings.
- **Records:** Yukon has the Yukon Placer Database/atlas (production by creek). Alaska has ARDF and DGGS reports, and USGS has MRDS. Old dredge-company drill logs (USSR&M in Fairbanks, Yukon Consolidated in the Klondike) are the best evidence a buyer can get; few listings would have them.
- **Surprise:** "mined out" ground is often the *best* modern ground. Old cutoffs were 5–50× today's in oz/yd3, and old recovery lost the fines.
- Game implication: `minedOutFraction` should hit the richest blocks hardest. Drifted blocks lose 60–90% of their bottom pay, but their tailings and dumps become low-grade re-mine blocks. Records review ($500–5k) is a cheap way to reveal old-timer footprints and historical $/yd (converted at historical prices).

---

## 4. Particle size mix and fineness

**Mesh reference** (Tyler/US approx.) [U]: 4 mesh = 4.75 mm; 8 = 2.36; 10 = 2.0 (US) / 1.7 (Tyler); 20 = 0.85; 35 = 0.42; 48 = 0.30; 60 = 0.25; 100 = 0.15; 150 = 0.105; 200 = 0.075. The GUIDE size classes line up as coarse >2 mm (+10 mesh); medium 0.5–2 mm (10–35 mesh); fine 0.15–0.5 mm (35–100 mesh); ultrafine <0.15 mm (−100 mesh).

**Illustrative gold-mass split by deposit type** (coarse / medium / fine / ultrafine; suggested starting priors, [U]):

| Deposit setting | Split | Examples |
|---|---|---|
| Proximal creek, near lode source | 45 / 35 / 15 / 5 | upper Bonanza and Eldorado, Fortymile, Chicken, Circle headwaters |
| Typical northern creek, mid-reach | 25 / 40 / 27 / 8 | lower Klondike creeks, Indian River, Fairbanks creeks |
| Bench / White Channel (reworked older gravel) | 15 / 40 / 35 / 10 | Klondike benches |
| Distal big-river bars | 0 / 10 / 45 / 45 | Yukon River bars, Fraser bars, Snake River "flour gold" |
| Desert fan / dry wash | 10 / 30 / 40 / 20 | Nevada and Arizona fans (proximal gulches can be nuggety) |
| Beach | 5 / 30 / 50 / 15 | Nome |

- **Particle shape** [U]: rough, crystalline, or quartz-attached gold has travelled less than ~1–2 km from its lode. Flattened, folded, rounded flakes have travelled far. A geologist can read shape from pans as a qualitative hint ("coarse gold upstream").
- **Fineness by district** (lot averages, approximate, [U] except where tagged):

| District | Typical fineness | Notes |
|---|---|---|
| Klondike overall | ~0.80 [V-R2: YGS impurities ~20% of crude] | creek range ~0.70–0.88; Eldorado and Bonanza ~0.73–0.82 are lower; some outer creeks (Indian River, Dominion) ~0.82–0.86 |
| Sixtymile / Stewart (Yukon) | 0.80–0.88 | |
| Fortymile (AK/YT) | 0.85–0.90 | known for high-fineness, coarse gold |
| Fairbanks district | 0.80–0.86 | |
| Circle, Livengood | 0.82–0.90 | |
| Nome | 0.86–0.90 | |
| Atlin / Cariboo (BC) | 0.80–0.88 | |
| California Sierra placers | 0.85–0.93 | |
| Montana / Idaho placers | 0.70–0.85 | |
| Nevada placers | 0.60–0.85 | electrum-rich; Ag commonly 15–35% |
| Arizona placers | 0.80–0.92 | |

- **What is in crude gold** [U]: silver is the main alloy, at 5–30% in northern gold. There are traces of Cu, Hg, and Fe. Even "cleaned" gold carries 1–5% non-metal (black sand, quartz), plus tramp metal: **lead shot, bullets, nails**. Lead shot is a classic Klondike contaminant and gets picked out.
- **Variability:** individual particles range from 0.5 to 0.99 fine. Leached high-fineness rims form on transported gold. Claim-to-claim lot fineness within a district varies with SD ~0.02–0.04.
- Game implication: give each district a fineness mean (0.70–0.92) and each claim an offset (SD ~0.03). Each deposit type carries a size-mix prior, jittered per block. Size mix should drive which recovery circuit pays off (see §7).

---

## 5. Ground conditions

**Permafrost** (Klondike and Interior Alaska are discontinuous; valley bottoms and north-facing slopes are frozen, south slopes and benches often are not) [U unless tagged]
- **Muck:** ice-rich organic silt, often **20–80% ice by volume**, with massive ice wedges. When it thaws it loses 20–60% of its volume and turns to slurry. It cannot be dug while thawing, so it is stripped in thin lifts as it thaws, or washed off with monitors.
- **Natural thaw:**
  - Under intact vegetation, the active layer is only **1–3 ft** per summer.
  - Stripped, drained gravel thaws **~3–6 ft per summer** on south or sun-exposed ground, and **1.5–3 ft** on shaded, wet, north-facing ground.
  - Peak thaw of freshly exposed ground is **2–4 in/day (5–10 cm/day)** in June and July [U, same as R2 M-figure]. It slows as the thawed layer insulates, unless that layer is skimmed daily ("thaw and strip").
- **Practice:** clear in winter, strip muck in late summer and fall, rip frozen gravel, and **strip one season ahead** so next year's pay is thawed and drained [V-R2 for the practice].
- **Ripping and digging frozen ground:** dig rate falls to **20–50% of thawed** [R2: 50–80% reduction], ripper hours rise, and undercarriage and GET wear go up 1.3–2×.
- **Cold-water thawing** (Fairbanks 1920s–60s, ahead of dredges) [U]: ¾–1.5 in points were driven to bedrock on **16–32 ft centres**, and ambient stream water was pumped through them. Full depth took **~60–120 days**, and ground was thawed **1–2 seasons ahead**. Implied rate [D]: 16-ft triangular spacing, 40 ft deep, 90 days ≈ **3–4 bcy per point-day**. Historic cost was about $0.10–0.20/yd3 (1930s $). It needs a water right or licence and is rare today. Steam points (drift era) thawed only a few yd3 per point-shift at high fuel cost.
- **Hydraulic stripping (monitors):** used in the Klondike historically and still by a few operators. It is fast on muck but needs a large water licence (Yukon Class 4) and creates heavy sediment loads.
- **Clay** [U]:
  - Clay-bound gravel needs scrubbing.
  - Without it, clay balls roll out with the oversize carrying gold. Losses can reach **10–30%** in sticky clay.
  - Trommel residence time is **~30–90 s for clean gravel** and **2–4 min for clay**. Feeding clay drops trommel capacity **30–50%**, and water needs rise to **25–35 gpm per yd3/h** [R2].
  - Severe clay calls for a log washer or scrubber barrel ahead of the screen.
  - Clay layers act as false bedrock and hold up perched pay.
- **Boulders:**
  - Cobbles and boulders to 1–2 m are common in glacial or proximal ground.
  - **+6–12 in** material is rejected at a grizzly or derocker. Boulders over ~2 ft must be removed in the pit.
  - Boulder content over 20–30% cuts dig and haul productivity **10–30%**, raises plant wear, and jams sluices.
  - Drilling suffers too: auger and RC struggle, so use sonic or Becker.
  - Nuggets bigger than the screen aperture leave with the oversize.
- **Tight or cemented gravel:** White Channel gravel and caliche-cemented desert gravel need ripping. Dig productivity falls **20–50%**.
- Game implication: per-block `permafrost`, `clay`, and `boulders` (0–1) map to multipliers. Dig rate: frozen ×0.2–0.5, cemented ×0.5–0.8, bouldery ×0.7–0.9. Plant capacity: clay ×0.5–0.85. Clay without a scrubber also adds a recovery penalty of up to −20% on all sizes. Add per-cut `thawProgress` state: thaw ft/week = base (0.3–0.7 ft/week on stripped ground in summer) × weather factor, and 0 under unstripped muck beyond the active layer.

---

## 6. Sampling methods: costs, speeds, volumes, reliability

**Method table** (2025 USD for the remote north; Lower-48 road access ~0.6–0.8×; all [U])

| Method | Unit cost | Speed | Pay volume per sample | Reliability and limits |
|---|---|---|---|---|
| Panning (prospector) | labor $25–45/h ≈ $0.5–3 per pan | 8–20 pans/h; 60–150/day per person | ~0.004–0.009 bcy (100–200 pans/bcy, ~150 typical) | presence, particle size and shape only; grade meaningless except for fine gold; casual use |
| Hand pit / shovel test | $300–800 per pit | 1–3/day, to 4–6 ft | 0.1–0.5 bcy | shallow, rarely reaches bedrock in the north |
| Excavator test pit + small test plant | **$500–1,500** own machine; **$2–5k** contracted | **4–12/day** shallow and thawed; **1–4/day** deep or wet | **1–10 bcy** processed | best cheap grade tool; 30-t machine reaches ~20–24 ft, 45-t ~25–28 ft; caving or water inflow can stop it short of bedrock; frozen ground needs ripping; needs a Notice (U.S.) or Class 1 (Yukon ≤400 m3/claim [V-R2]) |
| Trench (cross-valley) | $10–40/ft | 100–400 ft/day | 10–50 bcy per composite | defines paystreak width and position; same depth limits as pits |
| Bulk sample through the real plant | **$15–35/bcy** incl. stripping (≈ operating cost) | 50–500 bcy/day | **100–1,000 bcy** | best grade *and* recovery test; U.S. Notice cap <1,000 short tons ≈ **590 bcy** [D from R1 rule] |
| Auger (hollow-stem) | $15–40/ft | 200–800 ft/day | tiny | fails in coarse gravel and boulders; OK in fines and tailings |
| Churn / Keystone (cable tool) | $60–150/ft (few rigs left) | 20–60 ft/day; 0.5–2 holes/day | ~0.01 bcy/ft (6-in casing) | the historic placer standard; volume ("Radford") factor error ±20–30% |
| Reverse circulation (dual-tube) | $50–100/ft | 200–600 ft/day; 5–15 holes/day | ~0.005 bcy/ft | fast; loses or smears fine gold; downhole contamination; boulders slow it |
| Becker hammer (driven dual-wall RC) | $80–150/ft; $8–15k/day | 150–400 ft/day | ~0.009 bcy/ft | handles boulders and permafrost; a Yukon/BC placer workhorse |
| Sonic (6-in core) | **$100–200/ft** all-in | **100–250 ft/day**; 2–6 holes/day | **0.0073 bcy/ft** [D] | ~95–100% core recovery and true volume, but small support → heavy nugget effect |
| Drill mobilization | road access $15–40k; winter road or fly-in $50–150k | — | — | dominates small programs |
| Geophysics (GPR / ERT / seismic) | $2–5k/day | 1–5 line-km/day | — | depth to bedrock and paleochannels ±10–20%; no grade |
| Drill sample processing | $30–150/sample | — | 2.5–5 ft intervals | wash, concentrate, pick, weigh to 0.1 mg; never fire-assay bulk gravel |
| Consulting geologist | **$900–1,600/day** + expenses | — | — | placer evaluation report $15–50k; NI 43-101 / S-K 1300 technical report **$60–200k** |

- **Program magnitudes** [D from the table]:
  - **Test-pit program**, 40 pits on a 20-acre claim: 8–15 machine-days with your own excavator and crew, **$25–60k**.
  - **Sonic program**, 3 fences × 8 holes × 40 ft = 960 ft. At $150/ft that is $144k, plus mobilization $40k, processing $15k, and geologist $25k: **≈ $225k** for one claim group at inferred level.
  - **Bulk sample**, 500 bcy: **$10–25k** direct, plus a Notice and its bond.
- **Spacing vs confidence** [U; industry practice and suggested game classes]:

| Class | Typical evidence | Suggested 90% CI on contained oz |
|---|---|---|
| Speculative | seller claims, records, pans | ±100%+ (and biased) |
| Inferred | fences 400–800 ft apart, holes or pits 25–50 ft apart on each line | ±50–100% |
| Indicated | fences 100–300 ft apart, plus ≥1 bulk test reconciled | ±25–40% |
| Measured | close spacing, plus multiple bulk tests or a season of production on the same paystreak | ±10–25% |

- **Formal language:** CIM Definition Standards (NI 43-101, Canada) and SEC S-K 1300 (U.S.) both use Inferred / Indicated / Measured resources and Probable / Proven reserves. Reserves need at least a pre-feasibility study. Many small Yukon and Alaska family operations never have a compliant resource and mine on test pits. Placer is notoriously hard to classify; most junior placer resources are Inferred.
- **Why pit and seller samples overstate grade:**
  - Sampling the bedrock scrape or concentrate only.
  - Cherry-picking pits.
  - Ignoring mining dilution (10–30% from overburden and walls).
  - Hand-panning samples catches fines the plant will lose.
  - Quoting **grade per yard of screened feed** ("per yard in the box"): with 20–40% oversize rejected, that reads **1.25–1.7× bank grade** [D].
  - Quoting oz per hour or per day without a volume.
  - **Salting** (outright fraud).
- **Why they understate grade:**
  - Small samples miss coarse particles, so the median is low (see §2).
  - Pits stop short of bedrock because of water, caving, or frost, missing the richest layer and the bedrock cleanup.
  - RC and auger lose fines.
  - Loose-yard volumes are used as if they were bank volumes.
- **Reconciliation:** production/estimate ratios of **0.6–1.5** are common. Coarse-gold ground tested by small-diameter drilling tends to **outperform** the estimate. Seller and pan-based claims tend to **underperform** [U].
- Game implication: every method row becomes data: cost, crew, machine, days, volume per sample, noise terms (volume CV, fine-gold processing recovery, bias), permit tier, and maximum depth (pits fail where bedrock is deeper than reach or the ground is frozen). Confidence class should come from spacing *and* support volume, not just sample count.

---

## 7. Processing and recovery

**Front end: sizing and scrubbing** [U]
- **Grizzly (static bar screen):** bars 2–6 in apart over a feed hopper, loader-fed. It is cheap but does no scrubbing and plugs in clay. It is the classic small "dump box + sluice" plant at 30–100 yd3/h.
- **Derocker / vibrating grizzly:** removes +2–4 in rock under spray. It feeds sluice runs at 50–200 yd3/h. It is simple and good on clean gravel.
- **Trommel:** a rotating drum **4–10 ft in diameter, 20–50 ft long**. About a third of it is a blind scrubber section with lifters; the rest is a screen of ½–1 in punch plate (¾ in is common).
  - It turns at 8–20 rpm (~30–40% of critical speed) on a 3–6° slope, with spray bars at 40–80 psi.
  - Sizes: portable test units 10–30 yd3/h; production trommels 50–75 (small), 100–200 (mid), 250–500 (large).
  - It is the best choice for clay, and it needs the most power.
- **Shaker deck / screen plant:** a double or triple-deck vibrating screen (5×12 to 8×20 ft), with a bottom deck of ⅜–¾ in.
  - It gives high capacity per dollar (100–400 yd3/h) but scrubs less than a trommel.
  - It is the dominant mid-to-large Klondike configuration: screen deck plus 2–4 sluice runs.
- **Effective vs nameplate throughput:** averages **60–80%** of rated, because of feed interruptions, oversize, plugging, moves, and cleanups. Plant utilisation is 60–85% of scheduled hours.

**Recovery devices** [U]
- **Sluice runs:**
  - Production runs are **3–6 ft wide** and **20–60 ft long**.
  - Slope: 1–2 in/ft (8–17%) for coarse classified feed; **0.5–1 in/ft (4–8%)** for fine-gold runs.
  - Riffles: Hungarian, angle-iron, or **expanded metal over ribbed rubber or Nomad-type matting**.
  - Loading should stay at **≤ ~8 loose yd3/h per ft of width** [S via R2].
  - Water depth 2–4 in. Slurry is ~5–15% solids by volume, i.e. **~3–10 volumes of water per volume of gravel** [D from 650–2,000 gal/yd3, V-R2].
- **Jigs** (circular IHC on dredges; small duplex or rectangular jigs at 2–40 tph):
  - Feed is screened −¼ to −⅜ in.
  - Recovery is strong on 10–150 mesh, but flaky fine gold reports poorly.
  - Jigs are used as primary fines recovery or for upgrading sluice concentrate.
- **Centrifugal concentrators** (Knelson- or Falcon-type batch units; small placer units ~1–5 tph; mid units 30–60 tph):
  - Feed must be screened to −2 to −6 mm, which is typically **25–45% of plant feed mass**.
  - They need clean pressurised fluidisation water.
  - In the field they recover **85–95% of 20–150 mesh** and **60–80% of −150+325 mesh**. Lab and vendor figures claim more.
  - Heavy **black sand (magnetite) crowds the bed**, so batch cycles shorten to 0.5–4 h.
  - Prices: small $15–60k; mid $150–300k new.
- **Shaker tables** (gold room):
  - Throughput is 50–150 lb/h (small) to 0.25–1 tph.
  - They recover >95% of free gold down to ~100 mesh from clean concentrate.
  - Used for upgrading, not primary recovery.

**Recovery by particle size (field-realistic ranges, % of contained gold in that size)** [U]. Sources consistent with this: Poling & Hamilton 1986; Wenqian & Poling 1983; Yukon sluice testing; vendor data.

| Size | Sluice, well run | Sluice, overloaded or poorly set | Jig (on screened fines) | Centrifuge (on screened fines) |
|---|---|---|---|---|
| +10 mesh (>2 mm) | 95–99 | 85–95 | (oversize to sluice) | (screened out) |
| 10–20 mesh | 92–97 | 75–90 | 90–97 | 90–98 |
| 20–60 mesh | 80–92 | 50–75 | 85–95 | 90–97 |
| 60–100 mesh | 60–80 | 30–50 | 70–90 | 85–95 |
| 100–150 mesh | 40–60 | 15–35 | 50–75 | 75–92 |
| −150 mesh | 10–35 | 5–15 | 20–50 | 50–80 |

- **Mapped to GUIDE size classes:** the anchors (sluice-only 0.95/0.88/0.62/0.25; +jig 0.96/0.92/0.85/0.55; +centrifuge 0.96/0.92/0.90/0.70) sit inside these ranges. Keep them.
- **Whole-plant recovery** [U]:
  - Coarse-gold creek, trommel plus sluice: **85–95%**.
  - Mixed northern pay: **70–85%**.
  - Fine-gold deposit, sluice only: **40–65%**. Adding a jig or centrifuge circuit on the fines brings it to **75–90%**.
- **Feed rate over rated capacity** [U]:
  - Riffles pack with sand and gravel, velocity and turbulence rise, and fine gold scours out.
  - Rule of thumb: **+25% over rated ≈ 1.5× fine/ultrafine losses; +50% ≈ 2×+**. Coarse gold barely changes.
  - Suggested form [D, for tuning]: loss_size = base_loss_size × max(1, feed/rated)^k, with k ≈ 0.5 coarse, 1.5 medium, 2–3 fine and ultrafine.
- **Water ratio:**
  - Too little water packs riffles, which hits fines and medium gold.
  - Too much raises velocity and scours fines.
  - The sweet spot is ~10–15 gpm per yd3/h for trommel or screen plus sluice [V-R2 range 11–33].
  - Penalise both sides of the optimum, the fine classes most.
- **Operator skill:** it covers slope, water, feed rate, and riffle condition. Suggested effect is **±10–20 percentage points** on fine and ultrafine and ±2–5 points on coarse.
- **Loss mechanisms beyond size:**
  - Nuggets bigger than the screen aperture leave with the oversize. Use a nugget trap and metal-detect the oversize pile.
  - Clay balls.
  - Gold locked in quartz.
  - **Float gold**: diesel, grease, or old mercury films make fine gold hydrophobic. A hydraulic leak into the wash water is a real loss event.
  - Worn mats.
  - Bedrock not cleaned to depth.
  - **High-grading (theft) by crew** at cleanup.

**Cleanup and the gold room** [U]
- **Frequency:** clean up when riffles pack or gold load builds. Rich ground needs it daily to every 3 days. Average ground: every **1–2 weeks** (~50–150 sluice hours). Large plants usually clean weekly.
- **Downtime:** **0.5–1 shift** (4–12 h) of plant time per cleanup, longer for multiple runs.
- **Process:**
  1. Pull and rinse mats into tubs.
  2. Screen the concentrate. A weekly cleanup of a 100–200 yd3/h plant yields roughly **0.2–2 t** of sluice concentrate.
  3. Upgrade on a shaker table or fine-gold sluice, then a magnet (removes magnetite), then hand panning or a bowl. Pick out lead shot and tramp metal.
  4. Dry, blow or winnow, and weigh on a certified scale. This weight is **"raw" or "crude" oz**.
  5. Melt in an induction or propane furnace at **~1,100–1,250 °C** with borax, soda ash, and silica flux. Pour **doré bars of 50–500 oz**.
- **Melt loss:** **1–5%** for well-cleaned gold, 5–15% for dirty concentrate.
- **Assay:** a fire assay of the bar sample costs ~$30–80. The refinery pays on assayed Au, plus Ag above a threshold (R5's topic).
- **Weight chain example** [D]: 100 raw oz → ~97 oz doré (3% melt loss) → at 0.82 fineness, ~79.5 fine oz Au, plus ~12–15 oz Ag.
- Some small miners sell cleaned raw gold unmelted. **Natural nuggets** over ~1 g can sell to collectors at a **10–100%+ premium** over metal value [U]. That could be an optional sales channel (R5/§10).
- Game implication: cleanup is a scheduled stage. It costs plant hours, carries a theft and high-grading risk that depends on gold-room staffing, converts riffle-held gold to raw oz, and reports raw oz first. Fine oz appear after the melt and assay. Riffle saturation can be a small penalty for stretching cleanup intervals in rich ground.

---

## 8. Detecting lost gold

- **Tailings sampling:**
  - Take a timed cut of sluice tailings (for example, 1–2 buckets per hour composited per shift) and run it through a centrifuge or fine-gold test sluice.
  - Convert the result to g/m3 lost and compare it with the recovered grade.
  - Well-run plants typically find **2–10%** of feed gold in the tails. Poorly run plants on fine gold find **15–40%** [U].
- **Oversize checks:** metal-detect oversize and derocker piles. Missed nuggets show up here first.
- **Gold balance (reconciliation):** compare raw oz recovered with the oz expected from the block estimate and the volume washed. A persistent shortfall points to losses, theft, or an over-optimistic estimate. Telling them apart requires tailings sampling.
- **Size analysis of recovered gold:** if the cleanup has little −60 mesh gold where pans showed plenty of fines, the fines are going out the back.
- **Reworking tailings:** re-running a season's tailings through a fines circuit is a real practice. It is economic when losses were 15%+ in good ground.
- Game implication: give the player a cheap "tailings audit" action ($500–2,000 and a few hours of a plant operator) that reveals an estimate of `lostRawOzBySize` with noise. Better staff and equipment shrink the noise. This makes the recovery model visible and gives a reason to buy a centrifuge.

---

## 9. Design cross-checks (derived)

- **Economics sanity check** [D, U inputs]:
  - Gross per pay yard: 0.01 raw oz/bcy × 0.80 fineness × 80% recovery × $4,200 = **$26.9 per pay bcy**.
  - Cost per pay yard at a 4:1 strip: 4 × $2.5 stripping + $12 dig/haul/wash = **$22**.
  - That is a thin but positive margin before royalties and debt. Breakeven at this cost structure is **~0.008 oz/bcy**. At 6:1 strip it is ~0.01. On low-strip desert ground ~0.004–0.005.
  - This matches the brief: most listed ground (median 0.004–0.012) should be marginal once stripping is counted.
- **Season check** [D]: 60,000 bcy washed × 0.012 oz/bcy × 75% recovery = 540 raw oz, about the R2 mean (300–700 oz per northern operation). The GUIDE reference operation is consistent.
- **Sample-support rule:** to get ±25% (95%) on the coarse fraction, a sample needs ~64 coarse particles. At 0.6 coarse particles/bcy (the §2 split) that is ~100 bcy. **Coarse-gold claims can only be valued by bulk sampling or production**, which is a central and realistic tension for the game.

---

## Sources

None of these could be retrieved this session (WebSearch quota exhausted; egress proxy blocked all fetches). The first group names standard references from model knowledge: designers should verify before quoting them as citations. The second group lists URLs verified by the sibling R2 sheet this session, for the figures tagged [V-R2].

**Standard references (model knowledge, not retrieved)**
- Clifton, H.E., Hunter, R.E., Swanson, F.J., Phillips, R.L. (1969). *Sample Size and Meaningful Gold Analysis*. USGS Professional Paper 625-C. Supports: the particle-count (Poisson) rule of ≥20 particles for ±50%.
- Wells, J.H. (1969, rev. 1989). *Placer Examination: Principles and Practice*. U.S. BLM Technical Bulletin 4. Supports: pan counting, volume factors, placer valuation practice.
- Macdonald, E.H. (1983; 2007 ed.). *Alluvial Mining: The Geology, Technology and Economics of Placers*. Supports: drilling methods, Radford/volume factors, sampling bias, dredge-era grades.
- Poling, G.W. and Hamilton, J.F. (1986). *Fine Gold Recovery of Selected Sluicebox Configurations* (Yukon placer research, Indian and Northern Affairs Canada / CANMET-era study). Supports: sluice recovery by size; expanded metal and matting.
- Wenqian, W. and Poling, G.W. (1983). "Methods for recovering fine placer gold." *CIM Bulletin* 76(860). Supports: fine-gold recovery limits of sluices, jigs, and tables.
- Yukon Geological Survey, *Yukon Placer Mining Industry* reports and *Yukon Exploration and Geology* placer overviews (annual, through 2025). Placer atlas and Yukon Placer Database. Supports: Klondike stratigraphy, White Channel description, production, fineness ~0.80.
- Lowey, G.W. (2004–2006). Papers on Klondike placer geology and the White Channel Gravel. Supports: bench/White Channel geometry.
- Chapman, R.J., Mortensen, J.K., LeBarge, W.P. (c. 2010–2011). Klondike placer and lode gold microchemistry. Supports: Klondike fineness range and Ag content.
- Metz, P.A. and Hawkins, D.B. (1981). *A Summary of Gold Fineness Values from Alaska Placer Deposits*. University of Alaska Mineral Industry Research Laboratory. Supports: Alaska district fineness.
- Janin, C. (1918). *Recent Progress in the Thawing of Frozen Gravel in Placer Mining*. USBM Technical Paper 155. Boswell, J.C. (1979). *History of Alaskan Operations of USSR&M*. Supports: cold-water and steam-point thawing practice.
- CIM Definition Standards (2014) and CIM MRMR Estimation Best Practice Guidelines (2019); SEC Regulation S-K subpart 1300 (17 CFR 229.1300–1305). Supports: Inferred / Indicated / Measured language.
- FLSmidth Knelson and Sepro Falcon product literature; Gemeni shaker table literature. Supports: centrifuge and table capacities and claimed recoveries.
- USGS Bulletin 1693 (Cox and Singer, 1986), placer Au-PGE descriptive model (Yeend): https://pubs.usgs.gov/bul/b1693/ (fetch attempted; blocked). Supports: deposit-type framing.

**Verified by R2 this session (see R2-ak-yukon-seasons.md Sources for the full list)**
- https://ygsftp.gov.yk.ca/ygsftp/publications/yeg/yeg16/overview/Placer.pdf and https://ygsftp.gov.yk.ca/ygsftp/publications/placer_atlas/aurion_placers_indian_river.pdf: Dominion Creek 2–16 m muck over 3–4 m gravel; Indian River pay ~5 ft.
- https://ygsftp.gov.yk.ca/ygsftp/ApexUploads/Publications/96029/2_Placer_summary.pdf: crude-gold impurities ~20% (fineness ~0.80).
- https://ygsftp.gov.yk.ca/ygsftp/ApexUploads/Publications/96059/2_Placer_Summary.pdf and https://ygsftp.gov.yk.ca/ygsftp/ApexUploads/Publications/96137/YEG2025_2_Placer_Overview.pdf: Yukon 2024 85,799 crude oz / 156 operations; 2025 104,367 crude oz / 165 operations (~550–630 crude oz per operation).
- https://www.akbizmag.com/industry/mining/modern-prospecting-small-mines-alaska-sized-impact/: Alaska 2018, ~200 placer mines produced 60,691 oz (~300 oz per mine).
- https://www.911metallurgist.com/blog/gravity-gold-process-water-requirements/: 650–2,000 gal per yd3 for stationary plants.
- https://discoveryalert.com/education/placer-mining-yukon-klondike-gold/ and https://www.firgelliauto.com/blogs/mechanisms/klondike-mining-machine (secondary, tagged [S] in R2): ~0.005 oz/yd3 viability; hand-mined upper Bonanza ~8–12 g/yd3; sluice loading ≤8 yd3/h per ft of width.
- R1-us-federal.md (this session): U.S. Notice-level bulk sample cap <1,000 tons; casual use limited to hand tools.
