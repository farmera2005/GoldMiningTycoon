#!/usr/bin/env python3
"""
Gold Mining Tycoon -- PREFLIGHT ECONOMIC MODEL (scratch, not shipped).

Purpose: check, before any game code exists, whether the constants in DESIGN.md sections 1-13
(as edited by the integration fixes of 2026-10-04) put the economy inside BALANCE.md's bands.
Section 14 (hard rock, P6 optional) is not modeled (BALANCE.md 9.1 lists what is missing).

Standard library only (no numpy).  Deterministic: fixed seeds.  Every constant cites the
owning DESIGN section and its tuning key, e.g.  # §7 ops.campUsdPerPersonDay.

It is a SANITY CHECK, not the simulator.  Simplifications are listed in print_simplifications().

Run:  python3 preflight_model.py            (full run, a few minutes)
      python3 preflight_model.py --fast     (smaller samples for debugging)
"""
import math
import zlib
import random
import sys
import time
from collections import Counter, defaultdict

FAST = '--fast' in sys.argv
SEED = 20261004
T0 = time.time()

# =====================================================================================
# 0. SHARED CONSTANTS (cited)
# =====================================================================================
SPOT = 4200.0                 # §10 market.openingSpotUsdPerFineOz (P1 flat price)
DIESEL_RACK = 3.60            # §10 market.openingDieselRackUsdPerGal
BCY_PER_ACRE_FT = 1613        # §3 block model: 1 ft over a 1-acre block
BLOCK_FT = 209                # §3 block edge
PAYABLE_REF = 0.95            # §3 3.7 refEconomics payable (geology.refEcon.*)
FROZEN_WASH_ADD = 0.40        # §3 geology.refEcon.frozenWashAdd (× permafrost on the yardstick's wash cost; EC-03)
START_YEAR = 2027             # §1 game.startCalendarYear

# §3.3.3 geology.access.<class>.{fuelAdder, partsLead, mobMult, refMi}; distExponent 0.5, clamp [0.6, 1.8]
ACCESS = {
    'highway':      dict(fuelAdder=0.35, mobMult=1.0, refMi=40),
    'seasonalRoad': dict(fuelAdder=0.90, mobMult=1.4, refMi=80),
    'winterTrail':  dict(fuelAdder=1.75, mobMult=2.2, refMi=120),
    'flyIn':        dict(fuelAdder=5.50, mobMult=4.0, refMi=150),
}


def clamp(x, lo, hi):
    return lo if x < lo else hi if x > hi else x


def access_factors(access, dist_mi):
    a = ACCESS[access]
    s = clamp((dist_mi / a['refMi']) ** 0.5, 0.6, 1.8)       # §3 accessFactors
    return a['fuelAdder'] * s, a['mobMult'] * s


def logistic(x):
    return 1.0 / (1.0 + math.exp(-x))


def logit(p):
    return math.log(p / (1 - p))


def pct(xs, q):
    if not xs:
        return float('nan')
    s = sorted(xs)
    k = (len(s) - 1) * q
    lo = int(math.floor(k))
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def mean(xs):
    return sum(xs) / len(xs) if xs else float('nan')


def fmt_k(x):
    return f"{x/1000:,.0f}k"


def table(headers, rows, title=None):
    if title:
        print(f"\n{title}")
    w = [len(str(h)) for h in headers]
    srows = []
    for r in rows:
        sr = [str(c) for c in r]
        srows.append(sr)
        for i, c in enumerate(sr):
            w[i] = max(w[i], len(c))
    line = ' | '.join(str(h).ljust(w[i]) for i, h in enumerate(headers))
    print(line)
    print('-+-'.join('-' * w[i] for i in range(len(headers))))
    for sr in srows:
        print(' | '.join(sr[i].ljust(w[i]) for i in range(len(sr))))


class R(random.Random):
    """RNG helpers (stand-in for §2 named streams)."""

    def ln(self, med, sig):
        return med * math.exp(sig * self.gauss(0, 1))

    def lnmean(self, cv):      # mean-one lognormal with coefficient of variation cv
        s2 = math.log(1 + cv * cv)
        return math.exp(math.sqrt(s2) * self.gauss(0, 1) - s2 / 2)

    def pick(self, w):
        t = sum(w.values())
        x = self.random() * t
        for k, v in w.items():
            x -= v
            if x <= 0:
                return k
        return k


# =====================================================================================
# 1. GEOLOGY (§3) -- simplified generator faithful to 3.2-3.7
# =====================================================================================
# §3.2 region templates (P1).  sig tuple order = district, creek, rich AR, claim, block.
TEMPLATES = {
    'north': dict(
        gMed=0.0095, sig=(0.25, 0.38, 0.28, 0.20, 0.50),              # §3.2 gMed, σ log
        richRangeFt=3000, blockRangeAlongFt=700, blockRangeAcrossFt=120,
        halfWidthMedFt=110, sigHalfWidth=0.40, wanderSdFt=140, bgRatio=0.10,
        obMedFt=15, sigOb=(0.15, 0.25, 0.25, 0.15, 0.15),            # district/creek/AR/claim/block
        payMedFt=5, sigPay=(0.15, 0.15, 0.15),                         # creek/AR/block
        bedrock={'schist': .65, 'slate': .15, 'granite': .15, 'basalt': .05},
        roadMix={'highway': 0.40, 'seasonalRoad': 0.60}, townMi=(20, 80),
        valleyMix={'deepMuck': 0.125},                                 # 0.10 of parcels, renormalized over valley
        dredgedShare=0.10,
        permafrostP={'creek': .75, 'bench': .35, 'deepMuck': .95, 'dredged': 0.0},
        clayMed=0.15, boulderMed=0.20, cementMed={'bench': 0.15},
        fineness=(0.86, 0.02, 0.025, 0.80, 0.92),
        mix={'proximal': (45, 35, 15, 5), 'midReach': (25, 40, 27, 8), 'bench': (15, 40, 35, 10)},
        coarseMg={'proximal': 250, 'midReach': 150, 'bench': 100},
        lambdaG={'creek': 2.0, 'bench': 4.0, 'dredged': 6.0, 'deepMuck': 2.0},
        pocketP=0.015,
        oldTimer={'creek': {'none': .25, 'handCut': .15, 'drift': .30, 'recentCat': .30},
                  'bench': {'none': .6, 'handCut': .2, 'recentCat': .2},
                  'deepMuck': {'none': .5, 'drift': .35, 'recentCat': .15},
                  'dredged': {'dredge': 1.0}},
        stakedFraction=0.82, parcels=(60, 80),
        depMult={'creek': (1.0, 1.0, 1.0), 'bench': (0.8, 2.5, 2.0), 'deepMuck': (1.3, 2.8, 1.0),
                 'dredged': (1.0, 1.0, 1.0)},                          # grade, ob, halfWidth (§3.5.3)
        ref=dict(strip=2.50, wash=12.00, devBase=150000, devPerAcre=8000),   # §3 3.7 geology.refEcon.* (north)
        climate='subarctic'),
    'arid': dict(
        gMed=0.0062, sig=(0.25, 0.38, 0.40, 0.25, 0.65),
        richRangeFt=2000, blockRangeAlongFt=500, blockRangeAcrossFt=120,
        halfWidthMedFt=130, sigHalfWidth=0.45, wanderSdFt=180, bgRatio=0.12,
        obMedFt=5, sigOb=(0.20, 0.30, 0.30, 0.25, 0.25),
        payMedFt=4, sigPay=(0.20, 0.20, 0.20),
        bedrock={'granite': .40, 'basalt': .25, 'clayFalse': .35},
        roadMix={'highway': 0.45, 'seasonalRoad': 0.55}, townMi=(8, 40),
        valleyMix={},
        dredgedShare=0.10,
        permafrostP={},
        clayMed=0.25, boulderMed=0.15, cementMed={'*': 0.30, 'bench': 0.45},
        fineness=(0.78, 0.04, 0.035, 0.70, 0.88),
        mix={'fan': (10, 30, 40, 20), 'gulch': (30, 35, 25, 10), 'bench': (10, 35, 35, 20)},
        coarseMg={'gulch': 300, 'fan': 120, 'bench': 100},
        lambdaG={'gulch': 2.0, 'fan': 3.0, 'bench': 4.0, 'dredged': 6.0},
        pocketP=0.020,
        oldTimer={'fan': {'none': .45, 'dryWash': .35, 'recentCat': .20},
                  'gulch': {'none': .45, 'dryWash': .35, 'recentCat': .20},
                  'bench': {'none': .7, 'dryWash': .1, 'recentCat': .2},
                  'dredged': {'dredge': 1.0}},
        stakedFraction=0.70, parcels=(60, 80),
        depMult={'fan': (1.0, 1.0, 1.0), 'gulch': (1.0, 1.0, 1.0), 'bench': (0.8, 2.5, 2.0),
                 'dredged': (1.0, 1.0, 1.0)},
        ref=dict(strip=2.20, wash=14.00, devBase=120000, devPerAcre=7000),   # §3 3.7 geology.refEcon.* (arid)
        climate='arid'),
}
BEDROCK = {'schist': (1.5, 0.20), 'slate': (2.5, 0.30), 'granite': (1.0, 0.10),
           'basalt': (0.7, 0.08), 'clayFalse': (0.3, 0.12)}            # §3.5.3 BEDROCK table B0, s0
CLAIM_SIZE_MIX = {20: .55, 40: .20, 80: .15, 160: .10}                  # §3.1
SLUICE_CAP = (0.95, 0.88, 0.62, 0.25)                                   # §7 ops.baseCapture sluice (also §3 refEconomics)
LAMBDA_B = 0.6                                                          # §3 geology.vertical.bedrockDecayFt


def ar1(rng, n, range_ft, sig):
    rho = math.exp(-BLOCK_FT / range_ft)
    s = math.sqrt(1 - rho * rho)
    z = rng.gauss(0, 1)
    out = []
    for i in range(n):
        if i:
            z = rho * z + s * rng.gauss(0, 1)
        out.append(z * sig)
    return out


def overlap(d, h):
    lo = max(d - BLOCK_FT / 2, -h)
    hi = min(d + BLOCK_FT / 2, h)
    return max(0.0, hi - lo) / BLOCK_FT


def G_profile(h, T, B, sb, lg):
    """§3.5.4 cumulative share of column gold below height h (ft above bedrock)."""
    if h >= 0:
        return sb + (1 - sb) * (1 - math.exp(-min(h, T) / lg)) / (1 - math.exp(-T / lg))
    return sb - sb * (1 - math.exp(-min(B, -h) / LAMBDA_B)) / (1 - math.exp(-B / LAMBDA_B))


def normalize(v):
    s = sum(v)
    return tuple(x / s for x in v)


def deplete(blk, x, w):
    """§3.6 deplete(): remove share x of virgin gold, water-filling by size weights w."""
    mix = list(blk['mix'])
    rem = [0.0] * 4
    active = [i for i in range(4)]
    target = x
    for _ in range(6):
        denom = sum(w[i] * mix[i] for i in active)
        if denom <= 0:
            break
        c = (target - sum(rem[i] for i in range(4) if i not in active)) / denom
        capped = False
        for i in list(active):
            if c * w[i] * mix[i] > 0.95 * mix[i]:
                rem[i] = 0.95 * mix[i]
                active.remove(i)
                capped = True
        if not capped:
            for i in active:
                rem[i] = c * w[i] * mix[i]
            break
    new = [max(1e-6, mix[i] - rem[i]) for i in range(4)]
    blk['mix'] = normalize(new)
    blk['g'] = blk['gv'] * (1 - x)
    blk['mof'] = x


def gen_district(tname, rng):
    tpl = TEMPLATES[tname]
    sd, sc, sr, scl, sbk = tpl['sig']
    D = dict(gf=rng.ln(1, sd), obf=rng.ln(1, tpl['sigOb'][0]),
             fin=clamp(rng.gauss(tpl['fineness'][0], tpl['fineness'][1]), tpl['fineness'][3], tpl['fineness'][4]))
    road = rng.pick(tpl['roadMix'])
    townMi = rng.uniform(*tpl['townMi'])
    nTarget = rng.randint(*tpl['parcels'])
    # ---- creek network (§3.3.1)
    creeks = []
    mainLen = rng.uniform(6, 9)
    creeks.append(dict(order=1, lenMi=mainLen, hw=rng.uniform(500, 900), parent=None, jrow=0, baseMi=0.0))
    nTrib = rng.randint(3, 6)
    for t in range(nTrib):
        at = rng.uniform(0.10, 0.90) * mainLen
        L = rng.uniform(1.5, 4)
        creeks.append(dict(order=2, lenMi=L, hw=rng.uniform(250, 500), parent=0, jrow=int(at * 5280 / BLOCK_FT), baseMi=at))
        if rng.random() < 0.4:
            at2 = rng.uniform(0.3, 0.8) * L
            creeks.append(dict(order=3, lenMi=rng.uniform(0.75, 2), hw=rng.uniform(150, 300), parent=len(creeks) - 1,
                               jrow=int(at2 * 5280 / BLOCK_FT), baseMi=at + at2))
    for c in creeks:
        c['rows'] = int(math.ceil(c['lenMi'] * 5280 / BLOCK_FT))
        c['gold'] = rng.random() >= 0.20                                 # §3 geology.world.barrenCreekP 0.20
        c['gf'] = rng.ln(1, sc) if c['gold'] else 0.15                   # barrenCreekFactor 0.15
        c['obf'] = rng.ln(1, tpl['sigOb'][1])
        c['payf'] = rng.ln(1, tpl['sigPay'][0])
        c['noTrail'] = c['order'] >= 2 and rng.random() < 0.15           # noTrailCreekP
        n = c['rows']
        c['rich'] = ar1(rng, n, tpl['richRangeFt'], sr)
        c['center'] = ar1(rng, n, 2000, tpl['wanderSdFt'])
        c['hwLog'] = ar1(rng, n, 1500, tpl['sigHalfWidth'])
        c['obLog'] = ar1(rng, n, 2500, tpl['sigOb'][2])
        c['payLog'] = ar1(rng, n, 1500, tpl['sigPay'][1])
    # junction boost §3.5.2 (geology.world.junctionBoostLog 0.25 over 7 rows)
    for c in creeks:
        if c['parent'] is not None and c['gold']:
            p = creeks[c['parent']]
            k = min(c['jrow'], p['rows'] - 1)
            for r in range(max(0, k - 7), k + 1):
                p['rich'][r] += 0.25
    # dredged stretches: lower 60% of main stem (simplified: only the main stem)
    main = creeks[0]
    dredgedRows = set()
    if tpl['dredgedShare'] > 0:
        targetRows = int(tpl['dredgedShare'] * sum(c['rows'] for c in creeks) * 0.8)
        tries = 0
        while len(dredgedRows) < targetRows and tries < 10:
            tries += 1
            L = int(rng.uniform(1, 3) * 5280 / BLOCK_FT)
            st = rng.randint(0, max(0, int(0.6 * main['rows']) - 1))
            for r in range(st, min(st + L, int(0.6 * main['rows']))):
                dredgedRows.add(r)
    # ---- parcels (§3.4)
    claims = []
    for ci, c in enumerate(creeks):
        if len(claims) >= nTarget:
            break
        row = rng.randint(0, 5)
        while row < c['rows'] - 4 and len(claims) < nTarget:
            acres = rng.pick(CLAIM_SIZE_MIX)
            if acres == 20:
                nA, nX = 5, 4
            elif acres == 40:
                nA, nX = 10, 4
            elif acres == 80:
                nA, nX = (10, 8) if c['hw'] >= 700 else (20, 4)
            else:
                nA, nX = (20, 8) if c['hw'] >= 700 else (40, 4)
            if row + nA > c['rows']:
                break
            if tname == 'north':
                if ci == 0 and row in dredgedRows:
                    dep = 'dredged'
                elif rng.random() < tpl['valleyMix'].get('deepMuck', 0):
                    dep = 'deepMuck'
                else:
                    dep = 'creek'
            else:
                if ci == 0 and row in dredgedRows:
                    dep = 'dredged'
                elif ci == 0 and row < 0.3 * c['rows']:
                    dep = 'fan'
                else:
                    dep = 'gulch'
            claims.append(dict(creek=ci, row=row, nA=nA, nX=nX, acres=acres, dep=dep, axis=0.0))
            row += nA + (rng.randint(1, 5) if rng.random() < 0.2 else 0)
        if c['order'] == 1 or c['hw'] >= 400:
            for side in (-1, 1):
                if rng.random() < 0.6 and len(claims) < nTarget:                # geology.world.benchSideP
                    span = rng.uniform(0.3, 0.7)
                    st = rng.randint(0, max(0, int((1 - span) * c['rows'])))
                    en = st + int(span * c['rows'])
                    row = st
                    while row < en - 10 and len(claims) < nTarget:
                        acres = 20 if rng.random() < .55 / .75 else 40
                        nA = 10 if acres == 20 else 20
                        if row + nA > c['rows']:
                            break
                        claims.append(dict(creek=ci, row=row, nA=nA, nX=2, acres=acres, dep='bench',
                                           axis=side * (c['hw'] + rng.uniform(100, 600)),
                                           northness=rng.uniform(-1, 1)))
                        row += nA
    # ---- claim truth (§3.5.3) and old-timers (§3.6)
    out = []
    for K in claims:
        c = creeks[K['creek']]
        dep = K['dep']
        gm, om, hm = tpl['depMult'][dep]
        bench = dep == 'bench'
        claimGrade = rng.ln(1, scl) * gm
        claimOb = rng.ln(1, tpl['sigOb'][3]) * om
        br = rng.pick(tpl['bedrock'])
        B0, s0 = BEDROCK[br]
        proximal = (K['row'] > 0.7 * c['rows']) or c['order'] == 3
        if tname == 'north':
            setting = 'bench' if bench else ('proximal' if proximal else 'midReach')
        else:
            setting = 'bench' if bench else ('gulch' if dep in ('gulch', 'dredged') else 'fan')
        prior = tpl['mix'][setting]
        mixK = normalize([prior[i] * rng.ln(1, 0.25) for i in range(4)])
        coarseMg = tpl['coarseMg'][setting] * rng.ln(1, 0.3)
        finK = clamp(D['fin'] + rng.gauss(0, tpl['fineness'][2]), tpl['fineness'][3], tpl['fineness'][4])
        lg = tpl['lambdaG'].get(dep, 2.0) * rng.uniform(0.75, 1.25)
        pp = tpl['permafrostP'].get(dep, 0.0)
        if bench:
            pp = clamp(pp * (1 + 0.6 * K.get('northness', 0)), 0, 0.95)
        frozenDeg = rng.uniform(0.6, 1.0) if rng.random() < pp else 0.0
        setMult = {'proximal': 1.5, 'gulch': 1.4, 'fan': 0.6, 'bench': 0.8}.get(setting, 1.0)
        clayK = min(1, rng.ln(tpl['clayMed'], 0.6))
        boulK = min(1, rng.ln(tpl['boulderMed'] * setMult, 0.6))
        cm = tpl['cementMed'].get(dep, tpl['cementMed'].get('*', 0.0))
        cemK = min(1, rng.ln(cm, 0.5)) if cm > 0 else 0.0
        rhoA = math.exp(-BLOCK_FT / tpl['blockRangeAlongFt'])
        rhoC = math.exp(-BLOCK_FT / tpl['blockRangeAcrossFt'])
        blocks = []
        zprev = None
        for i in range(K['nA']):
            u = []
            z = rng.gauss(0, 1)
            for j in range(K['nX']):
                if j:
                    z = rhoC * z + math.sqrt(1 - rhoC ** 2) * rng.gauss(0, 1)
                u.append(z)
            zrow = u if zprev is None else [rhoA * zprev[j] + math.sqrt(1 - rhoA ** 2) * u[j] for j in range(K['nX'])]
            zprev = zrow
            row = min(K['row'] + i, c['rows'] - 1)
            hwStreak = tpl['halfWidthMedFt'] * hm * math.exp(c['hwLog'][row])
            cen = clamp(c['center'][row], -max(0, c['hw'] - hwStreak), max(0, c['hw'] - hwStreak))
            for j in range(K['nX']):
                x = K['axis'] + (j - (K['nX'] - 1) / 2) * BLOCK_FT
                d = x - (K['axis'] if bench else 0) - cen
                f = overlap(d, hwStreak)
                gS = tpl['gMed'] * D['gf'] * c['gf'] * math.exp(c['rich'][row]) * claimGrade * math.exp(sbk * zrow[j])
                g = f * gS + (1 - f) * gS * tpl['bgRatio']
                OB = clamp(tpl['obMedFt'] * D['obf'] * c['obf'] * math.exp(c['obLog'][row]) * claimOb
                           * (1 + 0.3 * math.exp(-((x - K['axis']) / 400) ** 2)) * rng.ln(1, tpl['sigOb'][4]), 0, 120)
                T = clamp(tpl['payMedFt'] * c['payf'] * math.exp(c['payLog'][row]) * (0.7 + 0.3 * f)
                          * rng.ln(1, tpl['sigPay'][2]), 1, 15)
                Bc = B0 * rng.uniform(0.8, 1.2)
                sb = s0 * rng.uniform(0.8, 1.2)
                payBcy = (T + Bc) * BCY_PER_ACRE_FT
                pP = tpl['pocketP'] * (1.5 if setting in ('proximal', 'gulch') else 1.0)
                if f >= 0.4 and rng.random() < pP:
                    pb = min(rng.uniform(300, 3000), 0.5 * payBcy)
                    pg = clamp(gS * rng.ln(15, 0.5), 0.15, 2.0)
                    g = (g * (payBcy - pb) + pg * pb) / payBcy
                mix = list(mixK)
                mix[0] *= (0.5 + 0.5 * f)
                mix = normalize([m * rng.ln(1, 0.10) for m in mix])
                perm = clamp(frozenDeg + rng.gauss(0, 0.08), 0, 1) if frozenDeg > 0 else (
                    0.15 * rng.random() if tpl['climate'] == 'subarctic' else 0.0)
                clay = clamp(clayK + rng.gauss(0, 0.05), 0, 1)
                if br == 'clayFalse':
                    clay = max(clay, 0.4)
                blocks.append(dict(i=i, j=j, f=f, gS=gS, g=g, gv=g, ob=OB, T=T, B=Bc, sb=sb, lg=lg, mix=tuple(mix),
                                   fin=clamp(finK + rng.gauss(0, 0.006), tpl['fineness'][3], tpl['fineness'][4]),
                                   perm=perm, clay=clay, bould=clamp(boulK + rng.gauss(0, 0.05), 0, 1),
                                   cem=clamp(cemK + rng.gauss(0, 0.05), 0, 1) if cemK > 0 else 0.0,
                                   mined=False, mof=0.0))
        # old-timers (§3.6)
        otk = rng.pick(tpl['oldTimer'][dep])
        PS = sorted([b for b in blocks if b['f'] >= 0.4], key=lambda b: -b['gv'])
        if otk == 'drift':
            n = int(round(rng.uniform(0.4, 0.8) * len(PS)))
            for b in PS[:n]:
                if rng.random() < 0.8:
                    bottom = G_profile(5, b['T'], b['B'], b['sb'], b['lg']) - G_profile(-1, b['T'], b['B'], b['sb'], b['lg'])
                    deplete(b, min(0.92, bottom * rng.uniform(0.6, 0.9)), (1.3, 1.1, 0.7, 0.3))
        elif otk == 'handCut':
            n = int(round(0.3 * len(PS)))
            for b in [b for b in PS if b['ob'] < 10][:n]:
                deplete(b, rng.uniform(0.5, 0.8), (1.3, 1.1, 0.7, 0.3))
        elif otk == 'dredge':
            for b in blocks:
                if b['f'] > 0.05:
                    deplete(b, rng.uniform(0.80, 0.92), (1.1, 1.05, 0.9, 0.6))
                b['ob'] = 0.0
                b['perm'] = 0.0
                b['bould'] *= 0.3
        elif otk == 'dryWash':
            n = int(round(0.5 * len(PS)))
            for b in PS[:n]:
                deplete(b, rng.uniform(0.10, 0.30), (1.3, 1.1, 0.7, 0.3))
        lastSeason, nSeasons, permit = None, 0, 'none'
        if otk == 'recentCat':
            cand = [b for b in PS if b['mof'] == 0]
            n = int(round(rng.uniform(0.15, 0.50) * len(cand)))
            for b in cand[:n]:
                b['mined'] = True
            # §3 3.6 true history: blocks grouped 1-3 per season from a start year U{1985..2018}, "occasional gaps"
            # (this model: a one-year gap w.p. 0.2 between seasons; §3 does not pin the gap rate)
            if n > 0:
                yr = rng.randint(1985, 2018)
                left = n
                while True:
                    left -= rng.randint(1, 3)
                    nSeasons += 1
                    if left <= 0:
                        break
                    yr += 1 + (1 if rng.random() < 0.2 else 0)
                lastSeason = yr
                # §3 3.6: last season >= startYear - 6 -> w.p. geology.oldTimer.preStripP (0.25) 1-3 further PS blocks pre-stripped,
                # thawProgress U(3, 6) ft (geology.oldTimer.preStripMaxAgeYr 6)
                if lastSeason >= START_YEAR - 6 and rng.random() < 0.25:
                    rest = [b for b in PS if b['mof'] == 0 and not b['mined']]
                    for b in rest[:rng.randint(1, 3)]:
                        b['preStripped'] = True
                        b['thaw0'] = rng.uniform(3.0, 6.0)
                # §3 3.9 truth permitStub: last season >= geology.permitStub.minLastSeasonYear (2010):
                # plan geology.permitStub.planP 0.50 / notice noticeP 0.20 / none 0.30 (one draw)
                if lastSeason >= PERMIT_STUB['minLastSeasonYear']:
                    u = rng.random()
                    permit = ('plan' if u < PERMIT_STUB['planP'] else
                              ('notice' if u < PERMIT_STUB['planP'] + PERMIT_STUB['noticeP'] else 'none'))
        # status by selection (§3.4 assignStatus)
        if PS:
            zq = math.log(mean([b['gS'] for b in PS]) / tpl['gMed']) / 0.5
        else:
            zq = -3.0
        bslope = 0.3 if dep in ('bench', 'deepMuck') else 1.2
        pHeld = logistic(logit(tpl['stakedFraction']) + bslope * zq)
        held = rng.random() < pHeld
        # access (§3.3.3)
        chanMi = c['baseMi'] + K['row'] * BLOCK_FT / 5280
        trailMi = chanMi * 1.2
        a = road
        order = ['highway', 'seasonalRoad', 'winterTrail', 'flyIn']
        if trailMi > 6:
            a = order[min(order.index(a) + 1, 3)]
        if trailMi > 18:
            a = order[min(order.index(a) + 1, 3)]
        if c['noTrail']:
            a = 'flyIn'
        if tname == 'arid' and order.index(a) > 1:
            a = 'seasonalRoad'
        # water (§3.3.4)
        if tname == 'north':
            upMi = max(0.5, c['lenMi'] - K['row'] * BLOCK_FT / 5280) + (sum(cc['lenMi'] for cc in creeks[1:]) * 0.5 if K['creek'] == 0 else 0)
            water = dict(base=0.8 * 150 * upMi * rng.ln(1, 0.35), well=0.0, depth=0.0)
        else:
            sp = rng.random() < 0.20
            water = dict(base=0.8 * rng.ln(40, 0.5) if sp else 0.0, well=clamp(rng.ln(120, 0.8), 5, 1500),
                         depth=clamp(rng.ln(180, 0.5), 30, 800))
        out.append(dict(tpl=tname, dep=dep, setting=setting, acres=K['acres'], blocks=blocks, held=held,
                        oldTimer=otk, access=a, distMi=townMi + trailMi, water=water, coarseMg=coarseMg,
                        lastSeason=lastSeason, nSeasons=nSeasons, permit=permit))
    return out


def ref_block(b, tpl):
    """§3 3.7 refEconomics per block: (revenue, cost). Remaining overburden only (a pre-stripped block has none);
    wash cost carries geology.refEcon.frozenWashAdd (0.40) × permafrost (EC-03)."""
    ref = tpl['ref']
    R = sum(b['mix'][k] * SLUICE_CAP[k] for k in range(4)) * (1 - 0.15 * b['clay'])
    af = b.get('areaFrac', 1.0)                                              # remaining share of a partly mined block
    payBcy = (b['T'] + b['B']) * BCY_PER_ACRE_FT * af
    rev = payBcy * b['g'] * R * b['fin'] * SPOT * PAYABLE_REF
    ob = 0.0 if b.get('preStripped') else b['ob'] * af
    cost = (ob * BCY_PER_ACRE_FT * ref['strip'] * (1 + 0.6 * b['perm'] + 0.5 * b['cem'])
            + payBcy * ref['wash'] * (1 + 0.3 * b['bould'] + 0.3 * b['clay'] + FROZEN_WASH_ADD * b['perm']))
    return rev, cost


def ref_economics(claim):
    """§3 3.7 refEconomics: truth-based yardstick (sluice-only, $4,200, payable 0.95)."""
    tpl = TEMPLATES[claim['tpl']]
    ref = tpl['ref']
    net = []
    revs = []
    for b in claim['blocks']:
        if b['mined']:
            continue
        rev, cost = ref_block(b, tpl)
        if rev > cost:
            net.append(rev - cost)
            revs.append(rev)
    M = len(net)
    cdv = sum(net) - ref['devBase'] - ref['devPerAcre'] * M
    margin = sum(net) / sum(revs) if revs else 0.0
    if cdv <= 0:
        cls = 'uneconomic'
    elif cdv >= 3.0e6 and margin >= 0.60:
        cls = 'excellent'
    elif cdv >= 0.75e6 and margin >= 0.40:
        cls = 'good'
    else:
        cls = 'marginal'
    return cls, cdv, margin, M


CLASSES = ['uneconomic', 'marginal', 'good', 'excellent']
INFLOW_MULT = dict(uneconomic=1.1, marginal=1.0, good=0.8, excellent=0.6)      # §3 geology.supply.inflowMult
SALE_QUALITY = dict(uneconomic=0.7, marginal=1.0, good=1.8, excellent=2.5)     # §3 geology.supply.saleQualityMult


def listing_weight(cls, rng_unused=None):
    """Steady-state listed share for a held parcel of this class (§3.11 cycle; §5 expiry and background sale)."""
    wait = 1.0 / (0.025 * 1.08 * INFLOW_MULT[cls])                 # geology.supply.baseListHazard, mean seasonMult
    p = 0.02 * SALE_QUALITY[cls]                                   # land.backgroundSaleBase × saleQualityMult
    # expected life with expiry L ~ 16 × LN(0.4) (land.listingLifeMedianWeeks / Sigma), via quadrature
    lifes, psold = [], []
    for z in (-1.5, -0.5, 0.5, 1.5):
        L = 16 * math.exp(0.4 * z)
        lifes.append((1 - (1 - p) ** L) / p)
        psold.append(1 - (1 - p) ** L)
    life = mean(lifes)
    ps = mean(psold)
    cooldown = (1 - ps) * 20 + ps * 52                             # relistCooldownWk / postSaleCooldownWk
    return life / (wait + life + cooldown)


def claim_stats(claim):
    ps = [b for b in claim['blocks'] if b['f'] >= 0.4 and not b['mined']]
    medPS = sorted(b['g'] for b in ps)[len(ps) // 2] if ps else 0.0
    obT = sum(b['ob'] for b in claim['blocks'] if not b['mined'])
    payT = sum(b['T'] + b['B'] for b in claim['blocks'] if not b['mined'])
    return medPS, (obT / payT if payT else 0)


# =====================================================================================
# 2. EQUIPMENT CATALOG AND PRICES (§9)
# =====================================================================================
# model: (class, family, newBaseUsd, spec, gph, p1MaintUsdPerHr, loads, osLoads, assemblyHrs)
#   spec = rate bcy/hr (ex, dz, ld), payload bcy (adt), rated bcy/hr (plant), fineTreat (recovery), gpm (pump), kW (gen)
# Values: §9.2.2-9.2.4 catalog; maint: §9 fleet.p1MaintUsdPerHr (P1 models).  Non-P1 maint rates marked (x) are
# extrapolated by this model (P3 replaces flat maintenance with the wear model).
CAT = {
    'ex20':  ('excavator', 'excavator', 280e3, 100, 4.0, 24, 1, 0, 0),
    'ex30':  ('excavator', 'excavator', 430e3, 150, 6.0, 33, 1, 1, 0),
    'ex45':  ('excavator', 'excavator', 650e3, 240, 9.0, 48, 1, 1, 0),        # (x) maint
    'dz6':   ('dozer', 'dozer', 520e3, 130, 5.5, 40, 1, 0, 0),
    'dz8':   ('dozer', 'dozer', 1050e3, 250, 10.0, 78, 2, 1, 0),
    'dz9':   ('dozer', 'dozer', 1500e3, 380, 14.0, 110, 2, 2, 0),            # (x)
    'adt30': ('artTruck', 'wheeled', 560e3, 18, 6.0, 38, 1, 0, 0),
    'adt40': ('artTruck', 'wheeled', 700e3, 24, 7.5, 48, 1, 1, 0),           # (x)
    'ld950': ('loader', 'wheeled', 380e3, 110, 4.0, 25, 1, 0, 0),
    'ld966': ('loader', 'wheeled', 500e3, 170, 5.5, 33, 1, 0, 0),
    'ld980': ('loader', 'wheeled', 720e3, 260, 6.5, 45, 1, 1, 0),            # (x)
    'grz40': ('washPlant', 'plant', 38e3, 40, 0.0, 5, 1, 0, 0),
    'tr50':  ('washPlant', 'plant', 120e3, 50, 3.0, 11, 1, 0, 0),
    'tr75':  ('washPlant', 'plant', 180e3, 75, 4.0, 15, 2, 1, 60),
    'tr150': ('washPlant', 'plant', 380e3, 150, 6.0, 28, 3, 1, 90),
    'tr300': ('washPlant', 'plant', 950e3, 300, 0.0, 50, 6, 2, 240),         # (x) electric, 220 kW
    'dw20':  ('washPlant', 'plant', 35e3, 20, 1.5, 6, 1, 0, 0),
    'cenM':  ('recovery', 'plant', 110e3, 35, 0.0, 6, 0.5, 0, 0),
    'cenL':  ('recovery', 'plant', 240e3, 90, 0.0, 10, 1, 0, 0),             # (x)
    'jigL':  ('recovery', 'plant', 75e3, 70, 0.0, 6, 0.6, 0, 0),             # (x)
    'pmp6':  ('pump', 'light', 38e3, 1500, 2.5, 4, 0.3, 0, 0),
    'pmp8':  ('pump', 'light', 62e3, 2500, 4.0, 6, 0.4, 0, 0),               # (x)
    'pmp10': ('pump', 'light', 95e3, 3800, 6.0, 8, 0.5, 0, 0),               # (x)
    'gen100': ('generator', 'light', 50e3, 100, 5.4, 3, 0.4, 0, 0),
    'gen300': ('generator', 'light', 120e3, 300, 15.5, 8, 1.0, 0, 0),        # (x)
    'campT8': ('site', 'light', 40e3, 8, 0, 0, 0.5, 0, 0),
    'campS12': ('site', 'light', 180e3, 12, 0, 0, 2, 0, 0),
    'campM25': ('site', 'light', 450e3, 25, 0, 0, 6, 0, 0),
    'pickup': ('site', 'light', 65e3, 0, 0, 0, 0, 0, 0),
}
PREP = {'grz40': 'grizzly', 'tr50': 'trommel', 'tr75': 'trommel', 'tr150': 'trommel', 'tr300': 'trommel', 'dw20': 'dryWasher'}
PLANT_KW = {'tr300': 220, 'cenM': 22, 'cenL': 45, 'jigL': 11}               # §9.2.3 hp / kW
CAMP_TIER = {'campT8': 0.8, 'campS12': 1.0, 'campM25': 1.25}                # §7 ops.campTierMult (basic/standard/good)
DEP = {'excavator': (0.809, 0.1165, 0.03), 'dozer': (0.820, 0.1024, 0.06), 'wheeled': (0.809, 0.1300, 0.03),
       'plant': (0.72, 0.150, 0.04), 'light': (0.75, 0.140, 0.05)}         # §9.3.2 dep_family A, λ, F
GRADE_AGE = {'N': 0, 'A': 2.5, 'B': 6, 'C': 11, 'D': 21}                     # §9 9.3.3 P1 age by grade A 1-4, B 3-9, C 7-15, D 12-30 yr (midpoints)
GRADE_RATE = {'N': 1.0, 'A': 1.0, 'B': .96, 'C': .91, 'D': .85}              # §9 fleet.p1GradeRateMult (D = inherited, alias)
GRADE_MAINT = {'N': 1.0, 'A': 1.0, 'B': 1.15, 'C': 1.25, 'D': 1.60}          # §9 fleet.p1GradeMaintMult (C 1.35 -> 1.25, EC-11)
GRADE_PRICE = {'A': 1.20, 'B': 1.05, 'C': .90, 'D': .70}                    # §9 fleet.p1GradePriceMult
# §1 1.8.2 inherited fleet: visible resale estimates (P1, grade D, §9 resaleEstimate rounded): total ≈ $152k
INHERITED_RESALE = {'ex30': 35e3, 'dz6': 51e3, 'ld950': 32e3, 'tr50': 10e3, 'pmp6': 6e3, 'gen100': 4e3, 'pickup': 9e3, 'campT8': 5e3}
# P3+ mechanical availability by condition (§9.7.5 calibration: ~95% new, ~90% mid-life, ~75% tired) x routine 0.97 (§7)
P3_AVAIL = {'N': 0.93, 'A': 0.92, 'B': 0.89, 'C': 0.85, 'D': 0.76}


def fmv_used(model, grade):
    """P1 used ask/resale: FMV(at condRef) × p1GradePriceMult (§9.3.2-9.3.3)."""
    cls, fam, new = CAT[model][0], CAT[model][1], CAT[model][2]
    if grade == 'N':
        return new
    A, lam, F = DEP[fam]
    age = GRADE_AGE[grade]
    light = fam in ('plant', 'light')
    hrs = age * 1150 * (0.6 if light else 1.0)                              # fleet.hoursPerYearMedian
    wh = 0.3 if light else 0.5                                              # fleet.hoursWeight
    ageEq = (1 - wh) * age + wh * hrs / 1500
    return new * (A * math.exp(-lam * ageEq) + F) * GRADE_PRICE[grade]


def resale(model, grade):
    """§9 resaleEstimate (P1: FMV at condRef × gradePriceMult); a new unit resells at dep(0) (loses ~16-24%)."""
    if grade == 'N':
        A, lam, F = DEP[CAT[model][1]]
        return CAT[model][2] * (A + F)
    return fmv_used(model, grade)


def transport_cost(models, access, dist_mi, hub_mi=200, town_mi=45):
    """§9.5 transportLegs/perLoad: lowboy 1,200 × mobMult + legs; OS permits; plant assembly."""
    _, mob = access_factors(access, dist_mi)
    loads = 0.0
    frac = 0.0
    os_ = 0
    asm = 0
    for m in models:
        L = CAT[m][6]
        if L >= 1:
            loads += L
        else:
            frac += L
        os_ += CAT[m][7]
        asm += CAT[m][8]
    loads += math.ceil(frac)
    trail = max(0.0, dist_mi - town_mi)
    leg = hub_mi * 5.5 * 1.5 + town_mi * 14                                 # fleet.lowboyUsdPerLoadedMile × deadhead; seasonalRoad 14/mi
    leg += trail * (300 if access in ('winterTrail', 'flyIn') else 14)      # fleet.legUsdPerLoadMile.winterTrail 300
    per = 1200 * mob + leg                                                  # fleet.lowboyLoadFixedUsd
    return loads * per + os_ * 150 + asm * 115                              # fleet.permitOsUsd, fleet.riggingUsdPerHr


# =====================================================================================
# 3. STAFF (§8) AND PAYROLL BURDEN (§11)
# =====================================================================================
WAGE = {'operator': 36.0, 'plantOperator': 38.0, 'laborer': 25.0, 'mechanic': 45.0, 'cook': 28.0}   # §8 roleBase (north)
FOREMAN_SALARY = 125000.0              # §8 foreman salary
REGION_WAGE = {'north': 1.00, 'arid': 0.90}                                 # §8 staff.regionWageMult
REMOTE_PREMIUM = {'highway': 1.00, 'seasonalRoad': 1.05, 'winterTrail': 1.10, 'flyIn': 1.15}   # §8 staff.remotePremium
SEASON_WAGE_RUSH = 1.06                # §8 seasonWage northern rush (hires made in the spring window)
BURDEN_P1 = 1.0 + 0.14 + 0.08          # §11 finance.p1PayrollTaxRate 0.14 + finance.p1WcRate 0.08
BURDEN_P4_EARLY = 1.177                # §11 11.3 worked example (FICA+FUTA+SUTA+WC, falls to ~1.15 late season)
OT_MULT = 1.5                          # §8 staff.otMult
TRAVEL = {'highway': 150, 'seasonalRoad': 300, 'winterTrail': 700, 'flyIn': 1200}               # §8 staff.travelUsd


def skill_prod(s):
    return 0.70 + 0.0065 * s - 0.00001 * s * s                            # §8 skillProductivityMult


def skill_wear(s):
    return 1 + 0.8 * ((50 - s) / 30) ** 1.3 if s < 50 else 1 - 0.003 * (s - 50)   # §8 skillWearMult


def skill_rec(s):
    return 1.5 - s / 110 if s <= 55 else 1.0 - (s - 55) / 180              # §8 skillRecoveryMult


def wage_rate(role, district, access, skill=50):
    askSkill = skill                                                        # §8 askSkill ≈ skill for mid-experience hands
    askMult = 0.75 + 0.005 * askSkill                                       # §8 askMult (no noise)
    return WAGE[role] * REGION_WAGE[district] * askMult * REMOTE_PREMIUM[access] * (SEASON_WAGE_RUSH if district == 'north' else 1.0)


def weekly_gross(rate, hours):
    paid = max(hours, 40.0)                                                 # §8 staff.guaranteedHoursPerWeek 40
    return rate * (min(paid, 40) + OT_MULT * max(0.0, paid - 40))


# =====================================================================================
# 4. OPERATIONS ENGINE (§7) -- weekly, block by block
# =====================================================================================
MU_C = 0.5          # §7 ops.contactMeanFt standard
XB = 1.5            # §7 ops.defaultBedrockTakeFt
WALL = 0.04         # §7 ops.wallDilutionFrac
PAD_FREE = 1500.0   # §7 ops.padFreeBcy
BASE_CAP = {'sluice': (0.95, 0.88, 0.62, 0.25), 'jig': (0.96, 0.92, 0.85, 0.55),
            'centrifuge': (0.96, 0.92, 0.90, 0.70), 'dryWasher': (0.85, 0.65, 0.35, 0.10)}   # §7 ops.baseCapture
OVERFEED_EXP = (0.5, 1.5, 2.6, 2.6)   # §7 ops.overfeedExp
CLAY_CAP_CUT = {'trommel': 0.45, 'grizzly': 0.25, 'dryWasher': 0.60}       # §7 ops.clayCapCut
PREP_WATER = {'trommel': 1.0, 'grizzly': 0.85, 'dryWasher': 0.0}           # §7 ops.prepWaterMult
CLAY_SCRUB = {'trommel': 0.30, 'grizzly': 1.0, 'dryWasher': 1.0}           # §7 ops.clayScrubFactor
THAW_K = {'cool': 1.2, 'mild': 2.0, 'hot': 2.4, 'cold': 0.0}               # §7 ops.thawK (ft²/wk)
P1_MAINT_INHERIT = 1.6                                                      # §9 fleet.p1InheritedMaintMult
GOLDROOM_LOSS = (0.002, 0.005, 0.03, 0.10)                                  # §7 ops.goldRoomLoss (no table)
DIRT_FRAC = 0.04                                                            # §7 ops.goldRoomDirtFrac (no table)


class Machine:
    def __init__(self, model, role, grade='C', skill=50, ripper=None):
        self.model, self.role, self.grade, self.skill = model, role, grade, skill
        c = CAT[model]
        self.cls, self.fam, self.spec, self.gph, self.maint = c[0], c[1], c[3], c[4], c[5]
        self.ripper = ripper if ripper is not None else (model in ('dz8', 'dz9'))
        self.inherited = False

    def rate(self):
        """§9 machineEffectiveRate at REFERENCE_GROUND (P1 grade rate × skill)."""
        s = skill_prod(self.skill) if self.cls in ('excavator', 'dozer', 'artTruck', 'loader') else 1.0
        r = self.spec * GRADE_RATE[self.grade] * s
        return r                        # inherited fleet = grade D (§9: rate .85 = fleet.p1InheritedRateMult)


def extraction(b, s_dig=50):
    """§7.3 pay column: dug bcy per acre, extracted gold share and mining loss λ."""
    T, B = b['T'], b['B']
    sigma = 0.6 * (1 + 0.6 * (50 - s_dig) / 50)                            # ops.contactErrorSdFt, contactSkillSlope
    z = MU_C / sigma
    phi = math.exp(-z * z / 2) / math.sqrt(2 * math.pi)
    Phi = 0.5 * (1 + math.erf(z / math.sqrt(2)))
    dil = MU_C * Phi + sigma * phi
    loss = dil - MU_C
    xb = min(XB, B)
    share = G_profile(T - loss, T, B, b['sb'], b['lg']) - G_profile(-xb, T, B, b['sb'], b['lg'])
    lam = 0.03 * (1 + 0.6 * (50 - s_dig) / 50) + b['bould'] * 0.02        # ops.miningLossBase/SkillSlope/BoulderAdd
    colFt = T + MU_C + XB
    payDug = colFt * BCY_PER_ACRE_FT * (1 + WALL)
    return payDug, share * (1 - lam)


class Site:
    """Per-claim operations state (blocks in mining order)."""

    def __init__(self, blocks, s_dig=50, pre_stripped=0):
        self.blocks = []
        for k, b in enumerate(blocks):
            payDug, ext = extraction(b, s_dig)
            af = b.get('areaFrac', 1.0)                                     # partly mined block (§3 3.6.1 partial family digs)
            truthPay = (b['T'] + b['B']) * BCY_PER_ACRE_FT
            gold = b['g'] * truthPay * ext * af
            payDug *= af
            stripFt = max(0.0, b['ob'] - MU_C) * af
            gfrac = (b['T'] + MU_C) / (b['T'] + MU_C + XB)
            m_th = 1 / (gfrac / 1.0 + (1 - gfrac) / 0.60)                   # §7.4 ops.digMult thawed gravel/bedrock
            m_fr = 1 / (gfrac / DIG_FROZEN + (1 - gfrac) / 0.45)            # frozen (ops.digMult.gravelFrozen)
            m_rip = 1 / (gfrac / 0.80 + (1 - gfrac) / 0.55)                 # ripped
            self.blocks.append(dict(
                obTot=stripFt * BCY_PER_ACRE_FT, obDone=0.0, obTh=0.0, started=False,
                payTot=payDug, payDone=0.0, payTh=0.0, gpb=gold / payDug, gold0=gold,
                mix=b['mix'], fin=b['fin'], p=b['perm'], clay=b['clay'], bould=b['bould'], cem=b.get('cem', 0.0),
                colFt=b['T'] + MU_C + XB, m_th=m_th, m_fr=m_fr, m_rip=m_rip, g=b['g'],
                bf=min(XB, b['B']) / (b['T'] + MU_C + XB),                     # bedrock share of the dug column (consumables)
                pre=bool(b.get('preStripped')), thaw0=b.get('thaw0', 4.5)))
        for k, b in enumerate(self.blocks):
            if b['pre'] or k < pre_stripped:
                # §3 3.6 / 3.6.1 pre-strip state: strippedBcy = overburdenBcy, thawProgress U(3, 6) ft (fixtures: 4.5, the mean)
                b['obDone'] = b['obTot']
                b['started'] = True
                b['payTh'] = min(b['payTot'], b['thaw0'] * BCY_PER_ACRE_FT)
        self.pad = dict(bcy=0.0, gold=0.0, mixg=[0.0] * 4, fine=0.0, clay=0.0, bould=0.0)
        self.box = dict(raw=[0.0] * 4, fine=0.0)
        self.sinceClean = 0
        self.bcySinceClean = 0.0
        self.startupLeft = 120.0         # §7 ops.startupCrewHours (site arrives winterized / new)
        self.plantMoveBcy = 0.0

    def cur(self):
        for k, b in enumerate(self.blocks):
            if b['payDone'] < b['payTot'] - 5.0:
                return k
        return len(self.blocks)

    def exposed(self, b):
        if b['obTot'] <= 0:
            return b['payTot']
        sf = b['obDone'] / b['obTot']
        return b['payTot'] * clamp((sf - 0.5) / 0.5, 0, 1)                 # §7 ops.payExposureRampStart 0.5

    def remaining_pay(self):
        return sum(b['payTot'] - b['payDone'] for b in self.blocks)

    def overwinter(self):
        for b in self.blocks:
            b['obTh'] *= 0.8                                                # §7 ops.overwinterThawRetention stripped 0.8
            b['payTh'] *= 0.8
        self.startupLeft = 120.0


def capture(mix, phi, s_plant, band, prep, circuit_shares, clay, cold_ok=True):
    """§7.9 capture by size: B^M with feed, skill, cold, prep exponents; clay loss; coarse oversize."""
    out = []
    for s in range(4):
        if prep == 'dryWasher':
            B = BASE_CAP['dryWasher'][s]
        else:
            B = sum(sh * BASE_CAP[dev][s] for dev, sh in circuit_shares)
        if phi >= 1:
            Mf = phi ** OVERFEED_EXP[s]
        else:
            Mf = max(phi, 0.6) ** (OVERFEED_EXP[s] * 0.3)                   # ops.underfeedPhiFloor / BenefitFactor
        Ms = skill_rec(s_plant)
        Mc = 1.0
        if s >= 2:
            Mc = {'cool': 1.05, 'cold': 1.12}.get(band, 1.0)                 # ops.coldWaterExp
            if prep == 'grizzly':
                Mc *= 1.25                                                  # ops.prepFineLossExp grizzly
        cap = B ** (Mf * Ms * Mc)
        cap *= (1 - clay * 0.20 * CLAY_SCRUB.get(prep, 1.0))                # ops.clayLossMax × clayScrubFactor
        if s == 0:
            cap *= (1 - 0.01)                                               # ops.oversizeCoarseLoss
        out.append(cap)
    return out


class Op:
    """An operation: fleet + crew + plan (§7 MinePlan essentials) + site economics context."""

    def __init__(self, name, district, machines, days=6, shifts=1, hours=11, feed_phi=1.0, cleanup_every=2,
                 foreman_skill=40, hired_foreman=False, plant_skill=55, laborers=1, cook=False, mechanic=False,
                 access='seasonalRoad', dist_mi=60, haul_blocks=4, water_gpm=600.0, well_gpm=0.0, water_trucks=0,
                 strip_ahead=1, rip_assist=False, direct_feed=False, phase=1, arid_idle_summer=False):
        self.name, self.district, self.machines = name, district, machines
        self.days, self.shifts, self.hours = days, shifts, hours
        self.feed_phi, self.cleanup_every = feed_phi, cleanup_every
        self.foreman_skill, self.hired_foreman, self.plant_skill = foreman_skill, hired_foreman, plant_skill
        self.laborers, self.cook, self.mechanic = laborers, cook, mechanic
        self.access, self.dist_mi, self.haul_blocks = access, dist_mi, haul_blocks
        self.water_gpm, self.well_gpm, self.water_trucks = water_gpm, well_gpm, water_trucks
        self.strip_ahead, self.rip_assist, self.direct_feed = strip_ahead, rip_assist, direct_feed
        self.phase = phase
        self.arid_idle_summer = arid_idle_summer
        self.owner_shop_mult = 1.0      # §1 1.7 Mechanic background: fleet.p1OwnerShopMaintMult (0.70) with the owner in the shop
        self.plant = next((m for m in machines if m.cls == 'washPlant'), None)
        self.conc = [m for m in machines if m.cls == 'recovery']
        self.camp = next((m for m in machines if m.model.startswith('camp')), None)

    def by_role(self, role):
        return [m for m in self.machines if m.role == role]

    def operated(self):
        return [m for m in self.machines if m.cls in ('excavator', 'dozer', 'artTruck', 'loader') and m.role != 'idle']

    def crew(self):
        """Field crew per shift: operators for operated machines + plant op + laborers (+ cook, mechanic)."""
        ops = len(self.operated())
        n = ops + (1 if self.plant else 0) + self.laborers
        return n * self.shifts + (1 if self.cook else 0) + (1 if self.mechanic else 0)

    def fleet_value(self, resale_fn=resale):
        return sum(INHERITED_RESALE[m.model] if m.inherited else resale_fn(m.model, m.grade) for m in self.machines)

    def fuel_price(self, diesel=DIESEL_RACK):
        add, _ = access_factors(self.access, self.dist_mi)
        return diesel + add

    def weekly_wages(self, burden, hours=None):
        """§8 weekly gross for the crew on site at the plan's hours (overtime > 40 h), × §11 burden."""
        H = self.days * self.hours if hours is None else hours
        tot = 0.0
        d, a = self.district, self.access
        for m in self.operated():
            tot += weekly_gross(wage_rate('operator', d, a, m.skill), H) * self.shifts
        if self.plant:
            tot += weekly_gross(wage_rate('plantOperator', d, a, self.plant_skill), H) * self.shifts
        tot += weekly_gross(wage_rate('laborer', d, a), H) * self.laborers * self.shifts
        if self.cook:
            tot += weekly_gross(wage_rate('cook', d, a), 70)
        if self.mechanic:
            tot += weekly_gross(wage_rate('mechanic', d, a), H)
        tot *= burden
        if self.hired_foreman:
            tot += FOREMAN_SALARY / 52 * burden
        return tot


def push_factor(k):
    # §7 ops.dozerRefPushFt/dozerPushExp: 150/200^0.9 = 0.772 while dumping (first blocks), ~backfill later
    return (150 / 200) ** 0.9 if k < 2 else (150 / 160) ** 0.9


def ops_week(site, op, ctx, rng):
    """One week of §7's flow, aggregated (stages capped weekly instead of hour-by-hour)."""
    o = defaultdict(float)
    phase, band = ctx['phase'], ctx['band']
    H = op.days * op.shifts * op.hours
    F = 0.85 + 0.15 * op.foreman_skill / 100                               # §7 ops.foremanEffMin/Max
    Wx = ctx.get('W', 1.0)
    sdZ = 0.6 if phase == 'breakup' else 1.0                               # §7 ops.breakupWorkMult
    K = THAW_K.get(band, 0.0)

    def avail(m):
        return 0.92 if op.phase < 3 else P3_AVAIL[m.grade]               # §7 ops.p1MechAvailability / P3 (§9)

    # ---- start-up (§7 ops.startupCrewHours)
    crewH = op.crew() * op.days * op.hours
    startFrac = 0.0
    if site.startupLeft > 0:
        startFrac = min(1.0, site.startupLeft / max(1.0, crewH))
        site.startupLeft = max(0.0, site.startupLeft - crewH)
    cur = site.cur()
    blocks = site.blocks
    # ---- thaw (§7.4)
    q_end = min(len(blocks), cur + 2 + op.strip_ahead)
    for k in range(cur, q_end):
        b = blocks[k]
        rem = b['obTot'] - b['obDone']
        if b['started'] and rem > 0 and b['p'] > 0:
            d = b['obTh'] / BCY_PER_ACRE_FT
            new = min(math.sqrt(d * d + K * 0.7), rem / BCY_PER_ACRE_FT)   # ops.thawMuckMult 0.7
            b['obTh'] = new * BCY_PER_ACRE_FT
        av = site.exposed(b) - b['payDone']
        if av > 1 and b['p'] > 0:
            a = av / b['payTot']
            d = b['payTh'] / (a * BCY_PER_ACRE_FT)
            new = min(math.sqrt(d * d + K), b['colFt'])
            b['payTh'] = min(av, new * a * BCY_PER_ACRE_FT)
    # ---- strip (§7.6.1), thawed pool first to worst-frozen machines
    strippers = sorted(op.by_role('strip'), key=lambda m: (0.30 if m.ripper else 0.08) if m.cls == 'dozer' else 0.35)
    stripped = frozen_stripped = 0.0
    for m in strippers:
        hrs0 = hrs = H * avail(m) * F * Wx * sdZ
        fm = (0.30 if m.ripper else 0.08) if m.cls == 'dozer' else 0.35  # ops.stripFrozenMult
        qb = [k for k in range(cur, q_end) if blocks[k]['obDone'] < blocks[k]['obTot'] - 1e-6]
        for k in qb[:2 + op.strip_ahead]:
            blocks[k]['started'] = True
        # pass 1: thawed pool of every queue block (skimming keeps the thaw at its fast early rate)
        for k in qb:
            b = blocks[k]
            r_t = m.rate() * (push_factor(k) if m.cls == 'dozer' else 0.75)   # ops.excavatorStripCastMult
            pool = (b['obTot'] - b['obDone']) if b['p'] <= 0 else b['obTh']
            take = min(pool, hrs * r_t)
            b['obDone'] += take
            if b['p'] > 0:
                b['obTh'] -= take
            hrs -= take / r_t
            stripped += take
            if hrs <= 1e-6:
                break
        # pass 2: frozen mix below the thaw line, current block first
        for k in qb:
            if hrs <= 1e-6:
                break
            b = blocks[k]
            if b['p'] <= 0:
                continue
            r_t = m.rate() * (push_factor(k) if m.cls == 'dozer' else 0.75)
            below = b['obTot'] - b['obDone'] - b['obTh']
            rb = r_t / ((1 - b['p']) + b['p'] / fm)
            take = min(below, hrs * rb)
            b['obDone'] += take
            hrs -= take / rb
            stripped += take
            frozen_stripped += take * b['p']
        o['work_' + m.model + '_strip'] += hrs0 - hrs
        o['avail_' + m.model + '_strip'] += hrs0
    o['stripped'] = stripped
    o['frozenStripped'] = frozen_stripped
    # ---- dig potential (§7.6.2 with §7.4 frozen multipliers)
    diggers = [m for m in op.by_role('dig') if m.cls == 'excavator']
    rippers = [m for m in op.by_role('dig') if m.cls == 'dozer' and m.ripper]
    ripcap = sum(m.rate() * 0.30 * H * avail(m) * F * Wx * sdZ for m in rippers)
    items = []          # (blockIdx, bcy, ratePerHourOfOneDigger)
    dig_hrs = sum(H * avail(m) * F * Wx * sdZ for m in diggers)
    r_ex = mean([m.rate() for m in diggers]) if diggers else 0.0
    hrs = dig_hrs
    for k in range(cur, min(len(blocks), cur + 3)):
        if hrs <= 1e-6 or r_ex <= 0:
            break
        b = blocks[k]
        av = site.exposed(b) - b['payDone']
        if av <= 1:
            continue
        rd = r_ex * (1 - b['bould'] * 0.25)                                # ops.boulderDigPenalty
        if b['p'] > 0:
            th = min(b['payTh'], av)
            rt = rd * b['m_th']
            take = min(th, hrs * rt)
            if take > 0:
                items.append((k, take, rt, True))
                hrs -= take / rt
            below = av - th
            if below > 0 and hrs > 0:
                if ripcap > 0:
                    mm = 1 / ((1 - b['p']) / b['m_th'] + b['p'] / b['m_rip'])
                else:
                    mm = 1 / ((1 - b['p']) / b['m_th'] + b['p'] / b['m_fr'])
                rb = rd * mm
                take = min(below, hrs * rb)
                if ripcap > 0:
                    take = min(take, ripcap / max(b['p'], 1e-6))
                    ripcap -= take * b['p']
                if take > 0:
                    items.append((k, take, rb, False))
                    hrs -= take / rb
        else:
            rt = rd * b['m_th']
            take = min(av, hrs * rt)
            items.append((k, take, rt, True))
            hrs -= take / rt
    DC = sum(it[1] for it in items)
    inst = DC / (dig_hrs - hrs) if dig_hrs - hrs > 0 else r_ex * 0.85       # mean instantaneous dig rate while digging
    inst_one = inst                                                         # rate of one digger
    # ---- haul (§7.6.3)
    trucks = [m for m in op.by_role('haul') if m.cls == 'artTruck']
    carriers = [m for m in op.by_role('haul') if m.cls == 'loader']
    haulFt = 300 + 209 * op.haul_blocks                                     # ops.haulBaseFt + blockSpacingFt
    haulcap = 0.0
    truck_rate = 0.0
    for m in trucks:
        P = m.rate()
        loadMin = P / max(inst_one, 1) * 60
        cyc = loadMin + haulFt / 704 + 1.2 + haulFt / 1056 + 0.8             # ops.truck*FtPerMin, dump, spot
        r = P * 60 / cyc * 0.83                                             # ops.haulJobEff
        truck_rate += r
        haulcap += r * H * avail(m) * F * Wx * sdZ
    for m in carriers:
        r = m.rate() * min(1, 300 / haulFt)                                 # ops.loaderCarryRefFt
        truck_rate += r
        haulcap += r * H * avail(m) * F * Wx * sdZ
    feeders = op.by_role('feed')
    if op.direct_feed and not trucks and not carriers:
        mode = 'excavatorDirect'
    elif trucks or carriers:
        mode = 'padLoader' if feeders else 'truckDirect'
    else:
        mode = 'none'
    # ---- plant (§7.6.5), water (§7.6.6), power (§7.6.7)
    plant_on = phase in ('operating', 'freezeup') and op.plant is not None and not ctx.get('plantOff', False)
    if op.plant is not None and op.plant.spec <= 0:
        plant_on = False
    pl = op.plant
    if pl is not None:
        prep = PREP[pl.model]
        cb = blocks[min(cur, len(blocks) - 1)] if blocks else None
        clay = cb['clay'] if cb else 0.15
        bould = cb['bould'] if cb else 0.2
        Reff = pl.spec * GRADE_RATE[pl.grade] * (1 - clay * CLAY_CAP_CUT[prep]) * (1 - bould * 0.25)
        if phase == 'freezeup':
            Reff *= 0.6                                                      # ops.freezeupPlantMult (P1)
        run = op.feed_phi * Reff
        run = min(run, 1.5 * Reff)                                          # ops.plantMaxOverfeed
        if prep != 'dryWasher':
            q = 15 * (1 + clay * 1.0) * PREP_WATER[prep] * 1.4 * (1.1 if op.conc else 1.0)   # closed loop, ops.recycleExtraFlow
            mk = 0.12 if op.district == 'north' else ARID_MAKEUP             # §7 ops.makeupFrac north 0.12, arid 0.15 (D-7.37)
            pumpu = sum(m.spec for m in op.by_role('water')) * 0.92 * F * Wx
            # §7 7.6.6 Q_truck: 4,000 gal, 0.5 h fill, 25 mph, fill point 8 mi (§7 worked example) = 58.5 gpm per truck
            src = op.water_gpm * ctx.get('sff', 1.0) + op.well_gpm + op.water_trucks * 58.5
            Qc = min(pumpu, src / mk)
            Ww = Qc / q if q > 0 else 1e9
            o['waterLimitBcyHr'] = Ww
            run = min(run, Ww)
        else:
            if ctx.get('precip') in ('wet', 'storm'):
                plant_on = False                                             # dry washer needs ≤ 3 % moisture
        if op.plant.model == 'tr300' or op.conc:
            kw_need = PLANT_KW.get(pl.model, 0) + sum(PLANT_KW.get(c.model, 0) for c in op.conc)
            kw_have = sum(m.spec for m in op.by_role('power')) * 0.92 * F
            if kw_have < PLANT_KW.get(pl.model, 0):
                plant_on = False
            conc_on = kw_have >= kw_need
        else:
            conc_on = True
        cleanH = 4 + 0.04 * pl.spec                                         # ops.cleanupHoursBase/PerRated
        bandMult = 0.80 if band == 'cool' else 1.0                           # ops.plantHoursMultByBand
        plant_hrs = H * avail(pl) * F * Wx * bandMult * (1 - startFrac) if plant_on else 0.0
        if mode == 'excavatorDirect':
            run = min(run, 0.60 * inst_one)                                  # ops.directFeedDigMult
        D_plant = run * plant_hrs
    else:
        prep, Reff, run, D_plant, plant_hrs, conc_on, cleanH = 'trommel', 1, 0, 0, 0, False, 0
    # feed capacity incl. tailings handling (§7.6.8: 3 h per 1,000 bcy by the feed loader)
    if mode == 'padLoader':
        fl = feeders[0]
        rl = fl.rate() * (1.0 if fl.cls == 'loader' else 0.85)
        fhrs = H * avail(fl) * F * Wx
        feedcap = rl * fhrs / (1 + 0.003 * rl)
    else:
        feedcap = 1e12
    # ---- flow
    pad = site.pad
    move_frac = 1.0
    if mode == 'excavatorDirect':
        moves = 0.0
        wash_cap = D_plant
        washed = min(wash_cap, DC)
        # plant shifts toward the face every 3,000 bcy for 4 h (ops.directFeedSetupBcy / ShiftHours)
        moves = washed / 3000.0 * 4.0
        if plant_hrs > 0:
            move_frac = max(0.0, (plant_hrs - moves)) / plant_hrs
            washed *= move_frac
        hauled = washed
    elif mode == 'truckDirect':
        washed = min(D_plant, DC, haulcap)
        hauled = washed
    elif mode == 'padLoader':
        D_feed = min(D_plant, feedcap)
        padcap = PAD_FREE
        hauled = min(DC, haulcap, max(0.0, D_feed + padcap - pad['bcy']))
        washed = min(D_feed, pad['bcy'] + hauled)
    else:
        washed = hauled = 0.0
    if not plant_on and mode in ('padLoader',):
        hauled = min(DC, haulcap, max(0.0, PAD_FREE - pad['bcy']))
        washed = 0.0
    # ---- take dug material from items in order
    dug = hauled
    left = dug
    dig_work = 0.0
    get_dug = 0.0
    fsw = ctx.get('subblock', True)
    for (k, bcy, rate, thawed) in items:
        if left <= 0:
            break
        x = min(bcy, left)
        left -= x
        b = blocks[k]
        # §7 7.11 consumables: frozen or bedrock bcy × ops.getFrozenMult (2.0)
        get_dug += x * (1 + b['bf'] + (1 - b['bf']) * (0.0 if thawed else b['p']))
        b['payDone'] += x
        if thawed and b['p'] > 0:
            b['payTh'] = max(0.0, b['payTh'] - x)
        dig_work += x / rate
        f = clamp(math.exp(0.25 * rng.gauss(0, 1) - 0.03125), 0.4, 2.5) if fsw else 1.0   # ops.subBlockGradeSigma
        gold = x * b['gpb'] * f
        pad['bcy'] += x
        pad['gold'] += gold
        for s in range(4):
            pad['mixg'][s] += gold * b['mix'][s]
        pad['fine'] += gold * b['fin']
    # ---- wash and recover (§7.9)
    rec_raw = 0.0
    contained = 0.0
    if washed > 0 and pad['bcy'] > 0:
        w = min(1.0, washed / pad['bcy'])
        gw = pad['gold'] * w
        mg = sum(pad['mixg'])
        mix = [x / mg for x in pad['mixg']] if mg > 0 else [0.25] * 4
        fin = pad['fine'] / pad['gold'] if pad['gold'] > 0 else 0.85
        phi = run / Reff if Reff > 0 else 1.0
        shares = []
        rem = 1.0
        if conc_on:
            for c in sorted(op.conc, key=lambda c: -BASE_CAP['centrifuge' if c.model.startswith('cen') else 'jig'][2]):
                sh = min(rem, c.spec / max(run, 1e-6))
                shares.append(('centrifuge' if c.model.startswith('cen') else 'jig', sh))
                rem -= sh
        shares.append(('sluice', rem))
        cap = capture(mix, phi, op.plant_skill, band, prep, shares, blocks[min(cur, len(blocks) - 1)]['clay'] if blocks else 0.15)
        for s in range(4):
            r_s = gw * mix[s] * cap[s]
            site.box['raw'][s] += r_s
            rec_raw += r_s
        site.box['fine'] += rec_raw * fin
        contained = gw
        pad['gold'] -= gw
        pad['fine'] -= gw * fin
        for s in range(4):
            pad['mixg'][s] *= (1 - w)
        pad['bcy'] -= washed
        o['phi'] = phi
    site.bcySinceClean += washed
    o.update(dug=dug, washed=washed, contained=contained, recovered=rec_raw, plantHrs=plant_hrs, Reff=Reff, run=run,
             DC=DC, haulcap=haulcap, feedcap=feedcap, D_plant=D_plant, mode=mode)
    # bottleneck attribution (coarse): the smallest weekly capacity among the chain
    exposedAvail = sum(max(0.0, site.exposed(b) - b['payDone']) for b in blocks[cur:cur + 3])
    if washed <= 0:
        bn = 'n/a'
    elif plant_on and washed >= 0.97 * D_plant * move_frac:
        bn = 'plant' if (op.plant and run >= op.feed_phi * Reff - 1e-6) else 'water'
    elif mode == 'padLoader' and washed >= 0.97 * feedcap:
        bn = 'feed'
    elif exposedAvail < 1500 and DC < (haulcap if mode != 'excavatorDirect' else 1e12):
        bn = 'strip/thaw (no exposed pay)'
    elif inst < 0.7 * r_ex:
        bn = 'dig (frozen pay)'
    elif mode in ('padLoader', 'truckDirect') and hauled >= 0.97 * haulcap:
        bn = 'haul'
    else:
        bn = 'dig'
    o['bottleneck'] = bn
    # ---- machine hours, fuel, maintenance (§7.11, §9 P1 flat maintenance)
    fuel = 0.0
    maint = 0.0
    smr_tot = 0.0

    def charge(m, work, availh, lf=1.0):
        nonlocal fuel, maint, smr_tot
        wait = max(0.0, availh - work)
        fuel += work * m.gph * lf + wait * 0.6 * m.gph * 0.30               # ops.idleEngineRunShare / idleLoadFactor
        smr = work + 0.6 * wait
        smr_tot += smr
        mo = 1 + 0.6 * (skill_wear(m.skill) - 1) if m.cls in ('excavator', 'dozer', 'artTruck', 'loader') else 1.0
        shop = min(0.70 if op.mechanic else 1.0, op.owner_shop_mult)     # fleet.p1InHouseMaintMult 0.70 / p1OwnerShopMaintMult (no stacking)
        maint += smr * m.maint * MAINT_MULT * GRADE_MAINT[m.grade] * mo * shop   # fleet.p1OpWearShare 0.6 in mo

    for m in op.by_role('strip'):
        av = H * avail(m) * F * Wx * sdZ
        wk = o['work_' + m.model + '_strip'] / max(1, len([x for x in op.by_role('strip') if x.model == m.model]))
        charge(m, wk, av, 1.15 if (m.ripper and frozen_stripped > 0) else 1.0)
    for m in diggers:
        av = H * avail(m) * F * Wx * sdZ
        charge(m, dig_work / max(1, len(diggers)), av)
    for m in rippers:
        av = H * avail(m) * F * Wx * sdZ
        charge(m, min(av, dug * 0.5 / max(m.rate() * 0.30, 1)), av, 1.15)
    for m in trucks + carriers:
        av = H * avail(m) * F * Wx * sdZ
        charge(m, av * (hauled / haulcap if haulcap > 0 else 0), av)
    for m in feeders:
        av = H * avail(m) * F * Wx
        rl = m.rate()
        charge(m, min(av, washed / rl + 3.0 * washed / 1000), av, 0.85)
    if pl is not None:
        ph = washed / run if run > 0 else 0.0
        charge(pl, ph, plant_hrs)
        for m in op.by_role('water'):
            charge(m, ph, plant_hrs)
        for m in op.by_role('power'):
            kw = PLANT_KW.get(pl.model, 0) + sum(PLANT_KW.get(c.model, 0) for c in op.conc)
            lf = clamp(kw / (0.75 * m.spec), 0.35, 1.33)
            charge(m, ph, plant_hrs, lf)
        for c in op.conc:
            charge(c, ph, plant_hrs)
        o['plantRunHrs'] = ph
        if op.well_gpm > 0:
            fuel += ph * 1.5                                                 # ops.wellPumpGalPerHr
    persons = op.crew() + 1                                                  # + owner on site
    fuel += persons * 7 * 3.5                                                # ops.campFuelGalPerPersonDay
    if op.shifts >= 2 and not (22 <= ctx.get('w', 0) <= 30):
        fuel += op.days * op.hours * 2.0                                     # ops.nightLightGalPerHr outside nightLightFreeWeeksNorth
    o['fuelGal'] = fuel
    o['fuel'] = fuel * ctx['fuelPrice']
    o['maint'] = maint
    o['smr'] = smr_tot
    # §7 ops.consumablesUsdPerBcyWashed 0.40; ops.getUsdPerBcyDug 0.05 / Stripped 0.03; frozen or bedrock × ops.getFrozenMult 2.0
    o['consumables'] = washed * 0.40 + get_dug * 0.05 + (stripped + frozen_stripped) * 0.03
    tier = CAMP_TIER.get(op.camp.model, 0.8) if op.camp else 1.0
    o['camp'] = persons * 7 * 55 * tier                                      # ops.campUsdPerPersonDay × campTierMult
    o['siteFixed'] = 750.0                                                   # ops.siteFixedUsdPerWeek
    o['waterTrucks'] = op.water_trucks * op.days * 1400.0                    # ops.waterTruckDayRateUsd
    o['wages'] = op.weekly_wages(ctx['burden'])
    o['cleanH'] = cleanH
    return o


def cleanup(site, op, burden):
    """§7.10 gold chain: gold-room loss, dirt, raw weight; returns (raw oz weighed, true fine oz, OT wage cost)."""
    gross = site.box['raw']
    G = sum(gross)
    if G <= 0:
        return 0.0, 0.0, 0.0
    sk = skill_rec(op.plant_skill)
    loss = [gross[s] * GOLDROOM_LOSS[s] * sk for s in range(4)]
    metal = G - sum(loss)
    alloy = site.box['fine'] / G
    dirt = DIRT_FRAC * sk
    raw = metal / (1 - dirt)
    fine = metal * alloy
    site.box = dict(raw=[0.0] * 4, fine=0.0)
    site.bcySinceClean = 0.0
    cleanH = 4 + 0.04 * (op.plant.spec if op.plant else 40)
    ot = 2 * cleanH * wage_rate('plantOperator', op.district, op.access) * OT_MULT * burden   # cleanup on the off-day (D-7.12)
    return raw, fine, ot


LB_DISC = 0.10                     # §10 market.localBuyer.discount
ARID_MAKEUP = 0.15                 # §7 ops.makeupFrac.arid (sweep lever)
MAINT_MULT = 1.0                   # sweep lever on §9 fleet.p1MaintUsdPerHr
DIG_FROZEN = 0.35                  # §7 ops.digMult.gravelFrozen


def local_buyer_net(raw, fine, spot, access, rng=None):
    """§10 10.10 estimatedFine local buyer: buyer fineness = true × (1 + clamp(biasMean + err, −0.10, +0.03)),
    biasMean ~ N(−0.03, 0.01) per buyer, err ~ N(0, 0.02) per claim (market.localBuyer.biasMean/biasSd/claimErrSd; drawn per lot
    here, sd √(0.01² + 0.02²)); discount market.localBuyer.discount 0.10 + smallLotAdd 0.05 (< 2 raw oz) / midLotAdd 0.02
    (< 10) + remoteAdd 0.02 (winterTrail, flyIn). P1 has no weekly cap."""
    bias = -0.03 + (rng.gauss(0, 0.0224) if rng else 0.0)
    d = LB_DISC + (0.05 if raw < 2 else 0.02 if raw < 10 else 0.0) + (0.02 if access in ('winterTrail', 'flyIn') else 0.0)
    return fine * (1 + clamp(bias, -0.10, 0.03)) * spot * (1 - d)


# §10 10.11 refineries: (min raw oz, Au payable, $/fine oz, min charge, melt+assay $/lot, settle weeks after assay)
REFINERIES = {'Northlight': (5, 0.995, 10.0, 250.0, 175.0, 0), 'Graywater': (50, 0.997, 5.0, 400.0, 200.0, 0),
              'Meridian': (300, 0.999, 2.0, 750.0, 250.0, 1)}
SHIP_FLAT = {'highway': 450.0, 'seasonalRoad': 900.0, 'winterTrail': 1800.0, 'flyIn': 2500.0}   # market.ship.flat*
SHIP_TRANSIT = {'highway': 1, 'seasonalRoad': 1, 'winterTrail': 2, 'flyIn': 2}                  # market.ship.transit*Weeks


def refinery_net(raw, fine, spot, access='seasonalRoad', dirt=0.04):
    """§10 10.11: best eligible refinery for a lot. net = payable + silver − max(min, $/oz × fine) − melt/assay − shipping;
    shipping = flat[access] + 0.15 % of declared value; silver credit Ag = doré × (1 − alloy) × 0.75 at 90 % × spot/80.
    Returns (net, weeks until cash) with cash = ship + transit + 1 (assay) + settle."""
    best = None
    dore = raw * (1 - dirt)
    alloy = fine / dore if dore > 0 else 0.85
    ag = dore * (1 - alloy) * 0.75
    silver = ag * 0.90 * spot / 80.0 if dore > 0 and ag / dore >= 0.02 else 0.0
    for name, (mn, pay, per, minc, assay, settle) in REFINERIES.items():
        if raw < mn:
            continue
        net = fine * pay * spot + silver - max(minc, per * fine) - assay - SHIP_FLAT[access] - 0.0015 * fine * spot
        wk = SHIP_TRANSIT[access] + 1 + settle
        if best is None or net > best[0]:
            best = (net, wk)
    return best


# =====================================================================================
# 5. CALENDAR AND WEATHER (§1.4-1.5), simplified
# =====================================================================================
ANCH = [3, 7, 11, 15, 20, 24, 28, 33, 37, 42, 46, 50]                      # §1.5.1 anchor weeks
TCLIM = {'north': [-10, -5, 8, 28, 46, 58, 60, 53, 42, 22, 2, -6],          # northernInterior °F
         'arid': [52, 56, 61, 68, 77, 87, 92, 91, 85, 73, 60, 51]}          # aridDesert °F
SDT = {'north': [12, 12, 9, 7, 5, 5, 5, 5, 5, 7, 9, 12], 'arid': [5, 5, 5, 4, 4, 4, 3, 3, 4, 4, 5, 5]}
MONTH_END = [5, 9, 13, 18, 22, 26, 31, 35, 39, 44, 48, 52]                  # §1 monthEndWeeks


def tclim(d, w):
    a = ANCH
    t = TCLIM[d]
    for i in range(12):
        w0, w1 = a[i], a[(i + 1) % 12] + (52 if i == 11 else 0)
        ww = w + (52 if (i == 11 and w < a[0]) else 0)
        if w0 <= ww <= w1:
            return t[i] + (t[(i + 1) % 12] - t[i]) * (ww - w0) / (w1 - w0)
    return t[0]


def month_of_week(w):
    return min(11, int(((w - 1) * 7 + 3) / 30.42))


def band_of(T):
    return 'deepCold' if T < 0 else 'cold' if T < 28 else 'cool' if T < 45 else 'mild' if T < 80 else 'hot'


def jround(x):
    """§1 calendar round() as the TypeScript engine evaluates it (Math.round: halves round up). Python's round() rounds
    halves to even, which would put the mean-calendar breakup (18.5) in week 18 instead of week 19."""
    return math.floor(x + 0.5)


def make_year(d, rng, sigma=1.0, freeze_shift=0.0, mean_only=False, hours=11):
    """Returns list of 52 week dicts {phase, band, W, sff, precip} and season summary (§1.4.3, 1.5)."""
    g = (lambda: 0.0) if mean_only else (lambda: rng.gauss(0, 1))
    weeks = []
    if d == 'north':
        zB, zF, n1, n2 = g(), g(), g(), g()
        brk = int(clamp(jround(18.5 + sigma * 1.0 * zB), 16, 22))             # §1 game.season breakupMean/Sd/min/max 18.5/1.0/16/22
        dur = int(clamp(jround(1.4 + 0.6 * n1), 1, 3))
        op0 = brk + dur
        fz = int(clamp(jround(42.0 + freeze_shift + sigma * 1.4 * zF), 38, 46))  # §1 game.season freezeMean/Sd/min/max 42.0/1.4/38/46
        L = clamp(fz - op0, 17, 27)
        fz = op0 + L
        fzDur = int(clamp(jround(2.0 + 0.6 * n2), 1, 3))               # §1 freezeDurMean/Sd 2.0/0.6, clamp 1-3
        a = 0.0
        for w in range(1, 53):
            a = 0.55 * a + math.sqrt(1 - 0.55 ** 2) * g()
            sa = -zB if 10 <= w <= 24 else (zF if 32 <= w <= 46 else 0.0)
            T = tclim('north', w) + SDT['north'][month_of_week(w)] * (0.8 * a + 0.6 * sa)
            if w < brk or w >= fz + fzDur:
                ph = 'winter'
            elif w < op0:
                ph = 'breakup'
            elif w < fz:
                ph = 'operating'
            else:
                ph = 'freezeup'
            bnd = band_of(T)
            if ph == 'operating' and bnd in ('cold', 'deepCold'):
                bnd = 'cool'
            if ph == 'breakup':
                bnd = 'cool' if bnd in ('cold', 'deepCold', 'cool') else bnd
            if ph == 'freezeup':
                bnd = 'cool' if bnd in ('mild', 'hot') else bnd
            k = w - op0
            sff = 1.4 if 0 <= k < 5 else (0.9 if k < 14 else 0.75)            # §3 listingShape early/mid/late as a hydrograph
            weeks.append(dict(w=w, phase=ph, band=bnd, W=1.0, sff=sff, precip='normal', T=T))
        return weeks, dict(breakup=brk, opStart=op0, freeze=fz, opWeeks=fz - op0)
    # arid: always operating; heat factor on the day shift (§7 ops.heatDayShiftHoursMult), fire level 3 in dry Junes
    A = g()
    a = 0.0
    for w in range(1, 53):
        a = 0.55 * a + math.sqrt(1 - 0.55 ** 2) * g()
        T = tclim('arid', w) + SDT['arid'][month_of_week(w)] * (0.8 * a + (0.6 * A if 18 <= w <= 40 else 0))
        heat = clamp(1 - 0.03 * (T - 80), 0.55, 1.0) if T >= 80 else 1.0
        mo = month_of_week(w)
        fire = 1.0
        if mo == 5 and (mean_only or rng.random() < 0.40):                    # level 3 ≈ 40 % of June weeks (§1.5.1)
            fire = min(1.0, 8.0 / hours) if not mean_only else 1 - 0.4 * (1 - min(1.0, 8.0 / hours))
        if mean_only:
            pw = 0.28 if 27 <= w <= 38 else 0.10
            precip = 'normal'
        else:
            pw = 0.28 if 27 <= w <= 38 else 0.10                              # wet+storm share (§1.5.1)
            precip = 'wet' if rng.random() < pw else 'normal'
        weeks.append(dict(w=w, phase='operating', band=band_of(T), W=heat * fire, sff=1.0, precip=precip, T=T, pwet=pw))
    return weeks, dict(breakup=None, opStart=1, freeze=53, opWeeks=52)


# =====================================================================================
# 6. FINANCE (§11): loans, insurance, taxes (simplified)
# =====================================================================================
def amort_payment(L, annual, n_months):
    """§11 11.7 level payment: P = L·i / (1 − (1 + i)^−n), i = annual / 12."""
    i = annual / 12
    return L * i / (1 - (1 + i) ** -n_months) if i > 0 else L / n_months


SEASONAL_PAY_MONTHS = (5, 6, 7, 8, 9, 10)          # §11 11.7 'seasonal' northern pay months Jun–Nov (0-based month index)


def seasonal_payment(L, annual, n_months, first_month=0, pay_months=SEASONAL_PAY_MONTHS):
    """§11 11.7 generalized schedule with no IO months: P = L / Σ_{k∈pay} v^k, v = 1/(1 + i); month k = 1..n falls in
    calendar month (first_month + k − 1) mod 12. $320k, 8.5 %, 84 mo funded week 1 (first_month 0 = January) → $10,281.75."""
    i = annual / 12
    v = 1 / (1 + i)
    tot = sum(v ** k for k in range(1, n_months + 1) if (first_month + k - 1) % 12 in pay_months)
    return L / tot


class Fin:
    def __init__(self, cash, personal=0.0, phase=1, entity='llc', grace=6):
        self.cash = cash
        self.personal = personal
        self.phase = phase
        self.loans = []          # dict(bal, rate, pmt, left, kind[, seasonal, io])
        self.grace = grace       # §11 finance.p1InsolvencyGraceWeeks (8 / 6 / 4)
        self.neg_weeks = 0
        self.bankrupt = False
        self.bankrupt_week = None
        self.injected = 0.0
        self.lease_roy = 0.0     # property-level in-kind royalty (rawOz basis)
        self.inv_roy = 0.0       # attributable investor royalty (§1 Backed royalty: 10% of fine oz in kind)
        self.inv_roy_paid = 0.0
        self.inv_contrib = 0.0
        self.amr = 0.0
        self.amr_week = None
        self.amr_credit = 0.0
        self.claim_fee = 0.0
        self.min_cash = cash
        self.ledger = defaultdict(float)     # year accumulators by category
        self.tax_due_next = []               # (week offset, amount)
        self.hard_money_cap = 0.0

    def loan(self, amount, annual, months, kind='equip', seasonal=False, io=False, proceeds=None, first_month=0):
        pmt = seasonal_payment(amount, annual, months, first_month) if seasonal else amort_payment(amount, annual, months)
        self.loans.append(dict(bal=amount, rate=annual, pmt=pmt, left=months, kind=kind, seasonal=seasonal, io=io))
        self.cash += amount if proceeds is None else proceeds

    def month_end(self, month=None):
        """§11 11.7: monthly payments at §1 monthEndWeeks; 'seasonal' loans accrue interest in skipped months;
        hard money (§11 11.6 Klondike Bridge) is interest-only with a balloon at maturity."""
        tot = 0.0
        interest = 0.0
        for L in self.loans:
            if L['left'] <= 0 or L['bal'] <= 1:
                continue
            i = L['bal'] * L['rate'] / 12
            if L.get('seasonal') and month is not None and month not in SEASONAL_PAY_MONTHS:
                L['bal'] += i
                L['left'] -= 1
                interest += i
                continue
            if L.get('io'):
                p = i + (L['bal'] if L['left'] == 1 else 0.0)
            else:
                p = min(L['pmt'], L['bal'] + i)
            L['bal'] -= (p - i)
            L['left'] -= 1
            tot += p
            interest += i
        self.cash -= tot
        self.ledger['debtService'] += tot
        self.ledger['interest'] += interest
        return tot

    def debt(self):
        return sum(L['bal'] for L in self.loans if L['left'] > 0)

    def spend(self, cat, amt):
        self.cash -= amt
        self.ledger[cat] += amt

    def check_solvency(self, policy, week, can_inject=True):
        """Owner injection, then (FULL rules) hard money against unencumbered iron, then the P1 insolvency counter
        (§1 1.14, §11 11.16 'Phase 1 form'): consecutive weeks with cash < 0. Bankruptcy is decided by settle_bankruptcy()
        after the bot's last-resort fleet sale."""
        if self.cash < 0 and policy.get('inject', True) and can_inject and self.personal > 0:
            need = -self.cash + policy.get('inject_buffer', 0.0)
            x = min(need, self.personal)
            self.personal -= x
            self.cash += x
            self.injected += x
        if self.cash < 0 and self.hard_money_cap > 0:                       # §11 11.6 hard money: 0.60 × OLV, 14 % + 3 points
            x = min(-self.cash + 20000, self.hard_money_cap)
            self.hard_money_cap -= x
            self.loan(x, 0.14, 24, 'hard', io=True, proceeds=0.97 * x)        # interest-only, balloon at 24 months
            self.ledger['financeFees'] += x * 0.03
        if self.cash < 0:
            self.neg_weeks += 1
        else:
            self.neg_weeks = 0
        self.min_cash = min(self.min_cash, self.cash)

    def settle_bankruptcy(self, week):
        """§11 11.16 Phase 1 form: bankrupt after finance.p1InsolvencyGraceWeeks consecutive open weeks."""
        if self.cash < 0 and self.neg_weeks >= self.grace:
            self.bankrupt = True
            self.bankrupt_week = week


BOOK_DEP = {'excavator': (8, .25), 'dozer': (10, .30), 'wheeled': (8, .20), 'plant': (8, .15), 'light': (5, .15),
            'site': (7, .10)}                                                 # §9 fleet.bookLifeYears / bookResidual
BOOK_SITE = {'pickup', 'campT8', 'campS12', 'campM25'}                         # §9 'site' class items book on the site row


def book_dep_per_week(op, prices):
    tot = 0.0
    for m, p in zip(op.machines, prices):
        life, res = BOOK_DEP['site' if m.model in BOOK_SITE else m.fam]
        tot += p * (1 - res) / (life * 52)
    return tot


def sell_lot(fin, Y, pending, opts, op, lot, fe, spot, w, rng):
    """Sale channel: P1 local buyer; P5 bots ship to the best refinery whenever the lot meets a refinery minimum (§2.12.1
    cautious sale policy; §10 10.11 minimum 5 raw oz at Northlight), else the local buyer."""
    if opts.get('sell') in ('refinery', 'refineryAll') and lot >= 5:
        net, wk = refinery_net(lot, lot * fe, spot, op.access)
        pending.append((w + wk, net))
    else:
        net = local_buyer_net(lot, lot * fe, spot, op.access, rng if opts.get('subblock', True) else None)
        fin.cash += net
    Y['revenue'] += net
    return net


def run_year(op, site, fin, cal, rng, opts):
    """Simulate one calendar year of an operation (52 weekly turns). Mutates site and fin; returns weekly records + summary."""
    weeks, summ = cal
    burden = opts.get('burden', BURDEN_P1)
    policy = opts.get('policy', {})
    price = opts.get('price', lambda w: SPOT)
    diesel = opts.get('diesel', lambda w: DIESEL_RACK)
    start_week = opts.get('start_week', 1)
    active = opts.get('active', True)
    depw = opts.get('depPerWeek', 0.0)
    rebuild = opts.get('rebuildShiftUsd', 0.0)          # §11 11.15: winter rebuild cash paid Jan–Apr instead of with the hours
    maint_cash_scale = opts.get('maintCashScale', 1.0)
    recs = []
    Y = defaultdict(float)
    season_started = False
    winterized = False
    stood_down = False
    pending = []       # (week, cash) refinery settlements
    lastOpWeek = max((wk['w'] for wk in weeks if wk['phase'] in ('operating', 'freezeup')), default=52)
    cleans = 0
    for wk in weeks:
        w = wk['w']
        spot = price(w)
        rec = dict(w=w, phase=wk['phase'], washed=0.0, raw=0.0, fine=0.0, rev=0.0, opex=0.0)
        on = active and w >= start_week and not fin.bankrupt and not stood_down
        if op.district == 'north':
            on = on and wk['phase'] in ('breakup', 'operating', 'freezeup')
        else:
            on = on and not (op.arid_idle_summer and 23 <= w <= 38)
        if on:
            if not season_started:
                season_started = True
                winterized = False
                fin.spend('staffing', op.crew() * TRAVEL[op.access])           # §8 staff.travelUsd arrival
            ctx = dict(w=w, phase=wk['phase'], band=wk['band'], W=wk['W'], sff=wk['sff'], precip=wk['precip'],
                       fuelPrice=diesel(w) + access_factors(op.access, op.dist_mi)[0], burden=burden,
                       subblock=opts.get('subblock', True))
            r = ops_week(site, op, ctx, rng)
            for cat in ('wages', 'fuel', 'maint', 'consumables', 'camp', 'siteFixed', 'waterTrucks'):
                fin.spend(cat, r[cat] * (maint_cash_scale if cat == 'maint' else 1.0))
                Y[cat] += r[cat]
                rec['opex'] += r[cat] * (maint_cash_scale if cat == 'maint' else 1.0)
            Y['washed'] += r['washed']
            Y['dug'] += r['dug']
            Y['stripped'] += r['stripped']
            Y['frozenStripped'] += r['frozenStripped']
            Y['plantRunHrs'] += r.get('plantRunHrs', 0)
            Y['plantHrs'] += r.get('plantHrs', 0)
            Y['contained'] += r['contained']
            Y['recovered'] += r['recovered']
            Y['fuelGal'] += r['fuelGal']
            Y['opWeeks'] += 1 if r['washed'] > 0 else 0
            Y['bn_' + r['bottleneck']] += 1
            rec['washed'] = r['washed']
            rec['stripped'] = r['stripped']
            if r['washed'] > 0:
                site.sinceClean += 1
            last = (op.district == 'north' and w == lastOpWeek) or (site.remaining_pay() < 1)
            if site.sinceClean >= op.cleanup_every or last or site.sinceClean >= 8:   # ops.maxBoxWeeks 8
                raw, fine, ot = cleanup(site, op, burden)
                site.sinceClean = 0
                if raw > 0:
                    cleans += 1
                    fin.spend('wages', ot)
                    Y['wages'] += ot
                    rec['opex'] += ot
                    # §5 settleProductionInterests: property level (lease royalty) on gross raw, in kind
                    fe = fine / raw
                    due = fin.lease_roy * raw
                    v = spot * fe
                    off = min(due, fin.amr_credit / v) if v > 0 else 0.0
                    fin.amr_credit -= off * v
                    deliver = due - off
                    Y['royaltyOzRaw'] += deliver
                    Y['royaltyValue'] += deliver * fe * spot
                    rawB = raw - due
                    # attributable level: investor royalty 10% of fine oz (§1 1.8.1), 3 % tail after 2.0× the contribution
                    inv = 0.0
                    if fin.inv_roy > 0:
                        rate = fin.inv_roy if fin.inv_roy_paid < 2.0 * fin.inv_contrib else 0.03
                        inv = rate * rawB
                        fin.inv_roy_paid += inv * fe * spot
                        Y['invRoyaltyValue'] += inv * fe * spot
                    lot = rawB - inv
                    Y['rawWeighed'] += raw
                    Y['fineGross'] += fine
                    Y['fineSold'] += lot * fe
                    net = sell_lot(fin, Y, pending, opts, op, lot, fe, spot, w, rng)
                    rec['rev'] = net
                    rec['raw'] = raw
                    rec['fine'] = lot * fe
            # §2.12.1 cautious exit rule (reduced): stand down when the season is losing money after >= 3 cleanups
            if policy.get('stop_if_losing') and cleans >= 3 and wk['phase'] == 'operating':
                if Y['revenue'] < 0.85 * (Y['wages'] + Y['fuel'] + Y['maint'] + Y['consumables'] + Y['camp'] + Y['siteFixed']):
                    stood_down = True
                    Y['stoodDown'] = w
        elif season_started and not winterized:
            winterized = True
            if site.sinceClean > 0:
                raw, fine, ot = cleanup(site, op, burden)
                if raw > 0:
                    fe = fine / raw
                    lot = raw * (1 - fin.lease_roy)
                    Y['rawWeighed'] += raw
                    Y['fineGross'] += fine
                    Y['fineSold'] += lot * fe
                    Y['royaltyValue'] += raw * fin.lease_roy * fe * spot
                    sell_lot(fin, Y, pending, opts, op, lot, fe, spot, w, rng)
                site.sinceClean = 0
            wz = 3000 + 80 * wage_rate('laborer', op.district, op.access) * burden   # ops.winterizeUsd + winterizeCrewHours
            fin.spend('mobilization', wz)
            Y['mobilization'] += wz
            fin.spend('staffing', op.crew() * TRAVEL[op.access])
            if op.district == 'north':
                site.overwinter()
        # settlements, monthly items, obligations
        for (pw, amt) in list(pending):
            if pw <= w:
                fin.cash += amt
                pending.remove((pw, amt))
        if w in MONTH_END:
            mi = MONTH_END.index(w)
            ds = fin.month_end(mi)
            Y['debtService'] += ds
            if rebuild > 0 and mi <= 3:
                fin.spend('maintRebuild', rebuild / 4)
                Y['rebuildCash'] += rebuild / 4
            if opts.get('gaMonthly', 0):
                fin.spend('ga', opts['gaMonthly'])
                Y['ga'] += opts['gaMonthly']
            if opts.get('insAnnual', 0):
                fin.spend('insurance', opts['insAnnual'] / 12 * 1.04)           # finance.ins.monthlyInstallmentLoad 0.04
                Y['insurance'] += opts['insAnnual'] / 12 * 1.04
        if fin.amr > 0 and fin.amr_week == w and opts.get('year', 1) > 1:
            fin.spend('amr', fin.amr)
            fin.amr_credit += fin.amr
            Y['amr'] += fin.amr
        if fin.claim_fee > 0 and w == 35:
            fin.spend('claimFees', fin.claim_fee)
            Y['claimFees'] += fin.claim_fee
        for (tw, amt) in list(opts.get('dueThisYear', [])):
            if tw == w:
                fin.spend('tax', amt)
                Y['tax'] += amt
        if opts.get('livingFromPersonal'):
            fin.personal -= 900.0                                            # §1 game.ownerLivingCostPerWeek (P4)
        fin.check_solvency(policy, w, can_inject=policy.get('inject', True))
        if fin.cash < 0 and fin.neg_weeks >= policy.get('sellAt', 99) and not Y.get('fleetSold') and opts.get('fleetValue', 0) > 0:
            fin.cash += 0.80 * opts['fleetValue']                            # §9 fleet.p1DealerCashShare 0.80 × resale, instant
            Y['fleetSold'] = w
            stood_down = True
            if fin.cash >= 0:
                fin.neg_weeks = 0
        fin.settle_bankruptcy(w)
        rec['cash'] = fin.cash
        recs.append(rec)
        if fin.bankrupt:
            Y['bankruptWeek'] = w
            # remaining weeks: nothing happens
            for wk2 in weeks[weeks.index(wk) + 1:]:
                recs.append(dict(w=wk2['w'], phase=wk2['phase'], washed=0, raw=0, fine=0, rev=0, opex=0, cash=fin.cash))
            break
    for (pw, amt) in pending:          # late settlements land at year end
        fin.cash += amt
    Y['depreciation'] = depw * 52
    return recs, Y


def season_summary(Y, fin_ledger=None):
    opex = sum(Y[k] for k in ('wages', 'fuel', 'maint', 'consumables', 'camp', 'siteFixed', 'waterTrucks'))
    return opex


# =====================================================================================
# 7. REFERENCE OPERATIONS
# =====================================================================================
def mk_blocks(n, g, ob, T, B, perm, clay=0.15, bould=0.2, mix=(.25, .40, .27, .08), fin=0.86, sb=0.20, lg=2.0, cem=0.0):
    return [dict(g=g, ob=ob, T=T, B=B, perm=perm, clay=clay, bould=bould, mix=mix, fin=fin, sb=sb, lg=lg, cem=cem, f=1.0)
            for _ in range(n)]


def fleet(spec):
    """spec: list of (model, role, grade[, skill, ripper])."""
    out = []
    for s in spec:
        m = Machine(s[0], s[1], s[2], s[3] if len(s) > 3 else 50, s[4] if len(s) > 4 else None)
        out.append(m)
    return out


def price_of(m):
    p = fmv_used(m.model, m.grade)
    if m.model == 'dz6' and m.ripper:
        p += 35000                                                          # §9 D6 ripper option +$35k
    return p


REF_OPS = {}


def ref_backed():
    ms = fleet([('ex30', 'dig', 'C'), ('dz8', 'strip', 'C'), ('ld966', 'feed', 'C'), ('adt30', 'haul', 'C'),
                ('tr75', 'plant', 'N'), ('pmp6', 'water', 'N'), ('pmp6', 'water', 'N'), ('campT8', 'site', 'N'),
                ('pickup', 'site', 'C')])
    return Op('(b) Backed reference op (north)', 'north', ms, days=6, hours=11, foreman_skill=40, plant_skill=55,
              laborers=1, access='seasonalRoad', dist_mi=60, haul_blocks=4, water_gpm=600)


def ref_bootstrapper_p1(ripper=False):
    ms = fleet([('ex30', 'dig', 'D'), ('dz6', 'strip', 'D', 50, ripper), ('tr50', 'plant', 'D'), ('pmp6', 'water', 'C'),
                ('campT8', 'site', 'C'), ('pickup', 'site', 'D')])
    return Op('(a) Bootstrapper P1 cash-only (north)', 'north', ms, days=6, hours=11, foreman_skill=40, plant_skill=50,
              laborers=1, access='seasonalRoad', dist_mi=60, haul_blocks=1, water_gpm=600, direct_feed=True)


def ref_bootstrapper_p4():
    ms = fleet([('ex30', 'dig', 'C'), ('dz6', 'strip', 'C', 50, True), ('ld950', 'feed', 'D'), ('adt30', 'haul', 'D'),
                ('tr75', 'plant', 'C'), ('pmp6', 'water', 'C'), ('pmp6', 'water', 'C'), ('campT8', 'site', 'C'),
                ('pickup', 'site', 'D')])
    return Op('(a4) Bootstrapper P4 financed (north)', 'north', ms, days=6, hours=11, foreman_skill=40, plant_skill=55,
              laborers=1, access='seasonalRoad', dist_mi=60, haul_blocks=4, water_gpm=600)


def ref_mature():
    ms = fleet([('ex45', 'dig', 'B'), ('ex45', 'dig', 'B'), ('dz9', 'strip', 'B'), ('dz8', 'strip', 'C'),
                ('adt40', 'haul', 'B'), ('adt40', 'haul', 'B'), ('adt40', 'haul', 'B'), ('ld980', 'feed', 'B'),
                ('tr300', 'plant', 'N'), ('cenL', 'plant', 'N'), ('pmp10', 'water', 'N'), ('pmp10', 'water', 'N'),
                ('gen300', 'power', 'N'), ('campM25', 'site', 'N'), ('pickup', 'site', 'B'), ('pickup', 'site', 'B')])
    return Op('(c) Mature 2-shift op (north)', 'north', ms, days=6, shifts=2, hours=10, foreman_skill=70, hired_foreman=True,
              plant_skill=65, laborers=2, cook=True, mechanic=True, access='seasonalRoad', dist_mi=60, haul_blocks=5,
              water_gpm=2500, phase=3)


ARID_MEDIAN_WELL = 120.0     # §3 3.2 aridFederal well yield LN(120 gpm, 0.8): median of the arid listing pool


def ref_arid(trucks=1, well=ARID_MEDIAN_WELL, idle_summer=False):
    """BALANCE fixture starterArid: median well + one water truck (§7 7.20 exit gate, 7.23)."""
    ms = fleet([('ex30', 'dig', 'C'), ('dz6', 'strip', 'D'), ('tr50', 'plant', 'N'), ('cenM', 'plant', 'N'),
                ('gen100', 'power', 'N'), ('pmp6', 'water', 'N'), ('campT8', 'site', 'C'), ('pickup', 'site', 'C')])
    return Op('(d) Arid op: ex30 direct feed, tr50 + centrifuge, median well', 'arid', ms, days=6, hours=10, foreman_skill=40,
              plant_skill=55, laborers=1, access='seasonalRoad', dist_mi=25, haul_blocks=1, water_gpm=0.0,
              well_gpm=well, water_trucks=trucks, direct_feed=True, arid_idle_summer=idle_summer)


def ref_inheritor():
    # §1 1.8.2 inherited fleet, grade D; the D6 carries a ripper (EC-01)
    ms = fleet([('ex30', 'dig', 'D'), ('dz6', 'strip', 'D', 50, True), ('ld950', 'haul', 'D'), ('tr50', 'plant', 'D'),
                ('pmp6', 'water', 'D'), ('gen100', 'idle', 'D'), ('pickup', 'site', 'D'), ('campT8', 'site', 'D')])
    for m in ms:
        m.inherited = True
    return Op('(e) Inheritor (inherited grade-D fleet)', 'north', ms, days=6, hours=11, foreman_skill=40, plant_skill=50,
              laborers=1, access='seasonalRoad', dist_mi=60, haul_blocks=2, water_gpm=600)


REF_CLAIM_N = dict(g=0.012, ob=15, T=5, B=1.5, perm=0.8)          # guide anchor reference claim (0.012 in pay, 15 ft OB)
REF_CLAIM_A = dict(g=0.010, ob=4, T=4, B=0.7, perm=0.0, clay=0.25, bould=0.10, mix=(.10, .30, .40, .20), fin=0.78, cem=0.3, lg=3.0, sb=0.12)


def run_ref(op, claim, years=1, pre=0, cash=5e6, phase=1, mean_cal=True, n_blocks=40, opts=None, rng_seed=1, start_week=1):
    rng = R(rng_seed)
    site = Site(mk_blocks(n_blocks, **claim), pre_stripped=pre)
    fin = Fin(cash, phase=phase)
    out = []
    for y in range(years):
        cal = make_year(op.district, rng, mean_only=mean_cal, hours=op.hours)
        o = dict(burden=BURDEN_P1, subblock=False, year=y + 1, start_week=start_week if y == 0 else 1)
        if opts:
            o.update(opts)
        recs, Y = run_year(op, site, fin, cal, rng, o)
        out.append((recs, Y, cal[1]))
    return out, fin, site


# =====================================================================================
# 8. ENGINE-DERIVED UNIT ECONOMICS: season volume V(SR, p), season cost, break-even grade
# =====================================================================================
def season_point(op_fn, ob, perm, g=0.012, T=5.0, B=1.5, year=2, claim_extra=None, n_blocks=60):
    """Run `year` seasons on a uniform claim; return the last season's Y and the fine oz per unit grade."""
    c = dict(g=g, ob=ob, T=T, B=B, perm=perm)
    if claim_extra:
        c.update(claim_extra)
    op = op_fn()
    out, fin, site = run_ref(op, c, years=year, n_blocks=n_blocks)
    Y = out[-1][1]
    return op, Y


def op_unit_table(op_fn, name, claim_extra=None, T=5.0, B=1.5, srs=(0.5, 1, 2, 3, 4, 6, 8, 10), perms=(0.0, 0.8), years=(1, 2)):
    rows = {}
    for yr in years:
        for p in perms:
            for sr in srs:
                ob = sr * (T + B) + MU_C
                op, Y = season_point(op_fn, ob, p, T=T, B=B, year=yr, claim_extra=claim_extra)
                opex = season_summary(Y) + Y['mobilization']
                rows[(yr, p, sr)] = dict(V=Y['washed'], C=opex, fine=Y['fineGross'], rev=Y['revenue'], raw=Y['rawWeighed'],
                                         contained=Y['contained'], recovered=Y['recovered'], maint=Y['maint'],
                                         weeks=Y['opWeeks'], plantHrs=Y['plantHrs'], runHrs=Y['plantRunHrs'])
    return rows


def interp_V(tab, yr, p, sr, perms=(0.0, 0.8)):
    """Linear interpolation of season washed volume in SR and permafrost share."""
    def at(pp):
        keys = sorted(k[2] for k in tab if k[0] == yr and k[1] == pp)
        if sr <= keys[0]:
            return tab[(yr, pp, keys[0])]['V']
        for a, b in zip(keys, keys[1:]):
            if a <= sr <= b:
                va, vb = tab[(yr, pp, a)]['V'], tab[(yr, pp, b)]['V']
                return va + (vb - va) * (sr - a) / (b - a)
        last = keys[-1]
        return tab[(yr, pp, last)]['V'] * last / sr          # beyond the grid: strip-limited, V ∝ 1/SR
    p0, p1 = perms
    t = clamp((p - p0) / (p1 - p0), 0, 1.25)
    return max(1000.0, at(p0) + (at(p1) - at(p0)) * t)


def op_recovery(mix, clay, conc_share=0.0, prep='trommel', skill=55):
    """§7 capture at φ = 1, mild water, skill 55, then §7 gold-room loss; conc_share = feed share through a centrifuge."""
    shares = [('centrifuge', conc_share), ('sluice', 1 - conc_share)] if conc_share > 0 else [('sluice', 1.0)]
    cap = capture(mix, 1.0, skill, 'mild', prep, shares, clay)
    gr = sum(mix[s] * cap[s] * (1 - GOLDROOM_LOSS[s] * skill_rec(skill)) for s in range(4))
    return gr


class EconTest:
    """Precise economic test of a claim for one operation type (see BALANCE.md §5 'econ class for op X').

    For each unmined block b (truth):
      SR_b   = max(0, OB − 0.5) / (T + B)                      in-situ strip ratio
      V_b    = engine season volume at (SR_b, permafrost_b), steady state (year 2)  [bcy/season]
      cost_b = payDug_b × (C_op + K_op) / V_b × (1 + 0.3(boulders − 0.2) + 0.3(clay − 0.15)) + reclaim $/acre
      rev_b  = payDug_b × headGrade_b × R_op(mix_b, clay_b) × fineness_b × $4,200 × netback_op × (1 − royalty)
    M = {rev_b > cost_b};  CDV = Σ_M (rev − cost) − D_op;  margin = Σ_M (rev − cost) / Σ_M rev
    class thresholds = §3.7 (CDV ≤ 0 uneconomic; ≥ $0.75M & ≥ 40 % good; ≥ $3.0M & ≥ 60 % excellent; else marginal)
    C_op   = engine season opex (wages, fuel, maintenance, consumables, camp, site, winterize)
    K_op   = capital charge 20 %/yr of fleet resale (10 % interest + 10 % economic depreciation)
    D_op   = one-time development: site mobilization (§7) + fleet transport (§9.5) [+ P2: plan prep $60k + bond carry]
    """

    def __init__(self, name, op_fn, tab, royalty, netback, conc_share, prep, recl=3000.0, extra_dev=0.0, district='north'):
        op = op_fn()
        self.name, self.tab, self.royalty, self.netback = name, tab, royalty, netback
        self.conc_share, self.prep, self.recl = conc_share, prep, recl
        self.K = 0.20 * op.fleet_value()
        _, mob = access_factors(op.access, op.dist_mi)
        self.D = 12000 * mob + transport_cost([m.model for m in op.machines], op.access, op.dist_mi) + extra_dev
        perms = sorted(set(k[1] for k in tab))
        self.perms = (perms[0], perms[-1])
        ref_keys = [k for k in tab if k[0] == 2]
        self.C = mean([tab[k]['C'] for k in ref_keys])
        self.district = district

    def evaluate(self, claim, est=None, royalty=None, per_block=False, sunk=False):
        roy = self.royalty if royalty is None else royalty
        K = 0.0 if sunk else self.K                         # owned iron (Inheritor): capital is sunk
        fa, mob = access_factors(claim['access'], claim['distMi'])
        fa0, mob0 = access_factors('seasonalRoad', 60)
        dC = 0.036 * self.C * (fa - fa0)                    # season fuel gal ≈ 3.6 % of opex $; delivered-fuel adder delta
        dD = 12000 * (mob - mob0) * 4                       # site + fleet moves scale with §3 mobMult
        blocks_out = []
        net = 0.0
        revs = 0.0
        nM = 0
        for idx, b in enumerate(claim['blocks']):
            if b['mined']:
                continue
            g = b['g'] if est is None else est[idx]
            payDug, ext = extraction(b)
            truthPay = (b['T'] + b['B']) * BCY_PER_ACRE_FT
            gpb = g * truthPay * ext / payDug
            payDug *= b.get('areaFrac', 1.0)
            sr = (0.0 if b.get('preStripped') else max(0.0, b['ob'] - MU_C)) / (b['T'] + b['B'])
            V = interp_V(self.tab, 2, b['perm'], sr, self.perms)
            gadj = 1 + 0.3 * (b['bould'] - 0.2) + 0.3 * (b['clay'] - 0.15)
            cost = payDug * (self.C + dC + K) / V * gadj + self.recl
            R = op_recovery(b['mix'], b['clay'], self.conc_share, self.prep)
            rev = payDug * gpb * R * b['fin'] * SPOT * self.netback * (1 - roy)
            blocks_out.append((idx, rev - cost))
            if rev > cost:
                net += rev - cost
                revs += rev
                nM += 1
        cdv = net - (0.0 if sunk else self.D + dD)
        margin = net / revs if revs > 0 else 0.0
        if per_block:
            return blocks_out
        if cdv <= 0:
            cls = 'uneconomic'
        elif cdv >= 3.0e6 and margin >= 0.60:
            cls = 'excellent'
        elif cdv >= 0.75e6 and margin >= 0.40:
            cls = 'good'
        else:
            cls = 'marginal'
        return cls, cdv, margin, nM


# =====================================================================================
# 9. LISTINGS AND SELLERS (§3.10, §5.3-5.4) for the Monte Carlo
# =====================================================================================
HONESTY_STD = {'accurate': .35, 'optimistic': .35, 'cherryPicked': .22, 'fraudulent': .08}       # §3 geology.seller.honestyMix (std)
TILT = {'estate': {'accurate': 1.6, 'fraudulent': 0.3}, 'retiringOperator': {'accurate': 1.3},
        'prospector': {'optimistic': 1.3, 'fraudulent': 1.5}, 'absentee': {'optimistic': 1.2},
        'distressedOperator': {'cherryPicked': 1.5, 'fraudulent': 1.2}}                           # §3 3.10.1 tilts
SITUATION = {'prospector': .35, 'absentee': .25, 'retiringOperator': .15, 'estate': .10, 'distressedOperator': .15}   # §3 3.10.1
M0_BETA = {'prospector': (2, 3), 'absentee': (2.5, 3), 'retiringOperator': (3, 3), 'distressedOperator': (3.5, 2.5),
           'estate': (4, 2)}                                                                   # §5 land.situationPrior (private)
LEASE_OFFER = {'prospector': .50, 'absentee': .70, 'retiringOperator': .50, 'distressedOperator': .30, 'estate': .20}  # §5 5.3
PACKAGE_COMPLETE = {'accurate': .7, 'optimistic': .5, 'cherryPicked': .3, 'fraudulent': .3}     # §3 3.10.3 data package
IN_GROUND = {'none': 0, 'anecdotal': .006, 'history': .015, 'report': .030, 'production': .045}  # §5 land.inGroundFrac
ROY_BASE = {'none': .03, 'anecdotal': .05, 'history': .09, 'report': .12, 'production': .16}       # §5 land.royaltyBase
ROY_REGION = {'north': .02, 'arid': -.01}                                                         # §5 land.royaltyRegionAdj
ACC_ACRE = {'highway': 1.25, 'seasonalRoad': 1.0, 'winterTrail': 0.7, 'flyIn': 0.5}               # §5 land.accessMultAcre
ACC_RES = {'highway': 1.0, 'seasonalRoad': 0.9, 'winterTrail': 0.75, 'flyIn': 0.55}              # §5 land.accessMultResource
PERMIT_RES_MULT = {'none': 1.0, 'notice': 1.1, 'plan': 1.5}                                       # §5 land.permitResourceMult
PERMIT_REPL = {'none': 0.0, 'notice': 8000.0, 'plan': 75000.0}                                    # §5 land.permitReplacementUsd
ROY_PERMIT = {'none': 0.0, 'notice': .01, 'plan': .03}                                            # §5 land.royaltyPermitAdj
STARTER_AMR_CAP = 15000.0                                                                         # §5 land.starterLeaseAmrCapUsd
SITE_VISIT_USD = {'highway': 400, 'seasonalRoad': 800, 'winterTrail': 1800, 'flyIn': 3500}        # §3 geology.siteVisit.costUsd
RECORDS_REVIEW_USD = 2000.0          # §4 4.2 `records`: fees $1,200 + travel $800 (owner's 3 desk days are free)
RECORDS_CHECK_USD = 250.0            # §6 permits.recordsCheckUsd (P2+: true permit tier and bond)
OWN_PIT_USD = 650.0                  # this model: own-excavator pit ≈ 2.5-4.4 machine-h + operator + laborer + test plant + $40 bags (§4 4.2)
PIT_MOB_USD = 1500.0                 # this model: moving the excavator and test plant to a listing, × §3 mobMult
PLAN_PREP_USD = 49000.0              # §6 6.5 fed.plan (EA level): fee 30,000 + direct 4,000 + baseline 15,000
PLAN_PREP_WEEKS = 20                 # §6 6.5 fed.plan desk 14 + field 6 weeks
PLAN_BOND_FACE = 45000.0             # this model: RCE of a first plan's open acres (§6 6.7 method; ≈ 6-8 ac)
SURETY_C = (0.04, 0.25)              # §6 permits.surety.tiers C: premium 4 %, collateral 25 %
REPORT_GOLD_PRICE = SPOT


def nice_round(x):
    """§5 5.4 niceRound: < $50k → $500; < $500k → $5,000; else $25,000."""
    step = 500 if x < 50e3 else 5000 if x < 500e3 else 25000
    return round(x / step) * step


def evidence_and_honest(claim, know, rng, hon, ps, gPS, gvPS, recent):
    """§3 3.10.2-3.10.3 (reduced): the seller's honest grade and the listing's evidence class."""
    honest, ev = None, 'none'
    pkg = rng.random() < PACKAGE_COMPLETE[hon]
    if know == 'operator':
        honest = gPS * rng.ln(1, 0.30) * (1.4 if recent else 1.0)      # history from the best (mined) blocks overstates
        nShown = claim.get('nSeasons', 0) if hon != 'cherryPicked' else (claim.get('nSeasons', 0) + 1) // 2
        last = claim.get('lastSeason') or 0
        if recent and nShown >= 3 and last >= START_YEAR - 8:
            ev = 'production'
        elif pkg and hon != 'fraudulent':
            ev = 'report'                                               # ≥ 6 pits with a lab, package complete
        elif recent and nShown >= 1:
            ev = 'history'
        else:
            ev = 'anecdotal'
    elif know == 'prospector':
        honest = gPS * math.exp(rng.gauss(-0.2, 0.7))                   # a few pans and pits; pans under-read
        ev = 'anecdotal'
    elif know == 'heirs':                                               # estates capped at 'history'
        rep = rng.random() < 0.6
        hist = recent and rng.random() < 0.5
        if rep:
            honest = gvPS * rng.ln(1, 0.4)                              # 1930s report = virgin grade
        elif hist:
            honest = gPS * rng.ln(1, 0.30) * 1.4
        ev = 'history' if (rep or hist) else 'none'
    else:                                                               # absentee
        rep = rng.random() < 0.5
        pits = rng.randint(0, 6)
        if rep:
            honest, ev = gvPS * rng.ln(1, 0.4), 'report'
        elif pits >= 1:
            honest = gPS * math.exp(rng.gauss(-0.1, 0.5))
            ev = 'report' if (pits >= 6 and pkg) else 'anecdotal'
    return honest, ev


def make_listing(claim, rng, honesty_mix=HONESTY_STD, full=False, starter=False, markup=0.30, res_disc=0.35):
    """One listing (§3 3.9-3.10 seller and evidence; §5 5.3-5.4 asking terms). Grades enter only through the seller's claim."""
    sit = rng.pick(SITUATION)
    w = dict(honesty_mix)
    for k, v in TILT[sit].items():
        w[k] *= v
    if starter:                                                         # §3 3.11 starter lease: accurate or cherryPicked holder
        w = {k: w[k] for k in ('accurate', 'cherryPicked')}
    hon = rng.pick(w)
    know = {'retiringOperator': 'operator', 'distressedOperator': 'operator', 'prospector': 'prospector',
            'estate': 'heirs', 'absentee': 'absentee'}[sit]
    tpl = TEMPLATES[claim['tpl']]
    ps = [b for b in claim['blocks'] if b['f'] >= 0.4 and not b['mined']]
    gPS = mean([b['g'] for b in ps]) if ps else mean([b['g'] for b in claim['blocks']])
    gvPS = mean([b['gv'] for b in ps]) if ps else gPS
    recent = claim['oldTimer'] == 'recentCat'
    honest, ev = evidence_and_honest(claim, know, rng, hon, ps, gPS, gvPS, recent)
    claimed = None
    if honest is not None:
        if hon == 'accurate':
            claimed = honest
        elif hon == 'optimistic':
            claimed = honest * clamp(rng.ln(1.45, 0.15), 1.15, 2.2)    # geology.seller.optMult
        elif hon == 'cherryPicked':
            claimed = honest * rng.ln(1.9, 0.25)                        # top 35 % of pits ≈ 1.94× (§3 3.10.3)
        else:
            claimed = max(honest, 0.6 * tpl['gMed']) * clamp(rng.ln(4.0, 0.35), 2.5, 10)   # geology.seller.fraudMult
    elif hon == 'fraudulent':
        claimed = 0.6 * tpl['gMed'] * clamp(rng.ln(4.0, 0.35), 2.5, 10)
        ev = 'history'
    if sit == 'estate' and ev in ('report', 'production'):
        ev = 'history'
    nps = max(1, len(ps))
    nmult = {'accurate': 1.0, 'optimistic': 1.2, 'cherryPicked': 1.0, 'fraudulent': 1.5}[hon]   # geology.seller.claimedBlocksMult
    Tm = mean([b['T'] for b in ps]) if ps else tpl['payMedFt']
    Bbar = 1.54 if claim['tpl'] == 'north' else 0.68                   # §3 3.9 B̄
    claimedOz = (claimed or 0) * nps * nmult * (Tm * (1.2 if hon == 'optimistic' else 1) + Bbar) * BCY_PER_ACRE_FT
    beliefG = (honest * (math.sqrt(1.45) if hon == 'optimistic' else 1.0)) if honest else tpl['gMed']
    beliefOz = beliefG * nps * (Tm + Bbar) * BCY_PER_ACRE_FT
    # permits: truth stub (§3 3.9) and the seller's statement (§3 3.10.3); P1 hides the field (auth none)
    true_auth = 'plan' if starter else claim.get('permit', 'none')
    auth = 'none'
    if full:
        auth = true_auth
        if hon == 'optimistic' and true_auth == 'notice' and rng.random() < 0.25:
            auth = 'plan'
        elif hon == 'optimistic' and true_auth == 'none' and recent and rng.random() < 0.20:
            auth = 'notice'
        elif hon == 'fraudulent' and rng.random() < 0.5:
            auth = 'plan'
        if know in ('heirs', 'absentee') and rng.random() < 0.5:
            auth = 'none'                                              # 'unknown' prices as none
    m = rng.betavariate(*M0_BETA[sit])                                 # §5 land.situationPrior m0
    f = claim['blocks'][0]['fin'] if claim['blocks'] else (0.86 if claim['tpl'] == 'north' else 0.78)
    f = round(f, 2) if (know == 'operator' and recent) else (0.86 if claim['tpl'] == 'north' else 0.78)
    if claim['tpl'] == 'north':
        ws = clamp(claim['water']['base'] * 0.9 / 750, 0, 1)            # §3 waterScore: shown mid flow / 750
    else:
        ws = clamp((claim['water']['base'] + 0.5 * ARID_MEDIAN_WELL) / 750, 0, 1)   # spring + 0.5 × regional median well
    A = claim['acres'] * 450 * ACC_ACRE[claim['access']]               # land.acreValueUsd unpatented 450
    Rv = lambda oz: oz * f * SPOT * IN_GROUND[ev] * ACC_RES[claim['access']] * (0.5 + 0.5 * ws) * PERMIT_RES_MULT[auth]
    impr = 0.0
    if recent:
        impr = rng.ln(25000, 0.6) * (0.4 if (claim.get('lastSeason') or 0) < START_YEAR - 15 else 1.0)  # geology.oldTimer.improvementsUsd
    nMined = sum(1 for b in claim['blocks'] if b['mined'])
    aro = nMined * 0.55 * 6000.0                                       # unreclaimed (reclaimed w.p. 0.45) × P1 stub $6,000/ac
    V_claimed = A + Rv(claimedOz) + PERMIT_REPL[auth] + 0.7 * impr - 0.5 * aro
    V_belief = A + Rv(beliefOz) + PERMIT_REPL[auth] + 0.7 * impr - 0.5 * aro
    ask = nice_round(max(V_claimed, A) * (1 + markup) * (1 - 0.25 * m) * rng.ln(1, 0.12))   # land.askMarkup / askMotivationDisc / askNoiseSigma
    res = max(V_belief * (1 - res_disc * m), 0.5 * A)                  # land.resMotivationDisc, land.resFloorFracOfA
    lease = starter or rng.random() < LEASE_OFFER[sit]
    roy = clamp(ROY_BASE[ev] + ROY_REGION[claim['tpl']] + ROY_PERMIT[auth] - 0.03 * m + rng.gauss(0, 0.01), 0.02, 0.25)
    amr = round(clamp(0.07 * V_claimed, 2000, 50000) / 500) * 500      # land.amrFrac / amrMinUsd / amrMaxUsd
    if starter:
        amr = min(amr, STARTER_AMR_CAP)
    return dict(claim=claim, sit=sit, hon=hon, ev=ev, claimed=claimed, claimedOz=claimedOz, beliefOz=beliefOz, ask=ask,
                res=res, lease=lease, roy=round(roy * 200) / 200, amr=amr, m=m, auth=auth, trueAuth=true_auth,
                starter=starter)


# =====================================================================================
# 10. MONTE CARLO OF THE FIRST SEASONS
# =====================================================================================
def price_path(rng, weeks=104, vol=1.0):
    """§10 10.2-10.3 simplified: hidden regime drift + GARCH(1,1) Student-t diffusion + jumps (no macro, no fair-value pull)."""
    reg = rng.pick({'bull': .44, 'range': .27, 'bear': .29})            # §10 10.5 opening regime mix after burn-in
    mu = {'bull': .14, 'range': .01, 'bear': -.16}                       # market.regime.drift.*
    vm = {'bull': 1.10, 'range': 0.80, 'bear': 1.10}                     # market.regime.volMult.*
    px = {'bull': .0045, 'range': .0085, 'bear': .0045}                  # market.regime.exitProb.*
    sbar = 0.018 * vol                                                   # market.garch.sigmaBarWeekly × market.volMult
    a, gm, b = 0.07, 0.03, 0.88                                          # market.garch.alpha / gammaUp / beta
    h = sbar ** 2
    e = 0.0
    S = SPOT
    out = []
    for t in range(weeks):
        if rng.random() < px[reg]:
            u = rng.random()
            reg = {'bull': 'bear' if u < .30 else 'range', 'bear': 'bull' if u < .40 else 'range',
                   'range': 'bull' if u < .45 else 'bear'}[reg]           # market.regime.to* (no valuation or macro tilt)
        om = sbar ** 2 * vm[reg] ** 2 * (1 - a - gm / 2 - b)
        h = clamp(om + (a + (gm if e > 0 else 0)) * e * e + b * h, 0.008 ** 2, 0.065 ** 2)   # sigmaMin/MaxWeekly
        n = [rng.gauss(0, 1) for _ in range(6)]
        z = n[0] / math.sqrt(sum(x * x for x in n[1:]) / 5) * math.sqrt(3 / 5)              # market.tDof 5
        e = math.sqrt(h) * z
        J = 0.0
        if rng.random() < 0.025:                                         # market.jump.probWeekly
            size = min(0.15, (0.02 - 0.015 * math.log(1 - rng.random())) * vol)   # jump.sizeBase / sizeExpMean / sizeCap
            up = rng.random() < {'bull': .6, 'range': .5, 'bear': .4}[reg]
            J = size if up else -size
        S *= math.exp(mu[reg] / 52 + e + J)
        out.append(S)
    return out


def diesel_path(rng, weeks=104):
    dev = 0.0
    out = []
    for t in range(weeks):
        spike = rng.uniform(0.12, 0.30) if rng.random() < 0.005 else 0.0
        glut = rng.uniform(0.10, 0.30) if rng.random() < 0.005 else 0.0
        dev = clamp(0.98 * dev + 0.030 * rng.gauss(0, 1) + spike - glut, math.log(0.5), math.log(2.5))
        out.append(DIESEL_RACK * (1.03 ** (t / 52)) * math.exp(dev))     # §10 market.diesel.* AR(1) on a CPI-escalating anchor
    return out


EST_SD = {'tested': (0.18, 0.45), 'light': (0.30, 0.65), 'pits3': (0.40, 0.80), 'screen': (0.60, 0.90)}


def block_estimates(claim, rng, mode, geo=False):
    """Player's block grade estimates (§4 replaced by calibrated lognormal noise). 'tested' = §4 `indicated` (≈ 15 five-yard
    pits, §4 geology.confIndicatedMinProcessedBcy 75: claim sd 0.18, block 0.45, as §4.9's worked example); 'light' = `inferred`
    (6 pits); 'pits3' = 3 pits; 'screen' = records + site visit. geo: owner-geologist records quality 0.9 vs 0.6 (§1 1.7),
    modeled as screen noise × 0.75 (this model's stand-in)."""
    blocks = claim['blocks']
    sc, sb = EST_SD[mode]
    if mode == 'screen' and geo:
        sc, sb = sc * 0.75, sb * 0.9
    ec = rng.gauss(-0.03 if mode != 'screen' else 0.0, sc)
    return [b['g'] * math.exp(ec + rng.gauss(0, sb if (b['f'] >= 0.2 or mode != 'tested') else 0.7)) for b in blocks]


def seller_estimates(listing, rng):
    """Untested buyer believes the seller's grade on the blocks it guesses are paystreak (true f + noise)."""
    claim = listing['claim']
    g = listing['claimed'] or TEMPLATES[claim['tpl']]['gMed']
    n = max(1, int(sum(1 for b in claim['blocks'] if b['f'] >= 0.4 and not b['mined']) *
                   {'accurate': 1, 'optimistic': 1.2, 'cherryPicked': 1, 'fraudulent': 1.5}[listing['hon']]))
    order = sorted(range(len(claim['blocks'])), key=lambda i: -(claim['blocks'][i]['f'] + rng.gauss(0, 0.5)))
    est = [TEMPLATES[claim['tpl']]['gMed'] * 0.1] * len(claim['blocks'])
    for i in order[:n]:
        est[i] = g
    return est


PERMIT_STUB = dict(minLastSeasonYear=2010, planP=0.50, noticeP=0.20)   # §3 geology.permitStub.minLastSeasonYear / planP / noticeP


def make_world(rng, n_districts):
    pools = {}
    for tn in ('north', 'arid'):
        cl = []
        for d in range(n_districts):
            cl += gen_district(tn, rng)
        for c in cl:
            c['cls'] = ref_economics(c)[0]
        held = [c for c in cl if c['held']]
        w = [listing_weight(c['cls']) for c in held]
        pools[tn] = (held, w, cl)
    return pools


def starter_candidates(pools, tn):
    """§3 3.11 starter permitted lease: a held parcel whose stub is planApproved; else the recentCat parcel with the latest
    last season; else a held valley parcel. Ground quality is not conditioned."""
    held = pools[tn][0]
    c1 = [c for c in held if c.get('permit') == 'plan']
    if c1:
        return c1
    c2 = sorted([c for c in held if c['oldTimer'] == 'recentCat' and c.get('lastSeason')], key=lambda c: -c['lastSeason'])
    return c2[:5] if c2 else [c for c in held if c['dep'] in ('creek', 'fan', 'gulch')]


HONESTY_BY_DIFF = {'easy': {'accurate': .55, 'optimistic': .30, 'cherryPicked': .12, 'fraudulent': .03},
                   'standard': HONESTY_STD,
                   'hard': {'accurate': .20, 'optimistic': .35, 'cherryPicked': .30, 'fraudulent': .15}}   # §1 1.11
# §1 1.11 knobs used here: game.startCompanyCashMult / startPersonalCashMult, finance.p1InsolvencyGraceWeeks,
# game.season.freezeUpMeanShift / sigmaMult, game.inheritorDebtMult, land.askMarkup, land.resMotivationDisc
DIFF = {'easy': dict(cash=1.25, personal=1.1, grace=8, freeze=0.5, sigma=0.8, inhDebt=0.75, markup=0.25, resDisc=0.45),
        'standard': dict(cash=1.0, personal=1.0, grace=6, freeze=0.0, sigma=1.0, inhDebt=1.0, markup=0.30, resDisc=0.35),
        'hard': dict(cash=0.85, personal=0.9, grace=4, freeze=-0.5, sigma=1.2, inhDebt=1.25, markup=0.35, resDisc=0.25)}


def draw_listings(pools, rng, n=20, arid_share=0.45, difficulty='standard', full=False):
    out = []
    dk = DIFF[difficulty]
    for _ in range(n):
        tn = 'arid' if rng.random() < arid_share else 'north'
        held, w, _ = pools[tn]
        c = rng.choices(held, weights=w)[0]
        out.append(make_listing(c, rng, HONESTY_BY_DIFF[difficulty], full, False, dk['markup'], dk['resDisc']))
    return out


START = {   # §1 1.8 start types (standard difficulty): company cash, personal cash, owner capital (Backed)
    'bootstrapper': dict(cash=400000, personal=120000),              # game.start.bootstrapper.companyCashUsd
    'backed': dict(cash=1500000, personal=50000, owner=200000),      # $200k owner + game.investor.equityContributionUsd 1.3M
    'backedRoyalty': dict(cash=1100000, personal=50000, owner=200000),   # $200k owner + royaltyContributionUsd 0.9M
    'inheritor': dict(cash=250000, personal=40000),                  # game.start.inheritor.companyCashUsd
}
INH_NOTE = 320000.0          # §1 1.8.2 estate note ($320k, 8.5 %, 84 mo, game.inheritor.noteSchedule 'seasonal')
INH_AP = 12000.0             # §1 1.8.2 fuel AP due week 4
INH_APPRAISAL = 120000.0     # §1 1.8.2 estate appraisal (claims' cost basis)
INH_NOTE_SCHEDULE = 'seasonal'
INH_PRESTRIP = 2             # §1 game.inheritor.preStrippedBlocks
INH_TIERS = {'excellent': .07, 'good': .30, 'marginal': .38, 'uneconomic': .25}   # §1 game.inheritorTierWeights


def owner_nw0(start, dk, full):
    """§1 1.8 owner net worth at start (× difficulty multipliers)."""
    S = START[start]
    if start == 'bootstrapper':
        return S['cash'] * dk['cash'] + S['personal'] * dk['personal']
    if start.startswith('backed'):
        return S['owner'] * dk['cash'] + S['personal'] * dk['personal']
    fleet_v = sum(INHERITED_RESALE.values())
    nw = S['cash'] * dk['cash'] + fleet_v + INH_APPRAISAL - INH_NOTE * dk['inhDebt'] - INH_AP + S['personal'] * dk['personal']
    if full:
        nw += 6000 - 8 * 6000                    # P2+: + $6k family cash bond − ARO on ≈ 8 open acres at ≈ $6k/acre (§1 1.8)
    return nw


def owner_share(start, company_nw, dk, years_elapsed, fin):
    """§1 1.8.1 / 1.13: owner's share of company NW. Backed equity: equity waterfall, non-participating 1× preference plus the
    8 % cumulative pref from year 2 (bots pay none); Backed royalty: the unpaid investor contribution is deferred revenue."""
    if start == 'backed':
        contrib = 1300000 * dk['cash']
        pref_unpaid = 0.08 * contrib * max(0, years_elapsed - 1)
        cnw = max(0.0, company_nw)
        claim = min(cnw, max(contrib + pref_unpaid, 0.40 * cnw))
        return company_nw - claim
    if start == 'backedRoyalty':
        return company_nw - max(0.0, fin.inv_contrib - fin.inv_roy_paid)
    return company_nw


def fleet_for(kind, district):
    """Fleets for the Monte Carlo bots (§2.12.1). Grades: cautious buys B–C, except the starter tier's excavator, dozer and
    plant, which are grade D because B–C would break its 60 % iron cap on a Bootstrapper (BALANCE 4.1)."""
    if kind == 'mini':
        if district == 'north':
            return fleet([('ex30', 'dig', 'D'), ('dz6', 'strip', 'D', 50, True), ('tr50', 'plant', 'D'), ('pmp6', 'water', 'C'),
                          ('campT8', 'site', 'C'), ('pickup', 'site', 'D')]), dict(direct_feed=True, haul_blocks=1, laborers=1)
        return fleet([('ex30', 'dig', 'D'), ('dz6', 'strip', 'D'), ('tr50', 'plant', 'C'), ('cenM', 'plant', 'C'),
                      ('gen100', 'power', 'C'), ('pmp6', 'water', 'C'), ('campT8', 'site', 'C'), ('pickup', 'site', 'D')]), \
            dict(direct_feed=True, haul_blocks=1, laborers=1)
    if kind == 'undercap':   # §2.12.1 undercap: cheapest fleet that can wash, grade D, excavator-direct starter
        return fleet([('ex30', 'dig', 'D'), ('dz6', 'strip', 'D'), ('tr50', 'plant', 'D'), ('pmp6', 'water', 'D'),
                      ('campT8', 'site', 'D'), ('pickup', 'site', 'D')]), dict(direct_feed=True, haul_blocks=1, laborers=1)
    if kind == 'ref':        # reference-size fleet, all used grade C (cautious B–C rule)
        return fleet([('ex30', 'dig', 'C'), ('dz8', 'strip', 'C'), ('ld966', 'feed', 'C'), ('adt30', 'haul', 'C'),
                      ('tr75', 'plant', 'C'), ('pmp6', 'water', 'C'), ('pmp6', 'water', 'C'), ('campT8', 'site', 'C'),
                      ('pickup', 'site', 'C')]), dict(haul_blocks=3, laborers=1)
    if kind == 'mid':
        return fleet([('ex30', 'dig', 'C'), ('dz8', 'strip', 'D'), ('ld950', 'feed', 'D'), ('adt30', 'haul', 'D'),
                      ('tr75', 'plant', 'C'), ('pmp6', 'water', 'C'), ('pmp6', 'water', 'C'), ('campT8', 'site', 'C'),
                      ('pickup', 'site', 'D')]), dict(haul_blocks=3, laborers=1)
    if kind == 'midB2':      # aggressive Bootstrapper: mid fleet + a second truck
        return fleet([('ex30', 'dig', 'C'), ('dz8', 'strip', 'D'), ('ld950', 'feed', 'D'), ('adt30', 'haul', 'D'), ('adt30', 'haul', 'D'),
                      ('tr75', 'plant', 'C'), ('pmp6', 'water', 'C'), ('pmp6', 'water', 'C'), ('campT8', 'site', 'C'),
                      ('pickup', 'site', 'D')]), dict(haul_blocks=3, laborers=1)
    if kind == 'refB2':      # aggressive: reference fleet (new plant, pumps, camp) + a second truck
        return fleet([('ex30', 'dig', 'C'), ('dz8', 'strip', 'C'), ('ld966', 'feed', 'C'), ('adt30', 'haul', 'C'), ('adt30', 'haul', 'D'),
                      ('tr75', 'plant', 'N'), ('pmp6', 'water', 'N'), ('pmp6', 'water', 'N'), ('campT8', 'site', 'N'),
                      ('pickup', 'site', 'C')]), dict(haul_blocks=3, laborers=1)
    if kind == 'inherit':
        return ref_inheritor().machines, dict(haul_blocks=2, laborers=1)
    raise ValueError(kind)


def build_op(kind, claim, sched=None):
    district = claim['tpl']
    ms, kw = fleet_for(kind, district)
    water = claim['water']['base']
    op = Op(kind, district, ms, days=6, hours=11 if district == 'north' else 10, foreman_skill=40, plant_skill=55,
            access=claim['access'], dist_mi=claim['distMi'], water_gpm=water, well_gpm=0.0, **kw)
    if sched:
        for k, v in sched.items():
            setattr(op, k, v)
    return op


def arid_trucks(op, well):
    """Bot rule (this model): one water truck only when the well alone cannot hold 20 bcy/hr (BALANCE 5.2's going-concern
    rate). A truck adds ≈ 13.5 bcy/hr for $1,400/day (§7 ops.waterTruckDayRateUsd), ≈ $10 per extra bcy, which does not pay
    on typical arid ground (§7 7.6.6, ops.makeupFrac.arid)."""
    if op.district != 'arid' or op.plant is None:
        return 0
    q = 15 * 1.25 * 1.4 * (1.1 if op.conc else 1.0)
    rate = well / ARID_MAKEUP / q
    return 1 if rate < 20 else 0


LIQ_THRESHOLD = 60000   # cautious bot (reduced exit rule): at year end sells idle iron if cash + personal < this; re-enters above it
ECON = {}               # (kind, district) -> EconTest
DRAWDOWN = {}           # (kind, weeks) -> projected 13-week net drawdown


def deplete_more(b, delta, w=(1.3, 1.1, 0.7, 0.3)):
    """§3 3.6 second depletion: x' = min(0.92, x + Δ), applied as deplete(b, (x' − x)/(1 − x)) on the current mix."""
    x0 = b.get('mof', 0.0)
    x1 = min(0.92, x0 + delta)
    if x1 <= x0:
        return
    gv = b['gv']
    deplete(b, (x1 - x0) / (1 - x0), w)
    b['g'] = gv * (1 - x1)
    b['mof'] = x1


def inheritor_ground(rng, pools, prestrip=INH_PRESTRIP, tiers=INH_TIERS):
    """§3 3.6.1 genInheritedGroup (reduced: three 20-ac creek parcels drawn from the generated north pool)."""
    tier = rng.pick(tiers)
    target = {'uneconomic': -75e3, 'marginal': 300e3, 'good': 1.2e6, 'excellent': 4.0e6}[tier]
    floor = {'good': 0.40, 'excellent': 0.60}.get(tier, 0.0)
    # the reserved run: three held 20-ac valley (creek) parcels with paystreak (this model draws them from the held pool)
    north = [c for c in pools['north'][0] if c['acres'] == 20 and c['dep'] == 'creek' and any(b['f'] >= 0.4 for b in c['blocks'])]
    parts = [rng.choice(north) for _ in range(3)]
    blocks = []
    for c in parts:
        for b in c['blocks']:
            nb = dict(b)
            nb['mined'] = False
            nb.pop('preStripped', None)
            blocks.append(nb)
    # family mining 2013-2024: each season digs LN(6,000, 0.5) bcy from the best remaining paystreak block (partial blocks allowed)
    dug_idx = set()
    for season in range(12):
        v = rng.ln(6000, 0.5)
        while v > 1:
            ps = [b for b in blocks if b['f'] >= 0.4 and not b['mined']]
            if not ps:
                break
            b = max(ps, key=lambda x: x['g'])
            dug_idx.add(id(b))
            rem = (b['T'] + b['B']) * BCY_PER_ACRE_FT * b.get('areaFrac', 1.0)
            if v >= rem:
                b['mined'] = True
                v -= rem
            else:
                b['areaFrac'] = b.get('areaFrac', 1.0) * (1 - v / rem)
                v = 0
    # game.inheritorDepletionAdd 0.10 on undug f >= 0.4 blocks (handCut weights)
    for b in blocks:
        if b['f'] >= 0.4 and id(b) not in dug_idx and not b['mined']:
            deplete_more(b, 0.10)
    # game.inheritor.preStrippedBlocks: the best undug f >= 0.4 blocks by current grade, thawProgress U(3, 6) ft
    cand = sorted([b for b in blocks if b['f'] >= 0.4 and id(b) not in dug_idx and not b['mined']], key=lambda b: -b['g'])
    for b in cand[:prestrip]:
        b['preStripped'] = True
        b['thaw0'] = rng.uniform(3.0, 6.0)
    claim = dict(tpl='north', dep='creek', setting='midReach', acres=60, blocks=blocks, held=True, oldTimer='family',
                 access=parts[0]['access'], distMi=parts[0]['distMi'], water=parts[0]['water'], coarseMg=150, permit='plan')
    base = [(b['g'], b['gv']) for b in blocks]

    def setk(k):
        for b, (g0, gv0) in zip(blocks, base):
            b['g'], b['gv'] = g0 * k, gv0 * k
        return ref_economics(claim)

    if setk(1.0)[0] != tier:
        lo, hi = 0.25, 4.0
        for _ in range(16):
            k = math.sqrt(lo * hi)
            if setk(k)[1] < target:
                lo = k
            else:
                hi = k
        k = hi
        if floor > 0 and setk(k)[2] < floor and k < 4.0:              # smallest k meeting both the CDV target and the margin floor
            lo2, hi2 = k, 4.0                                           # k stays in §3's [0.25, 4]
            for _ in range(16):
                k2 = math.sqrt(lo2 * hi2)
                if setk(k2)[2] < floor:
                    lo2 = k2
                else:
                    hi2 = k2
            k = hi2
        setk(k)
    claim['tier'] = tier
    return claim


def econ_for(kind, district):
    key = (kind, district)
    if key in ECON:
        return ECON[key]
    if district == 'north':
        extra, T, B = None, 5.0, 1.5
    else:
        extra, T, B = dict(clay=0.25, bould=0.10, mix=(.10, .30, .40, .20), fin=0.78, cem=0.3, lg=3.0, sb=0.12), 4.0, 0.7

    def fn():
        cl = dict(tpl=district, access='seasonalRoad', distMi=60 if district == 'north' else 25,
                  water=dict(base=600.0 if district == 'north' else 0.0, well=ARID_MEDIAN_WELL, depth=180.0))
        op = build_op(kind if kind != 'inherit' else 'inherit', cl)
        if district == 'arid':
            op.well_gpm = ARID_MEDIAN_WELL
            op.water_trucks = arid_trucks(op, ARID_MEDIAN_WELL)
        return op
    tab = op_unit_table(fn, kind, extra, T=T, B=B, srs=(0.5, 1, 2, 3, 4, 6, 8, 10), perms=(0.0, 0.8) if district == 'north' else (0.0, 0.01), years=(2,))
    ECON[key] = EconTest(f'{kind}/{district}', fn, tab, royalty=0.10 if district == 'north' else 0.06, netback=0.87,
                         conc_share=(35 / 50 if district == 'arid' and kind == 'mini' else 0.0), prep='trommel', district=district)
    op = fn()
    # projected season maintenance and season length for the mechanic rule (year 2 at SR 3, frozen north)
    k3 = (2, 0.8 if district == 'north' else 0.0, 3)
    ECON[key].maint = ECON[key].tab[k3].get('maint', 0.0)
    ECON[key].weeks = ECON[key].tab[k3].get('weeks', 24)
    ECON[key].op_proto = op
    return ECON[key]


def mechanic_pays(kind, district, rules='p1'):
    """§2.12.1 cautious: hires a mechanic when projected maintenance > $120k a season. With P1-P2 flat maintenance a mechanic
    only saves fleet.p1InHouseMaintMult's 30 % (§9 9.16), so this model hires only when that saving exceeds the mechanic's
    season wages (BALANCE 4.1 refinement). The FULL rules here have no P3 breakdowns, so the same test applies."""
    e = econ_for(kind, district)
    op = e.op_proto
    wk_wage = weekly_gross(wage_rate('mechanic', district, op.access), op.days * op.hours) * BURDEN_P1
    return 0.30 * e.maint > wk_wage * e.weeks


def projected_drawdown(kind, weeks):
    """The bot's own season projection (§2.12.1 cashPlan): the largest cumulative net cash outflow over the first `weeks`
    weeks of a first (frozen, unstripped) season on the north reference claim, local buyer. Used for the reserve rule."""
    key = (kind, weeks)
    if key in DRAWDOWN:
        return DRAWDOWN[key]
    cl = dict(tpl='north', access='seasonalRoad', distMi=60, water=dict(base=600.0, well=0, depth=0))
    op = build_op(kind, cl)
    out, fin, site = run_ref(op, REF_CLAIM_N, years=1, n_blocks=40)
    recs = out[0][0]
    started = [r for r in recs if r['opex'] > 0]
    cum, worst = 0.0, 0.0
    if started:
        i0 = recs.index(started[0])
        for r in recs[i0:i0 + weeks]:
            cum += r['rev'] - r['opex']
            worst = min(worst, cum)
    DRAWDOWN[key] = -worst
    return -worst


def mining_order(claim, est, econ, royalty, sunk=False):
    margins = econ.evaluate(claim, est, royalty=royalty, per_block=True, sunk=sunk)
    pos = sorted([(m, i) for i, m in margins if m > 0], reverse=True)
    return [i for m, i in pos]


BOT_RULES = {   # §2.12.1 (BALANCE 4): iron cap (share of liquidity), reserve weeks, pits per tested listing, listings screened / tested
    'careful': dict(cap=0.60, reserve=13, pits=15, screen=6, test=2, mode='tested'),
    'carefulNoTest': dict(cap=0.60, reserve=13, pits=0, screen=0, test=0, mode=None),
    'balanced': dict(cap=0.75, reserve=8, pits=6, screen=4, test=1, mode='light'),
}


def play(strat, start, rules, rng, pools, years=2, difficulty='standard', background='none', inh=None):
    """One seeded game for one bot. rules: 'p1' (flat price, local buyer, cash only, no permits, no wear) or 'full'
    (P5-like: regime price, refinery, P2 permitting delay on raw ground, P3 availability, P4 insurance, G&A and financing)."""
    full = rules == 'full'
    dk = DIFF[difficulty]
    inh = inh or {}
    S = dict(START[start])
    if start == 'inheritor' and 'cash' in inh:
        S['cash'] = inh['cash']
    S['cash'] *= dk['cash']
    S['personal'] *= dk['personal']
    fin = Fin(S['cash'], S['personal'], phase=5 if full else 1, grace=dk['grace'])
    if background == 'banker':
        fin.loan(150000, 0.09, 60, 'bankerStub')                       # §1 1.7 banker P1 stub: $150k, 9 %, 60 mo ($3,113.75/mo)
    if start == 'backedRoyalty':
        fin.inv_roy, fin.inv_contrib = 0.10, 900000 * dk['cash']        # game.investor.royaltyRate / royaltyContributionUsd
    prices = price_path(rng, 52 * years) if full else None
    diesels = diesel_path(rng, 52 * years) if full else None
    careful_like = strat in ('careful', 'balanced', 'carefulNoTest')
    br = BOT_RULES.get(strat, {})
    policy = dict(inject=True, stop_if_losing=careful_like, sellAt=dk['grace'] - 1)   # last-resort dealer sale before bankruptcy
    out = dict(strat=strat, start=start, rules=rules, survived=True, mined=[False] * years, ni=[0.0] * years,
               opm=[0.0] * years, nwy=[0.0] * years, district=None, cls=None, oz=0.0, explore=0.0, injected=0.0,
               bankruptYear=None, fleetBought=False, claimFound=False, seasons=[], claims=[], fleetSold=False)
    cals = {d: [make_year(d, rng, sigma=dk['sigma'], freeze_shift=dk['freeze']) for _ in range(years)] for d in ('north', 'arid')}
    st = dict(op=None, site=None, claim=None, royalty=0.0, dep_w=0.0, auth=0, assets=0.0, stood=False,
              kind=op_kind(strat, start, full), crec=None, acq=0.0)
    landman = background == 'landman'
    geo = background == 'geologist'
    liquid = S['cash'] + S['personal']
    if careful_like and start != 'inheritor':
        # §2.12.1 fleet policy: largest tier with iron <= cap × liquidity and iron + moves + the reserve (projected net outflow
        # over the reserve window, BALANCE 4.1) <= liquidity
        for k in (['ref', 'mid', 'mini'] if start.startswith('backed') else ['mid', 'mini']):
            ms, _ = fleet_for(k, 'north')
            iron = sum(price_of(m) for m in ms)
            if (iron <= br['cap'] * liquid and iron + 60000 + projected_drawdown(k, br['reserve']) <= liquid) or k == 'mini':
                st['kind'] = k
                break
    if strat == 'aggressive':
        # §2.12.1 aggressive: 1.3 × sizeFleet plus a second truck, reserve 4 weeks; this model: the largest tier whose iron, moves
        # and 4-week projected net outflow fit liquidity (+ the $250k equipment-finance startup cap under FULL rules)
        for k in ('refB2', 'midB2', 'mini'):
            iron = sum(price_of(m) for m in fleet_for(k, 'north')[0])
            if iron + 60000 + projected_drawdown(k, 4) <= liquid + (250000 if full else 0) or k == 'mini':
                st['kind'] = k
                break

    def new_claim_rec(L, price, explore):
        rec = dict(acq=price, explore=explore, rev=0.0, opex=0.0, cashRoy=0.0, holding=0.0, capital=0.0, acres=2.0,
                   purchased=not L['lease'], price=price, payTot=None, payLeft=None)
        out['claims'].append(rec)
        return rec

    def pick_claim(year_idx):
        listings = draw_listings(pools, rng, 20, difficulty=difficulty, full=full)
        if full and year_idx == 0:
            for tn in ('north', 'arid'):                                # §3 3.11 starter permitted lease per starting district (P2+)
                c = rng.choice(starter_candidates(pools, tn))
                listings.append(make_listing(c, rng, HONESTY_BY_DIFF[difficulty], True, True, dk['markup'], dk['resDisc']))
        if landman:                                                     # §1 1.7 landman P1-P4 stub
            for L in listings:
                L['ask'] *= 0.925
                L['res'] *= 0.925
                L['roy'] = max(0.01, L['roy'] - 0.01)
        kind = st['kind']
        cash = fin.cash

        def authorized(L):                                              # P2+: records check reveals the true tier
            return L['trueAuth'] == 'plan'
        if strat in ('careful', 'balanced'):
            ok = [L for L in listings if (L['lease'] or L['ask'] <= (0.35 * cash if full else 25000))
                  and not (L['claim']['tpl'] == 'north' and L['claim']['access'] in ('winterTrail', 'flyIn'))]
            if full:
                for L in ok:
                    fin.spend('explore', RECORDS_CHECK_USD)
            ok.sort(key=lambda L: -((L['claimedOz'] if L['claimed'] else 0) + (1e6 if full and authorized(L) else 0)))
            screened = []
            for L in ok[:br['screen']]:
                fin.spend('explore', RECORDS_REVIEW_USD + SITE_VISIT_USD[L['claim']['access']])
                e = econ_for(kind, L['claim']['tpl'])
                est = block_estimates(L['claim'], rng, 'screen', geo)
                acq = L['amr'] * 3 if L['lease'] else max(L['res'], 0.8 * L['ask'])
                v = e.evaluate(L['claim'], est, royalty=L['roy'] if L['lease'] else 0.0)[1] - acq
                screened.append((v + (1e6 if full and authorized(L) else 0), v, L))
            screened = [x for x in screened if x[1] > 0]
            screened.sort(key=lambda x: -x[0])
            for _, v, L in screened[:br['test']]:
                e = econ_for(kind, L['claim']['tpl'])
                price = max(L['res'], 0.8 * L['ask'])                   # negotiated (§5 target 75-85 % of ask)
                if not full:                                            # P1: lease-then-test, or buy cheap ground then test
                    fin.spend('amr' if L['lease'] else 'land', L['amr'] if L['lease'] else price)
                _, mob = access_factors(L['claim']['access'], L['claim']['distMi'])
                tcost = br['pits'] * OWN_PIT_USD + PIT_MOB_USD * mob
                fin.spend('explore', tcost)
                est = block_estimates(L['claim'], rng, br['mode'])
                roy = L['roy'] if L['lease'] else 0.0
                acq = (L['amr'] if L['lease'] else price) if full else 0.0
                if e.evaluate(L['claim'], est, royalty=roy)[1] - acq > 0:
                    if full:
                        fin.spend('amr' if L['lease'] else 'land', L['amr'] if L['lease'] else price)
                    if not L['lease']:
                        st['assets'] += price
                    st['royalty'] = roy
                    if L['lease']:
                        fin.amr, fin.amr_week = L['amr'], 4
                    st['crec'] = new_claim_rec(L, L['amr'] if L['lease'] else price, tcost)
                    return L, est
            return None, None
        if strat == 'carefulNoTest':                                    # §2.12.1 noTest: seller evidence, records, site visits only
            best = None
            for L in [L for L in listings if L['lease'] or L['ask'] <= 0.35 * cash]:
                e = econ_for(kind, L['claim']['tpl'])
                est = seller_estimates(L, rng)
                roy = L['roy'] if L['lease'] else 0.0
                acq = L['amr'] * 3 if L['lease'] else max(L['res'], 0.8 * L['ask'])
                v = e.evaluate(L['claim'], est, royalty=roy)[1] - acq + (1e6 if full and authorized(L) else 0)
                if best is None or v > best[0]:
                    best = (v, L, est)
            if best and best[0] > 0:
                L = best[1]
                if L['lease']:
                    fin.spend('amr', L['amr'])
                    fin.amr, fin.amr_week = L['amr'], 4
                    st['royalty'] = L['roy']
                    st['crec'] = new_claim_rec(L, L['amr'], 0.0)
                else:
                    price = max(L['res'], 0.8 * L['ask'])
                    fin.spend('land', price)
                    st['assets'] += price
                    st['royalty'] = 0.0
                    st['crec'] = new_claim_rec(L, price, 0.0)
                return L, best[2]
            return None, None
        cand = [L for L in listings if L['claimed']]
        if strat == 'aggressive':                                       # §2.12.1: seller evidence + ≤ 3 pits on each of the top 3
            fleet_need = (sum(price_of(m) for m in fleet_for(st['kind'], 'north')[0]) if st['op'] is None else 0.0) + 150000
            cand = [L for L in cand if L['lease'] or L['ask'] <= fin.cash + fin.personal - fleet_need]   # what it can afford
            cand.sort(key=lambda L: -(L['claimedOz'] + (1e7 if full and L['auth'] == 'plan' else 0)))
            best = None
            for L in cand[:3]:                                          # largest claimed first; the light test only vetoes
                _, mob = access_factors(L['claim']['access'], L['claim']['distMi'])
                fin.spend('explore', RECORDS_REVIEW_USD + 3 * OWN_PIT_USD + PIT_MOB_USD * mob)
                e = econ_for(st['kind'], L['claim']['tpl'])
                est = block_estimates(L['claim'], rng, 'pits3')
                buy = L['ask'] <= fin.cash + fin.personal - fleet_need
                roy = 0.0 if buy else L['roy']
                v = e.evaluate(L['claim'], est, royalty=roy)[1] - (L['ask'] if buy else 3 * L['amr'])
                if v > -250000:
                    best = (v, L, est, buy)
                    break
                if best is None or v > best[0]:
                    best = (v, L, est, buy)
            if best is not None:
                v, L, est, buy = best
                if buy:
                    fin.spend('land', L['ask'])                         # pays the ask (no haggling)
                    st['assets'] += L['ask']
                    st['royalty'] = 0.0
                    st['crec'] = new_claim_rec(dict(L, lease=False), L['ask'], 0.0)
                elif L['lease']:
                    fin.spend('amr', L['amr'])
                    fin.amr, fin.amr_week = L['amr'], 4
                    st['royalty'] = L['roy']
                    st['crec'] = new_claim_rec(L, L['amr'], 0.0)
                else:
                    return None, None
                return L, est
            return None, None
        # undercap (§2.12.1): seller evidence and records only; best claimed ounces per asking dollar
        cand.sort(key=lambda L: -(L['claimedOz'] / max(L['ask'], 5000) + (1e3 if full and L['auth'] == 'plan' else 0)))
        for L in cand:
            if L['ask'] <= 0.5 * fin.cash:
                fin.spend('land', L['ask'])
                st['assets'] += L['ask']
                st['royalty'] = 0.0
                st['crec'] = new_claim_rec(dict(L, lease=False), L['ask'], 0.0)
            elif L['lease']:
                fin.spend('amr', L['amr'])
                fin.amr, fin.amr_week = L['amr'], 4
                st['royalty'] = L['roy']
                st['crec'] = new_claim_rec(L, L['amr'], 0.0)
            else:
                continue
            return L, seller_estimates(L, rng)
        return None, None

    def buy_fleet(claim):
        kind = st['kind']
        sch = {'days': 7, 'hours': 12, 'feed_phi': 1.15} if strat == 'aggressive' else ({'strip_ahead': 2} if careful_like else None)
        op = build_op(kind, claim, sch)
        if background == 'operator':
            op.foreman_skill = 85                                       # §8 staff.ownerOpsSkillByBackground (owner as foreman)
        if background in ('mechanic', 'mechanic80'):
            op.owner_shop_mult = 0.70 if background == 'mechanic' else 0.80   # §9 fleet.p1OwnerShopMaintMult (0.80 = EC-11 fallback)
        if careful_like and mechanic_pays(kind, claim['tpl']):
            op.mechanic = True
        if start == 'inheritor':
            st['op'] = op
            return
        prices_ = [price_of(m) for m in op.machines]
        fin_amt = 0.0
        if full and strat in ('undercap', 'aggressive'):
            fin_amt = min(250000.0, 0.64 * op.fleet_value())            # §11 finance.startupCapUsd; Northline C: 0.80 × OLV (0.80 × resale)
            fin.loan(fin_amt, 0.19, 48)                                 # prime 7 + C spread 9 + used 2 + mining 1; C term 48 mo
        fin.spend('capex', sum(prices_))
        fin.spend('mobilization', transport_cost([m.model for m in op.machines], claim['access'], claim['distMi']))
        st['dep_w'] = book_dep_per_week(op, prices_)
        if full and strat in ('undercap', 'aggressive'):                # §2.12.1: hard money when short (cautious: never)
            # §11 11.6 hard money 0.60 × OLV (0.48 × resale) of the machines not under the equipment loan's PMSI
            fin.hard_money_cap = 0.48 * max(0.0, op.fleet_value() - fin_amt / 0.64)
        st['op'] = op
        out['fleetBought'] = True

    def site_up(L, est, year_idx):
        claim = L['claim']
        st['claim'] = claim
        out['claimFound'] = True
        kind = st['kind']
        if careful_like or start == 'inheritor' or strat == 'aggressive':
            order = mining_order(claim, est, econ_for(kind, claim['tpl']), st['royalty'], sunk=(start == 'inheritor'))
        else:
            order = sorted(range(len(claim['blocks'])), key=lambda i: -est[i])
            order = [i for i in order if est[i] > 0.5 * TEMPLATES[claim['tpl']]['gMed']]
        order = [i for i in order if not claim['blocks'][i]['mined']]
        st['site'] = Site([claim['blocks'][i] for i in order]) if order else None
        if st['site'] is not None and st['crec'] is not None:
            st['crec']['payTot'] = st['site'].remaining_pay()
        out['district'] = claim['tpl']
        out['cls'] = claim.get('tier', claim.get('cls'))
        st['auth'] = year_idx * 52
        if full and not L.get('family'):
            if L['trueAuth'] != 'plan':
                fin.spend('permits', PLAN_PREP_USD)                     # §6 fed.plan fee + direct + baseline
                fin.spend('bondPrem', SURETY_C[0] * PLAN_BOND_FACE)     # surety tier C premium
                fin.spend('bondColl', SURETY_C[1] * PLAN_BOND_FACE)     # collateral → restricted cash
                st['assets'] += SURETY_C[1] * PLAN_BOND_FACE
                # §6 6.5: prep 20 weeks; submission → decision median ≈ 40 weeks, P10-P90 ≈ 5-20 months
                st['auth'] = year_idx * 52 + PLAN_PREP_WEEKS + int(clamp(40 * rng.ln(1, 0.6), 12, 104))
            elif L.get('starter'):
                st['auth'] = year_idx * 52 + 4                          # §6 6.12 starter lease transfer ≤ 4 weeks
            else:
                st['auth'] = year_idx * 52 + 3                          # transfer on closing (§6 6.12)
        elif full and L.get('family'):
            fin.spend('bondColl', 30000)                                # §1 1.8.2 under-bonded plan: top-up before mechanized work
            st['assets'] += 30000

    # ---------------- Inheritor setup (§1 1.8.2)
    if start == 'inheritor':
        claim = inheritor_ground(rng, pools, inh.get('prestrip', INH_PRESTRIP), inh.get('tiers', INH_TIERS))
        out['inhClass'] = ref_economics(claim)[0]
        sched = inh.get('note', INH_NOTE_SCHEDULE)
        fin.loan(INH_NOTE * dk['inhDebt'], 0.085, 84, 'estate', seasonal=(sched == 'seasonal'), proceeds=0.0)
        fin.spend('ap', INH_AP)                                         # due week 4 (booked week 1 here)
        _, mob = access_factors(claim['access'], claim['distMi'])
        tcost = (15 if strat == 'careful' else 6) * OWN_PIT_USD
        fin.spend('explore', tcost)                                     # own-excavator pit grid on family ground
        est = block_estimates(claim, rng, 'tested' if strat == 'careful' else 'light')
        buy_fleet(claim)
        st['assets'] += INH_APPRAISAL
        st['crec'] = new_claim_rec(dict(lease=False), 0.0, tcost)
        site_up(dict(claim=claim, trueAuth='plan', family=True), est, 0)
        if st['site'] is None:
            st['stood'] = True                                          # nothing worth mining at home: look at the market
        out['cls'] = claim['tier']
    for y in range(years):
        if fin.bankrupt:
            break
        led0 = dict(fin.ledger) if y > 0 else {}                       # year 1 includes setup spending (Inheritor pits, AP)
        site = st['site']
        # §2.12.1 cautious exit rule: re-enters when cash >= fleet cost + reserve (projected net outflow over the reserve window)
        reserve = projected_drawdown(st['kind'], br['reserve']) if careful_like else 0.0
        need = (sum(price_of(m) for m in fleet_for(st['kind'], 'north')[0]) if st['op'] is None else 0.0) + reserve + 60000
        can_enter = (not careful_like) or y == 0 or (fin.cash + fin.personal >= need)
        if can_enter and (site is None or site.remaining_pay() < 5000 or st['stood']):
            L, est = pick_claim(y)
            st['stood'] = False
            if L is not None:
                site_up(L, est, y)
                if st['op'] is not None:                                # move the fleet it already owns (§9 9.5)
                    fin.spend('mobilization', transport_cost([m.model for m in st['op'].machines], L['claim']['access'],
                                                             L['claim']['distMi']))
                    if start == 'inheritor':
                        st['moved'] = True
                if not careful_like or not full:
                    if st['op'] is None:
                        buy_fleet(L['claim'])
        site = st['site']
        claim = st['claim']
        d = claim['tpl'] if claim else 'north'
        cal = cals[d][y]
        summ = cal[1]
        active = site is not None and site.remaining_pay() > 1000
        start_week = 1
        if active and full:
            aw = st['auth'] - y * 52
            if aw >= 52:
                active = False
            start_week = max(1, aw + 1)
            if active and st['op'] is None:
                buy_fleet(claim)                                        # careful bots buy iron only once authority is near
        if active and st['op'] is None:
            buy_fleet(claim)
        if active and y == 0 and start != 'inheritor':
            if d == 'north':
                if strat in ('careful', 'balanced'):
                    start_week = max(start_week, summ['opStart'] + (3 if claim['access'] != 'highway' else 2))
                else:
                    start_week = max(start_week, summ['breakup'])
            else:
                start_week = max(start_week, 8 if strat in ('careful', 'balanced') else 5)
        op = st['op']
        if op is not None:
            _, mob = access_factors(claim['access'], claim['distMi'])
            if active and (y == 0 or not out['mined'][y - 1]) and (start != 'inheritor' or st.get('moved')):
                fin.spend('mobilization', 12000 * mob)                  # §7 ops.siteMobBaseUsd × §3 mobMult
                if d == 'arid':
                    fin.spend('capex', 15000 + 60 * claim['water']['depth'])   # §7 ops.wellBaseUsd + wellUsdPerFt × depth
            if d == 'arid':
                op.well_gpm = claim['water']['well']
                op.water_trucks = arid_trucks(op, op.well_gpm + claim['water']['base'])
            op.access, op.dist_mi = claim['access'], claim['distMi']
            op.water_gpm = claim['water']['base']
            op.phase = 3 if full else 1
        opts = dict(burden=BURDEN_P4_EARLY if full else BURDEN_P1, policy=policy, year=y + 1, start_week=start_week,
                    active=active and op is not None, depPerWeek=st['dep_w'], sell='refinery' if full else 'local',
                    fleetValue=(op.fleet_value() if op is not None else 0.0))
        ins = ga = 0.0
        if full:
            opts['price'] = (lambda yy: (lambda w: prices[yy * 52 + w - 1]))(y)
            opts['diesel'] = (lambda yy: (lambda w: diesels[yy * 52 + w - 1]))(y)
            if op is not None:
                ins = 0.0125 * ACCESS_INS.get(op.access, 1.15) * op.fleet_value() + 8000 + 4000   # equip + P2 GL stub + auto
                opts['insAnnual'] = ins
            ga = 900 + 550 / 12                                         # finance.outsourcedBookkeepingUsdPerMonth + LLC annual
            opts['gaMonthly'] = ga
        if op is None or site is None:
            op_ = op or build_op('mini', dict(tpl=d, access='highway', distMi=30, water=dict(base=0, well=0, depth=0)))
            recs, Y = run_year(op_, Site([]), fin, cal, rng, dict(opts, active=False))
        else:
            recs, Y = run_year(op, site, fin, cal, rng, opts)
        dl = {k: fin.ledger[k] - led0.get(k, 0.0) for k in fin.ledger}
        if y == 0:
            out['explore1'] = dl.get('explore', 0.0)
            out['commit1'] = sum(dl.get(k, 0.0) for k in ('land', 'amr', 'capex', 'mobilization'))
        exp_ = sum(dl.get(k, 0.0) for k in ('wages', 'fuel', 'maint', 'consumables', 'camp', 'siteFixed', 'waterTrucks',
                                            'mobilization', 'staffing', 'explore', 'amr', 'ga', 'insurance', 'claimFees',
                                            'permits', 'bondPrem', 'financeFees', 'interest', 'ap'))
        out['ni'][y] = Y['revenue'] - exp_ - Y['depreciation']
        out['opm'][y] = Y['revenue'] - season_summary(Y)
        out['mined'][y] = Y['washed'] > 0
        out['oz'] += Y['fineGross']
        if Y['washed'] > 0 and Y['fineGross'] > 0:
            # §11 11.19.5 cost per ounce (gross recovered fine oz); realized = net proceeds per fine oz sold
            site_cost = season_summary(Y) + Y['mobilization'] + dl.get('staffing', 0) + Y.get('insurance', 0)
            roy_v = Y['royaltyValue'] + Y['invRoyaltyValue'] + dl.get('amr', 0)
            acres_new = Y['dug'] / 11300.0                              # ≈ 7 ft dug column per acre
            cash_c = (site_cost + roy_v) / Y['fineGross']
            aisc = cash_c + (Y.get('ga', 0) + acres_new * 6000.0) / Y['fineGross']
            # BALANCE M-MARGIN / M-FLIP: operating margin before royalties; net = margin − royalties − debt service − G&A − insurance
            pre = Y['revenue'] + Y['royaltyValue'] + Y['invRoyaltyValue'] - season_summary(Y) - Y['mobilization']
            netf = (Y['revenue'] - season_summary(Y) - Y['mobilization'] - dl.get('amr', 0) - dl.get('debtService', 0)
                    - Y.get('ga', 0) - Y.get('insurance', 0))
            out['seasons'].append(dict(year=y + 1, cash=cash_c, aisc=aisc, realized=Y['revenue'] / max(Y['fineSold'], 1e-9),
                                       margin=pre, net=netf))
        if st['crec'] is not None:
            c = st['crec']
            c['rev'] += Y['revenue']
            c['opex'] += season_summary(Y) + Y['mobilization']
            c['holding'] += dl.get('amr', 0) * (0 if y == 0 and c['acq'] == dl.get('amr', 0) else 1) + Y.get('claimFees', 0)
            c['acres'] += Y['dug'] / 11300.0
            if op is not None:
                c['capital'] += 0.15 * op.fleet_value()                 # BALANCE 5.5 capital charge 15 %/yr of fleet resale
            if st['site'] is not None:
                c['payLeft'] = st['site'].remaining_pay()
        if Y.get('stoodDown'):
            st['stood'] = True
            out['stood'] = True
        if Y.get('fleetSold'):
            st['op'] = None
            st['site'] = None
            st['dep_w'] = 0.0
            out['fleetSold'] = True
        elif (careful_like and st['stood'] and st['op'] is not None
              and fin.cash + fin.personal < projected_drawdown(st['kind'], br['reserve'])):   # sells idle iron if liquidity < reserve
            fin.cash += 0.80 * st['op'].fleet_value()                   # cautious: sells idle iron at season end (dealer 0.80)
            st['op'] = None
            st['site'] = None
            st['dep_w'] = 0.0
        fv = st['op'].fleet_value() if st['op'] is not None else 0.0
        out['nwy'][y] = owner_share(start, fin.cash + fv + st['assets'] - fin.debt(), dk, y + 1, fin) + fin.personal
        if fin.bankrupt:
            out['survived'] = False
            out['bankruptYear'] = y + 1
            out['nwy'][y] = fin.personal                                # P1 settlement: company side lost, owner keeps personal cash
            for yy in range(y + 1, years):
                out['nwy'][yy] = fin.personal
            break
    out['injected'] = fin.injected
    out['explore'] = fin.ledger.get('explore', 0)
    fv = st['op'].fleet_value() if st['op'] is not None else 0.0
    out['nw'] = (owner_share(start, fin.cash + fv + st['assets'] - fin.debt(), dk, years, fin) + fin.personal
                 if out['survived'] else fin.personal)
    out['nw0'] = max(1.0, owner_nw0(start, dk, full))
    out['minCash'] = fin.min_cash
    # BALANCE 5.2 going concern: not lost, produced in a season, no distress fleet sale, at season end a claim plus a fleet
    # that can wash >= 20 bcy/hr, or company cash >= $150k
    out['going'] = (out['survived'] and not out.get('fleetSold', False) and any(out['mined'])
                    and ((st['op'] is not None and st['claim'] is not None) or fin.cash > 150000))
    # BALANCE 5.5 claim P&L (reduced): residual for a held purchased claim = 0.6 × price × remaining pay share
    for c in out['claims']:
        resid = 0.0
        if c['purchased'] and c['payTot']:
            resid = 0.6 * c['price'] * (c['payLeft'] if c['payLeft'] is not None else c['payTot']) / c['payTot']
        c['pl'] = c['rev'] - c['acq'] - c['holding'] - c['explore'] - c['opex'] - c['capital'] - 0.55 * c['acres'] * 6000.0 + resid
    return out


ACCESS_INS = {'highway': 1.00, 'seasonalRoad': 1.15, 'winterTrail': 1.35, 'flyIn': 1.60}     # §11 finance.ins.accessMult


def op_kind(strat, start, full=False):
    if start == 'inheritor':
        return 'inherit'
    if strat == 'aggressive':
        return 'refB2'
    if strat == 'undercap':
        return 'undercap'
    if start in ('backed', 'backedRoyalty'):
        return 'ref'
    return 'mini'


# =====================================================================================
# 11. REPORTING
# =====================================================================================
METRICS = {}


def mature_econ():
    key = ('mature', 'north')
    if key not in ECON:
        tab = op_unit_table(ref_mature, 'mature', None, T=6.0, B=1.5, srs=(0.5, 1, 2, 3, 4, 6, 8, 10), perms=(0.0, 0.8), years=(2,))
        ECON[key] = EconTest('mature/north', ref_mature, tab, royalty=0.12, netback=0.99, conc_share=90 / 240, prep='trommel')
    return ECON[key]


def ref_econ():
    """EconTest for the BALANCE fixture refSmallNorth (§7 7.20 reference operation; local buyer, 10 % lease)."""
    key = ('refSmallNorth', 'north')
    if key not in ECON:
        tab = op_unit_table(ref_backed, 'refSmallNorth', None, T=5.0, B=1.5, srs=(0.5, 1, 2, 3, 4, 6, 8, 10), perms=(0.0, 0.8), years=(2,))
        ECON[key] = EconTest('refSmallNorth/north', ref_backed, tab, royalty=0.10, netback=0.87, conc_share=0.0, prep='trommel')
    return ECON[key]


def shares(counter):
    t = sum(counter.values()) or 1
    return [f"{100 * counter[k] / t:.1f}" for k in CLASSES]


def part_A(pools):
    print("\n" + "=" * 100)
    print("PART A. WORLD: CLAIM-QUALITY DISTRIBUTION (§3 generator, simplified network; %d districts per template)" % NDIST)
    print("=" * 100)
    rows = []
    stats = {}
    for tn in ('north', 'arid'):
        held, w, allc = pools[tn]
        cAll, cHeld, cOpen, cPool = Counter(), Counter(), Counter(), Counter()
        for c in allc:
            cAll[c['cls']] += 1
            (cHeld if c['held'] else cOpen)[c['cls']] += 1
        for c, wt in zip(held, w):
            cPool[c['cls']] += wt
        tgt = {'north': '73.1/20.5/5.6/0.8', 'arid': '64.8/26.1/8.3/0.8'}[tn]   # §3 3.7 calibration harness rows
        for nm, cc in (('all parcels', cAll), ('held', cHeld), ('open ground', cOpen), ('LISTING POOL', cPool)):
            rows.append([tn, nm, sum(cc.values()) if nm != 'LISTING POOL' else '-'] + shares(cc) + ([tgt + ' (§3 claim)'] if nm == 'LISTING POOL' else ['']))
        stats[tn] = cPool
        METRICS['pool_' + tn] = [float(x) for x in shares(cPool)]
    table(['tpl', 'population', 'n', 'unecon %', 'marginal %', 'good %', 'excellent %', '§3.7 stated'], rows,
          "A1. §3 yardstick classes (refEconomics: sluice-only, $4,200, strip $2.50/$2.20, wash $12/$14 (+0.40 × permafrost), dev $150k+$8k/ac)."
          " Brief/§3 band for the listing pool: 60-72 / 18-30 / 5-10 / 0.7-2.5")
    rows = []
    for tn in ('north', 'arid'):
        held, w, allc = pools[tn]
        med = [claim_stats(c)[0] for c in held]
        sr = [claim_stats(c)[1] for c in held]
        mg, mw, msr, oz = [], [], [], defaultdict(list)
        ps_in_band = []
        pocket_blocks = 0
        nps = 0
        for c in held:
            tpl = TEMPLATES[c['tpl']]
            econ_blocks = []
            for b in c['blocks']:
                if b['mined']:
                    continue
                if b['f'] >= 0.4:
                    nps += 1
                    ps_in_band.append(0.005 <= b['g'] <= 0.03)
                    if b['g'] > 0.1:
                        pocket_blocks += 1
                rev, cost = ref_block(b, tpl)
                if rev > cost:
                    econ_blocks.append(b)
            if c['cls'] != 'uneconomic':
                for b in econ_blocks:
                    mg.append(b['g'])
                    mw.append((b['T'] + b['B']) * BCY_PER_ACRE_FT)
                    msr.append(b['ob'] / (b['T'] + b['B']))
                oz[c['cls']].append(sum(b['g'] * (b['T'] + b['B']) * BCY_PER_ACRE_FT for b in econ_blocks))

        def wq(q):
            pairs = sorted(zip(mg, mw))
            tot = sum(mw)
            acc = 0
            for g, wt in pairs:
                acc += wt
                if acc >= q * tot:
                    return g
            return pairs[-1][0] if pairs else 0
        stats[tn + '_medPS'] = [pct(med, q) for q in (.1, .25, .5, .75, .9)]
        METRICS['minedGrade_' + tn] = (wq(.1), wq(.5), wq(.9))
        METRICS['psInBand_' + tn] = mean(ps_in_band)
        METRICS['pockets_' + tn] = pocket_blocks / max(1, nps)
        rows.append([tn, ' / '.join(f"{pct(med, q):.4f}" for q in (.1, .25, .5, .75, .9)),
                     ' / '.join(f"{wq(q):.3f}" for q in (.1, .5, .9, .99)),
                     ' / '.join(f"{pct(sr, q):.1f}" for q in (.1, .5, .9)),
                     ' / '.join(f"{pct(msr, q):.1f}" for q in (.1, .5, .9)),
                     ' / '.join(f"{pct(oz[k], .5):,.0f}" if oz[k] else '-' for k in ('marginal', 'good', 'excellent')),
                     f"{100 * mean(ps_in_band):.0f}%", f"{100 * pocket_blocks / max(1, nps):.2f}%"])
    table(['tpl', 'median paystreak-block grade per claim p10/25/50/75/90', 'mined-block grade (bcy-wtd) p10/50/90/99',
           'strip claim p10/50/90', 'strip mined p10/50/90', 'contained oz mined: marg/good/exc (median)',
           'PS blocks 0.005-0.03', 'PS blocks > 0.1 (pockets)'], rows,
          "A2. Grade, stripping and contained gold (held claims).  §3.7 stated (north): 0.0013/0.0030/0.0057/0.0094/0.0145; "
          "mined 0.010/0.016/0.034/0.086; strip claim 1.9/4.1/10.3, mined 1.7/3.2/7.6; oz 620/1,790/3,550")
    # A3 op-specific economic tests
    tests = [('Bootstrapper mini fleet (P1 local buyer, lease 10 %)', econ_for('mini', 'north'), 'north'),
             ('refSmallNorth fixture (P1 local, lease 10 %)', ref_econ(), 'north'),
             ('Mature 2-shift 240 bcy/hr (refinery, centrifuge, lease 12 %)', mature_econ(), 'north'),
             ('Arid mini fleet + centrifuge, median well (P1 local, lease 6 %)', econ_for('mini', 'arid'), 'arid')]
    rows = []
    for nm, e, tn in tests:
        held, w, _ = pools[tn]
        cc = Counter()
        cc20 = Counter()
        cc160 = Counter()
        for c, wt in zip(held, w):
            cls = e.evaluate(c)[0]
            cc[cls] += wt
            if c['acres'] == 20:
                cc20[cls] += wt
            if c['acres'] >= 80:
                cc160[cls] += wt
        rows.append([nm, f"{e.C / 1e3:,.0f}k", f"{e.K / 1e3:,.0f}k", f"{e.D / 1e3:,.0f}k"] + shares(cc) +
                    [f"{100 - float(shares(cc20)[0]):.0f}%", f"{100 - float(shares(cc160)[0]):.0f}%"])
        stats['op_' + nm[:12]] = cc
        METRICS['op_' + nm.split()[0] + '_' + tn] = [float(x) for x in shares(cc)]
    table(['economic test (listing pool, truth)', 'season opex C', 'capital K/yr', 'dev D', 'unecon %', 'marginal %', 'good %',
           'excellent %', 'econ share 20 ac', 'econ share >=80 ac'], rows,
          "A3. Op-specific economic test at $4,200 (EconTest docstring: block margin = engine season cost/volume at the block's"
          " strip ratio and permafrost, recovery of the op's circuit, sale netback, typical lease royalty; CDV after dev cost)")
    # A4 arid gMed sweep
    rows = []
    for mult in (1.0, 0.9, 0.8):
        rng = R(SEED + 77)
        save = TEMPLATES['arid']['gMed']
        TEMPLATES['arid']['gMed'] = save * mult
        cl = []
        for d in range(max(8, NDIST // 2)):
            cl += gen_district('arid', rng)
        TEMPLATES['arid']['gMed'] = save
        cp = Counter()
        for c in cl:
            if c['held']:
                cp[ref_economics(c)[0]] += listing_weight(ref_economics(c)[0])
        rows.append([f"{save * mult:.4f} (×{mult})"] + shares(cp))
    table(['arid gMed', 'unecon %', 'marginal %', 'good %', 'excellent %'], rows,
          "A4. Arid listing-pool sensitivity to geology gMed (§3 yardstick)")
    return stats


ARO_PER_ACRE = 6000.0     # §3 3.9 / §6: P1 stub reclamation estimate $6,000 per disturbed acre
ACRE_BCY = 11300.0        # this model: ≈ 7 ft dug column per acre (1,613 bcy/acre-ft)


def fin_lines(op, Y, debt_service=0.0, interest=0.0, ga=0.0, ins=0.0, capex_growth=0.0, explore=0.0,
              dep=0.0, amr=0.0, recl_acres=0.0):
    """§11 11.19.5 cost per ounce on gross recovered fine oz: cash = site costs (incl. mobilization and site insurance)
    + in-kind royalty oz × spot + cash/advance royalties; AISC + G&A + reclamation provision (+ sustaining capex and
    exploration, 0 here); AIC + interest + growth capex + other exploration."""
    opex = season_summary(Y) + Y['mobilization']
    fine = Y['fineGross']
    royv = Y['royaltyValue'] + Y['invRoyaltyValue']
    cash_cost = (opex + ins + royv + amr) / max(fine, 1e-9)
    aisc = cash_cost + (ga + recl_acres * ARO_PER_ACRE) / max(fine, 1e-9)
    aic = aisc + (interest + capex_growth + explore) / max(fine, 1e-9)
    profit = Y['revenue'] - opex - amr - ga - ins - interest - dep - explore
    return dict(opex=opex, cash=cash_cost, aisc=aisc, aic=aic, profit=profit,
                after_debt=Y['revenue'] - opex - amr - ga - ins - debt_service - explore)


FIXTURES = [   # BALANCE.md §2 reference fixtures (P1 terms unless marked)
    ('starterNorth', '(a) starterNorth: Bootstrapper mini fleet, lease 7 %, P1', lambda: ref_bootstrapper_p1(True), 'N',
     dict(roy=0.07, amr=2000, burden=BURDEN_P1)),
    ('starterNorthP4', '(a4) Bootstrapper P4: bigger used fleet, $250k loan @ 19 %', ref_bootstrapper_p4, 'N',
     dict(roy=0.07, amr=2000, loan=250000, rate=0.19, months=48, ga=11350, ins=True, burden=BURDEN_P4_EARLY)),
    ('refSmallNorth', '(b) refSmallNorth: owned claim, local buyer, P1', ref_backed, 'N', dict(roy=0.0, amr=0, burden=BURDEN_P1)),
    ('refSmallNorthRoyalty', '(b-R) refSmallNorthRoyalty: lease 11 % + 10 % investor royalty, P1', ref_backed, 'N',
     dict(roy=0.11, inv=0.10, amr=7000, burden=BURDEN_P1)),
    ('refSmallNorthDebt', '(b-D) refSmallNorthDebt: $900k @ 10 %/60, lease 10 %, refinery, P4', ref_backed, 'N',
     dict(roy=0.10, amr=0, loan=900000, rate=0.10, months=60, ga=60000, ins=True, burden=BURDEN_P4_EARLY, refinery=True)),
    ('matureNorth', '(c) matureNorth: 2-shift, $3.0M @ 10 %, lease 12 %, refinery', ref_mature, 'M',
     dict(roy=0.12, amr=50000, loan=3.0e6, rate=0.10, months=60, ga=120000, ins=True, burden=BURDEN_P4_EARLY, refinery=True, nb=80)),
    ('starterArid', '(d) starterArid: median well (120 gpm) + 1 water truck, P1', ref_arid, 'A',
     dict(roy=0.04, amr=2000, burden=BURDEN_P1)),
    ('starterAridWellOnly', '(d1) starterArid on the median well alone', lambda: ref_arid(trucks=0), 'A',
     dict(roy=0.04, amr=2000, burden=BURDEN_P1)),
    ('starterAridWell300', '(d2) starterArid, 300-gpm well, no truck', lambda: ref_arid(trucks=0, well=300.0), 'A',
     dict(roy=0.04, amr=2000, burden=BURDEN_P1)),
    ('inheritorNorth', '(e) inheritorNorth: inherited fleet, 2 pre-stripped blocks, $320k seasonal note, P1', ref_inheritor, 'N',
     dict(roy=0.0, amr=0, loan=320000, rate=0.085, months=84, seasonal=True, burden=BURDEN_P1, inherited=True, pre=2)),
]


def part_B():
    print("\n" + "=" * 100)
    print("PART B. REFERENCE FIXTURES: SEASON ECONOMICS (engine §7/§8/§9, mean calendar, no sub-block noise)")
    print("=" * 100)
    rows = []
    rows2 = []
    detail = {}
    for fid, nm, op_fn, ck, f in FIXTURES:
        op = op_fn()
        claim = {'N': REF_CLAIM_N, 'M': dict(REF_CLAIM_N, g=0.010, T=6, perm=0.7), 'A': REF_CLAIM_A}[ck]
        rng = R(3)
        site = Site(mk_blocks(f.get('nb', 40), **claim), pre_stripped=f.get('pre', 0))
        fin = Fin(10e6)
        fin.lease_roy = f.get('roy', 0.0)
        fin.inv_roy = f.get('inv', 0.0)
        fin.inv_contrib = 900000
        inh = f.get('inherited', False)
        prices_ = [price_of(m) for m in op.machines]
        capex = 0.0 if inh else sum(prices_)
        transport = 0.0 if inh else transport_cost([m.model for m in op.machines], op.access, op.dist_mi)
        _, mob = access_factors(op.access, op.dist_mi)
        sitemob = 0.0 if inh else 12000 * mob
        if f.get('loan'):
            fin.loan(f['loan'], f['rate'], f['months'], 'x', seasonal=f.get('seasonal', False), proceeds=0.0)
        ins = (0.0125 * 1.15 * op.fleet_value() + max(6000, 5000 + 15 * 600) + 4000) if f.get('ins') else 0.0
        depw = 0.0 if inh else book_dep_per_week(op, prices_)
        for y in (1, 2):
            cal = make_year(op.district, rng, mean_only=True, hours=op.hours)
            led0 = dict(fin.ledger)
            o = dict(burden=f['burden'], subblock=False, year=y, sell='refineryAll' if f.get('refinery') else 'local', depPerWeek=depw,
                     gaMonthly=f.get('ga', 0) / 12, insAnnual=ins)
            recs, Y = run_year(op, site, fin, cal, rng, o)
            interest = fin.ledger['interest'] - led0.get('interest', 0)
            ds = fin.ledger['debtService'] - led0.get('debtService', 0)
            amr = f.get('amr', 0)
            growth = (capex + transport + sitemob) if y == 1 else 0.0
            L = fin_lines(op, Y, debt_service=ds, interest=interest, ga=f.get('ga', 0), ins=Y.get('insurance', 0.0), capex_growth=growth,
                          dep=Y['depreciation'], amr=amr, recl_acres=Y['dug'] / ACRE_BCY)
            if y == 1:
                L['profit'] -= transport + sitemob
                L['after_debt'] -= transport + sitemob
            opex = L['opex']
            so = season_summary(Y) + Y['mobilization']                     # BALANCE M-OPEX site opex (incl. mobilization, winterizing)
            fw = (Y['fuel'] + Y['wages']) / max(1, so)
            rate = Y['washed'] / max(1, Y['plantRunHrs'])
            bn = max(((k[3:], v) for k, v in Y.items() if k.startswith('bn_') and k != 'bn_n/a'), key=lambda x: x[1], default=('-', 0))[0]
            rows.append([nm if y == 1 else '', y, f"{Y['washed']:,.0f}", f"{rate:.0f}", bn, f"{Y['rawWeighed']:,.0f}", f"{Y['fineGross']:,.0f}",
                         fmt_k(Y['revenue']), fmt_k(opex), f"{100 * fw:.0f}%", fmt_k(Y['royaltyValue'] + Y['invRoyaltyValue']),
                         fmt_k(ds), f"{L['cash']:,.0f}", f"{L['aisc']:,.0f}", f"{L['aic']:,.0f}", fmt_k(L['profit']), fmt_k(L['after_debt'])])
            rows2.append([nm if y == 1 else '', y, fmt_k(Y['wages']), fmt_k(Y['fuel']), fmt_k(Y['maint']), fmt_k(Y['camp']),
                          fmt_k(Y['consumables'] + Y['siteFixed']), fmt_k(Y['waterTrucks']), fmt_k(Y['mobilization']),
                          fmt_k(Y.get('insurance', 0)), fmt_k(f.get('ga', 0)),
                          f"{Y['fuelGal']:,.0f}", f"{Y['recovered'] / max(1e-9, Y['contained']):.3f}",
                          f"{(Y['contained'] / max(1, Y['washed'])):.4f}", f"{100 * Y['wages'] / max(1, so):.0f}/{100 * Y['fuel'] / max(1, so):.0f}/{100 * Y['maint'] / max(1, so):.0f}"])
            detail[(fid, y)] = (Y, L)
            METRICS[(fid, y)] = dict(rate=rate, fw=fw, rev=Y['revenue'], opex=opex, so=so, roy=Y['royaltyValue'] + Y['invRoyaltyValue'],
                                     ds=ds, profit=L['profit'], cash=L['cash'], aisc=L['aisc'], aic=L['aic'], washed=Y['washed'],
                                     raw=Y['rawWeighed'], fine=Y['fineGross'], wages=Y['wages'], fuel=Y['fuel'], maint=Y['maint'],
                                     realized=Y['revenue'] / max(1e-9, Y['fineSold']), after=L['after_debt'],
                                     plantHrs=Y['plantHrs'], runHrs=Y['plantRunHrs'], weeks=Y['opWeeks'])
        rows.append(['', '', 'capex', fmt_k(capex), 'transport+mob', fmt_k(transport + sitemob), '', '', '', '', '', '', '', '', '', '', ''])
    table(['fixture', 'yr', 'bcy washed', 'bcy/hr run', 'main bottleneck', 'raw oz', 'fine oz', 'revenue', 'site opex', 'fuel+wages',
           'royalty value', 'debt svc', 'cash $/oz', 'AISC $/oz', 'AIC $/oz', 'book profit', 'cash after debt'], rows,
          "B1. Season economics.  Reference claims: north 0.012 raw oz/bcy in the pay column, 15 ft frozen muck (p 0.8), 5 ft pay + 1.5 ft"
          " bedrock; arid fan 0.010, 4 ft OB, finer gold (10/30/40/20), fineness 0.78.  (c) uses 0.010 on 6 ft pay, p 0.7.  Year 2 is an"
          " established season (strip-ahead and overwinter thaw).  Revenue is net sale proceeds (local buyer ≈ 0.87 of true value; refinery ≈ 0.99).")
    table(['fixture', 'yr', 'wages+burden', 'fuel', 'maintenance', 'camp', 'consum.+site', 'water trucks', 'mob/winterize', 'insurance',
           'G&A', 'fuel gal', 'recovery', 'head grade', 'wages/fuel/R&M % of site opex'], rows2, "B2. Cost breakdown")
    return detail


def part_C():
    print("\n" + "=" * 100)
    print("PART C. CANONICAL SEASONAL CASH CURVES AND THE FIRST-SEASON THAW CONSTRAINT")
    print("=" * 100)
    curves = {}
    # Jan 1 start; purchases (lease, testing, fleet, transport, site mobilization) booked in week 1; crew at breakup
    for nm, op, cash0, pers, roy, setup in [
            ('(a) Bootstrapper P1 (cash $400k + personal $120k)', ref_bootstrapper_p1(True), START['bootstrapper']['cash'],
             START['bootstrapper']['personal'], 0.07, 'boot'),
            ('(b) Backed equity (cash $1.5M, refSmallNorth fleet, lease 11 %)', ref_backed(), START['backed']['cash'],
             START['backed']['personal'], 0.11, 'backed'),
            ('(e) Inheritor P1 (cash $250k + personal $40k, 2 pre-stripped blocks, seasonal note)', ref_inheritor(),
             START['inheritor']['cash'], START['inheritor']['personal'], 0.0, 'inh')]:
        rng = R(11)
        site = Site(mk_blocks(40, **REF_CLAIM_N), pre_stripped=INH_PRESTRIP if setup == 'inh' else 0)
        fin = Fin(cash0, personal=pers, grace=999)
        fin.lease_roy = roy
        if setup != 'inh':
            fin.amr, fin.amr_week = (2000, 3) if setup == 'boot' else (12000, 3)
        else:
            fin.loan(INH_NOTE, 0.085, 84, 'estate', seasonal=True, proceeds=0.0)
        prices_ = [price_of(m) for m in op.machines]
        weekly = []
        for y in (1, 2):
            cal = make_year('north', rng, mean_only=True)
            o = dict(burden=BURDEN_P1, subblock=False, year=y, policy=dict(inject=False), depPerWeek=0.0)
            if y == 1:
                if setup == 'inh':
                    fin.spend('ap', INH_AP)
                    fin.spend('explore', 15 * OWN_PIT_USD)
                else:
                    fin.spend('amr', fin.amr)
                    fin.spend('explore', 2 * (RECORDS_REVIEW_USD + SITE_VISIT_USD['seasonalRoad']) + 15 * OWN_PIT_USD + PIT_MOB_USD * 1.4)
                    fin.spend('capex', sum(prices_))
                    fin.spend('mobilization', transport_cost([m.model for m in op.machines], op.access, op.dist_mi))
                    fin.spend('mobilization', 12000 * access_factors(op.access, op.dist_mi)[1])
            recs, Y = run_year(op, site, fin, cal, rng, o)
            for r in recs:
                weekly.append((y, r['w'], r['cash'], r['washed'], r['rev'], r['opex']))
        curves[nm] = (weekly, fin, pers)
    for nm, (weekly, fin, pers) in curves.items():
        print(f"\nC1. {nm}: weekly COMPANY cash before any owner injection ($k); W=washed bcy; G=gold sold $k.")
        line = []
        for (y, w, c, wsh, rev, opx) in weekly:
            tag = f"y{y}w{w:02d} {c / 1e3:7.0f}" + (f" W{wsh / 1e3:3.1f}k G{rev / 1e3:3.0f}" if wsh > 0 or rev > 0 else "")
            line.append(tag.ljust(30))
            if len(line) == 4:
                print('  ' + ' | '.join(line))
                line = []
        if line:
            print('  ' + ' | '.join(line))
        mc = min(weekly, key=lambda x: x[2])
        print(f"  minimum company cash: ${mc[2] / 1e3:,.0f}k at year {mc[0]} week {mc[1]} (owner injection needed: ${max(0, -mc[2]) / 1e3:,.0f}k"
              f" of ${pers / 1e3:,.0f}k personal); end of year 2 cash ${weekly[-1][2] / 1e3:,.0f}k")
        METRICS['trough_' + ('boot' if 'Bootstrapper' in nm else 'inh' if 'Inheritor' in nm else 'backed')] = (mc[2], mc[0], mc[1], pers)
    # §11.15 canonical curve = BALANCE fixture refSmallNorthDebt, year 2: $900k @ 10 %/60, 10 % lease royalty, refinery,
    # $400k on Jan 1, P4 burden, insurance, G&A $5k/month, ≈ $110k of winter rebuild cash moved to Jan-Apr (§11 D-11.54)
    C2 = {}
    for variant in ('level', 'seasonal'):
        op = ref_backed()
        rng = R(12)
        site = Site(mk_blocks(40, **REF_CLAIM_N))
        fin0 = Fin(10e6)
        run_year(op, site, fin0, make_year('north', rng, mean_only=True), rng, dict(subblock=False, year=1))   # season 1 (warm-up)
        probe_site = Site(mk_blocks(40, **REF_CLAIM_N))
        run_year(op, probe_site, Fin(10e6), make_year('north', R(12), mean_only=True), R(12), dict(subblock=False, year=1))
        _, Yp = run_year(op, probe_site, Fin(10e6), make_year('north', R(12), mean_only=True), R(12),
                         dict(subblock=False, year=2, burden=BURDEN_P4_EARLY))
        rebuild = 110000.0
        scale = max(0.0, (Yp['maint'] - rebuild) / Yp['maint'])
        fin = Fin(400000)
        fin.lease_roy = 0.10
        fin.loan(900000, 0.10, 60, 'x', seasonal=(variant == 'seasonal'), proceeds=0.0)
        recs, Y = run_year(op, site, fin, make_year('north', rng, mean_only=True), rng,
                           dict(subblock=False, year=2, sell='refineryAll', burden=BURDEN_P4_EARLY, gaMonthly=5000,
                                insAnnual=0.0125 * 1.15 * op.fleet_value() + 14500 + 4000, rebuildShiftUsd=rebuild,
                                maintCashScale=scale))
        months = []
        for mi, me in enumerate(MONTH_END):
            prev = MONTH_END[mi - 1] if mi else 0
            mrec = [r for r in recs if prev < r['w'] <= me]
            months.append((sum(r['opex'] for r in mrec) + (rebuild / 4 if mi <= 3 else 0.0), sum(r['rev'] for r in mrec), mrec[-1]['cash']))
        outflow = sum(fin.ledger[k] for k in ('wages', 'fuel', 'maint', 'consumables', 'camp', 'siteFixed', 'waterTrucks',
                                              'mobilization', 'staffing', 'ga', 'insurance', 'maintRebuild'))
        C2[variant] = (months, Y, fin.loans[0]['pmt'], outflow, fin.ledger['debtService'], fin.ledger['interest'])
    rows = []
    names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    for mi in range(12):
        a_, b_ = C2['level'][0][mi], C2['seasonal'][0][mi]
        rows.append([names[mi], fmt_k(a_[0]), fmt_k(a_[1]), fmt_k(a_[2]), fmt_k(b_[2])])
    table(['month', 'site outflows (rebuild cash in Jan-Apr)', 'gold in', 'end cash (level)', 'end cash (seasonal Jun-Nov)'], rows,
          "C2. §11.15 canonical curve = refSmallNorthDebt, year 2 (engine).  §11.15 table: trough −$111k (Jun, level) / −$35k (seasonal);"
          " year +$15k / +$11k; 427 gross fine oz, receipts $1,588k")
    for variant in ('level', 'seasonal'):
        months, Y, pmt, outflow, dsv, intr = C2[variant]
        mn = min(range(12), key=lambda i: months[i][2])
        net = months[-1][2] - 400000
        print(f"  {variant}: payment ${pmt:,.2f}; min month-end cash ${months[mn][2] / 1e3:,.0f}k in {names[mn]}; drawdown"
              f" ${(400000 - months[mn][2]) / 1e3:,.0f}k = {100 * (400000 - months[mn][2]) / outflow:.0f}% of ops outflows"
              f" (${outflow / 1e3:,.0f}k); debt service ${dsv / 1e3:,.0f}k (interest ${intr / 1e3:,.0f}k); year net ${net / 1e3:+,.0f}k;"
              f" gross fine oz {Y['fineGross']:.0f}; receipts ${Y['revenue'] / 1e3:,.0f}k")
        METRICS['c2_' + variant] = dict(min=months[mn][2], month=names[mn], draw=400000 - months[mn][2], outflow=outflow, net=net,
                                       fine=Y['fineGross'], rev=Y['revenue'], pmt=pmt, ds=dsv)
    # C3 first-season thaw constraint
    rows = []
    for nm, claim, pre, ripassist in [('frozen muck p 0.8, no strip-ahead (season 1)', REF_CLAIM_N, 0, False),
                                      ('frozen, 2 blocks pre-stripped (thaw 4.5 ft)', REF_CLAIM_N, 2, False),
                                      ('frozen, 3 blocks pre-stripped (thaw 4.5 ft)', REF_CLAIM_N, 3, False),
                                      ('frozen, D8 on rip assist half time (D6 strips)', REF_CLAIM_N, 0, True),
                                      ('unfrozen ground (p 0)', dict(REF_CLAIM_N, perm=0.0), 0, False)]:
        op = ref_backed()
        if ripassist:
            op.machines = [m for m in op.machines if m.model != 'dz8'] + fleet([('dz8', 'dig', 'C'), ('dz6', 'strip', 'C', 50, True)])
        out, fin, site = run_ref(op, claim, years=2, pre=pre)
        Y1, Y2 = out[0][1], out[1][1]
        rows.append([nm, f"{Y1['washed']:,.0f}", f"{Y1['fineGross']:.0f}", fmt_k(Y1['revenue'] - season_summary(Y1)),
                     f"{Y2['washed']:,.0f}", f"{Y2['fineGross']:.0f}", fmt_k(Y2['revenue'] - season_summary(Y2))])
    table(['refSmallNorth on 0.012 ground', 'yr1 bcy', 'yr1 fine oz', 'yr1 op margin', 'yr2 bcy', 'yr2 fine oz', 'yr2 op margin'], rows,
          "C3. First-season effect of permafrost and strip-ahead (§7 7.4)")
    return curves


def part_D():
    print("\n" + "=" * 100)
    print("PART D. BREAK-EVEN IN-SITU GRADE (raw oz per bcy of pay column) BY STRIPPING RATIO (engine, year-2 steady state)")
    print("=" * 100)
    rows = []
    ops = [('starterNorth (Bootstrapper mini)', 'mini', 'north', 0.87, 0.07, 0.0), ('refSmallNorth', 'refFix', 'north', 0.87, 0.10, 230000),
           ('refSmallNorth @ refinery (P5)', 'refFix', 'north', 0.99, 0.10, 230000),
           ('matureNorth (refinery)', 'mature', 'north', 0.99, 0.12, 764000),
           ('arid mini + centrifuge (median well)', 'mini', 'arid', 0.87, 0.04, 0.0)]
    BE = {}
    for nm, kind, d, nb, roy, ds in ops:
        e = mature_econ() if kind == 'mature' else ref_econ() if kind == 'refFix' else econ_for(kind, d)
        tab = e.tab
        for p in sorted(set(k[1] for k in tab)):
            if d == 'arid' and p > 0:
                continue
            r = [nm, f"{p:.1f}"]
            for sr in (1, 2, 3, 4, 6, 8):
                v = tab.get((2, p, sr))
                if not v or v['rev'] <= 0:
                    r.append('-')
                    continue
                g0 = 0.012
                rev_true = v['rev'] / 0.87 * nb                                   # engine ran at local-buyer netback
                be0 = g0 * v['C'] / rev_true
                be1 = g0 * v['C'] / (rev_true * (1 - roy))
                be2 = g0 * (v['C'] + ds + e.K * 0.5) / (rev_true * (1 - roy))
                r.append(f"{be0:.4f}/{be1:.4f}/{be2:.4f}")
                BE[(nm, p, sr)] = (be0, be1, be2)
            rows.append(r)
    table(['operation', 'permafrost', 'SR 1', 'SR 2', 'SR 3', 'SR 4', 'SR 6', 'SR 8'], rows,
          "D1. Break-even grade: opex only / + typical royalty / + royalty + debt service (or 10 % capital charge).  SR = (OB − 0.5 ft)"
          " / (pay + bedrock cleanup).  Compare: median paystreak block ≈ 0.0057; grade of economically mined blocks p50 ≈ 0.016.")
    METRICS['BE'] = BE
    # §7 7.23 frozen-ground fixture: refSmallNorth opex-only break-even at SR 3, p 0.8 ÷ p 0 (target 1.38 ± 0.05);
    # §3 3.7 yardstick ratio for the same block (stated 1.36)
    eng = BE[('refSmallNorth', 0.8, 3)][0] / BE[('refSmallNorth', 0.0, 3)][0]
    blk = dict(g=1.0, T=5.0, B=1.5, ob=3 * 6.5 + MU_C, perm=0.8, clay=0.15, bould=0.2, mix=(.25, .40, .27, .08), fin=0.86, cem=0.0)
    r8, c8 = ref_block(blk, TEMPLATES['north'])
    r0, c0 = ref_block(dict(blk, perm=0.0), TEMPLATES['north'])
    yard = (c8 / r8) / (c0 / r0)
    mat = BE[('matureNorth (refinery)', 0.8, 3)][1] / BE[('refSmallNorth', 0.8, 3)][1]
    matP5 = BE[('matureNorth (refinery)', 0.8, 3)][1] / BE[('refSmallNorth @ refinery (P5)', 0.8, 3)][1]
    print(f"  frozen/thawed opex break-even at SR 3: engine (refSmallNorth) {eng:.2f} (§7 7.23 target 1.38 ± 0.05); "
          f"§3 yardstick {yard:.2f} (§3 3.7 states 1.36)")
    matT = BE[('matureNorth (refinery)', 0.0, 3)][1] / BE[('refSmallNorth @ refinery (P5)', 0.0, 3)][1]
    print(f"  matureNorth ÷ refSmallNorth break-even with royalty at SR 3, p 0.8: {mat:.2f} against refSmallNorth at the local buyer;"
          f" {matP5:.2f} with both at a refinery; thawed (p 0), both at a refinery: {matT:.2f} (T-10 gate ≤ 0.85)")
    METRICS['frozenRatio'] = (eng, yard)
    METRICS['matureRatio'] = (mat, matP5, matT)


MC_CONFIGS = [('careful', 'bootstrapper'), ('careful', 'backed'), ('careful', 'backedRoyalty'), ('careful', 'inheritor'),
              ('balanced', 'bootstrapper'), ('balanced', 'backed'), ('carefulNoTest', 'bootstrapper'), ('carefulNoTest', 'backed'),
              ('undercap', 'bootstrapper'), ('aggressive', 'bootstrapper'), ('aggressive', 'backed')]
Y5_CONFIGS = [('careful', 'bootstrapper'), ('careful', 'backed'), ('careful', 'backedRoyalty'), ('careful', 'inheritor'),
              ('balanced', 'bootstrapper'), ('balanced', 'backed'), ('aggressive', 'bootstrapper'), ('aggressive', 'backed'),
              ('undercap', 'bootstrapper'), ('carefulNoTest', 'bootstrapper')]
BOT_LABEL = {'careful': 'cautious', 'carefulNoTest': 'noTest', 'balanced': 'balanced', 'aggressive': 'aggressive', 'undercap': 'undercap'}


def run_mc(pools, n, rules, configs=MC_CONFIGS, seed0=100000, years=2, **kw):
    """Common seeds by start type (game i of every bot with the same start uses the same seed), per BALANCE 6.2."""
    res = {}
    for strat, start in configs:
        res[(strat, start)] = [play(strat, start, rules, R(seed0 + 7919 * i + zlib.crc32(start.encode()) % 1000), pools,
                                    years=years, **kw) for i in range(n)]
    return res


def ci(p, n):
    return 1.96 * math.sqrt(max(p * (1 - p), 1e-9) / n)


def nw_ratio(r, y=None):
    v = r['nw'] if y is None else r['nwy'][y]
    return v / r['nw0']


def summarize(rs):
    n = len(rs)
    m = dict(n=n, surv=mean([r['survived'] for r in rs]), going=mean([r['going'] for r in rs]),
             fp=mean([r['ni'][0] > 0 for r in rs]), m1=mean([r['mined'][0] for r in rs]),
             nw=pct([nw_ratio(r) for r in rs], .5), nw90=pct([nw_ratio(r) for r in rs], .9), nw10=pct([nw_ratio(r) for r in rs], .1),
             up=mean([nw_ratio(r) >= 1.0 for r in rs]),
             arid=mean([r['district'] == 'arid' for r in rs if r['district']]) if any(r['district'] for r in rs) else 0.0,
             inj=pct([r['injected'] for r in rs], .5),
             explore_share=pct([r.get('explore1', 0) / r['commit1'] for r in rs if r.get('commit1', 0) > 0], .5))
    return m


def mc_table(res, rules, title):
    rows = []
    for (strat, start), rs in res.items():
        m = summarize(rs)
        n = m['n']
        opm = [r['opm'][0] for r in rs if r['mined'][0]]
        rows.append([BOT_LABEL[strat], start, n, f"{100 * m['surv']:.0f}±{100 * ci(m['surv'], n):.0f}",
                     f"{100 * m['going']:.0f}±{100 * ci(m['going'], n):.0f}", f"{100 * (m['surv'] - m['going']):.0f}",
                     f"{100 * m['fp']:.0f}", f"{100 * m['m1']:.0f}", f"{100 * mean([x > 0 for x in opm]):.0f}" if opm else '-',
                     ' / '.join(fmt_k(pct([r['ni'][0] for r in rs], q)) for q in (.1, .5, .9)),
                     ' / '.join(f"{pct([nw_ratio(r) for r in rs], q):.2f}" for q in (.1, .5, .9)), f"{100 * m['arid']:.0f}%",
                     fmt_k(m['inj'])])
    table(['bot', 'start', 'n', 'B2 % (±95%)', 'S2 % (±95%)', 'retreated B2−S2', 'first-season profit %', 'mined s1 %',
           'op margin>0 | mined s1 %', 'NI season 1 p10/p50/p90', 'owner NW y2 ÷ start p10/p50/p90', 'arid share', 'median injected'],
          rows, title)


def pooled(M, rules, key='going'):
    a = M[('mc', rules, 'careful', 'bootstrapper')][key]
    b = 0.5 * (M[('mc', rules, 'careful', 'backed')][key] + M[('mc', rules, 'careful', 'backedRoyalty')][key])
    c = M[('mc', rules, 'careful', 'inheritor')][key]
    return (a + b + c) / 3


def part_E(pools):
    print("\n" + "=" * 100)
    print("PART E. MONTE CARLO OF THE FIRST TWO SEASONS (reduced bots; see simplifications)")
    print("=" * 100)
    out = {}
    for rules in ('p1', 'full'):
        res = run_mc(pools, N_MC, rules)
        out[rules] = res
        for k, rs in res.items():
            METRICS[('mc', rules) + k] = summarize(rs)
        mc_table(res, rules, f"E{1 if rules == 'p1' else 2}. Rules = " + (
            'P1 (flat $4,200, local buyer, cash only, no permits, no wear)' if rules == 'p1' else
            'FULL (P5-like: regime price, refinery, P2 permits incl. §3 permitStub and the starter lease, P3 availability, '
            'P4 insurance, G&A, equipment finance and hard money)'))
        print(f"  pooled cautious S2 (Bootstrapper, Backed equity/royalty averaged, Inheritor) = {100 * pooled(METRICS, rules):.0f}%;"
              f" pooled B2 = {100 * pooled(METRICS, rules, 'surv'):.0f}%; pooled first-season profit = {100 * pooled(METRICS, rules, 'fp'):.0f}%")
    # value of information (O-08)
    rows = []
    for rules in ('p1', 'full'):
        for start in ('bootstrapper', 'backed'):
            a = METRICS[('mc', rules, 'careful', start)]
            b = METRICS[('mc', rules, 'carefulNoTest', start)]
            rows.append([rules, start, f"{100 * a['going']:.0f} vs {100 * b['going']:.0f}", f"{100 * (a['going'] - b['going']):+.0f}",
                         f"{a['nw']:.2f} vs {b['nw']:.2f}", f"{a['nw'] - b['nw']:+.2f}",
                         f"{100 * a['up']:.0f} vs {100 * b['up']:.0f} ({100 * (a['up'] - b['up']):+.0f})", f"{100 * a['explore_share']:.0f}%"])
    table(['rules', 'start', 'S2 cautious vs noTest', 'S2 gain pp', 'NW ratio y2 p50 cautious vs noTest', 'NW gain',
           'owner NW y2 >= start %, cautious vs noTest (gain pp)',
           'cautious testing spend ÷ first-season commitment (median)'], rows, "E3. Value of information (O-08)")
    # difficulty ordering (O-05), P1
    rows = []
    for diff in ('easy', 'standard', 'hard'):
        for strat, start in (('careful', 'bootstrapper'), ('careful', 'backed'), ('undercap', 'bootstrapper')):
            rs = [play(strat, start, 'p1', R(777000 + i), pools, difficulty=diff) for i in range(N_MC)]
            m = summarize(rs)
            METRICS[('diff', diff, strat, start)] = m
            rows.append([diff, BOT_LABEL[strat], start, f"{100 * m['surv']:.0f}", f"{100 * m['going']:.0f}", f"{100 * m['fp']:.0f}",
                         f"{m['nw']:.2f}"])
    table(['difficulty', 'bot', 'start', 'B2 %', 'S2 %', 'first-season profit %', 'NW ratio y2 p50'], rows,
          "E3b. Difficulty ordering (P1 rules; §1 1.11 honesty mix, ask markup, reservation discount, start cash 1.25/1.0/0.85,"
          " personal 1.1/1.0/0.9, insolvency grace 8/6/4, season variance and freeze-up shift, Inheritor note; n = %d on common seeds)" % N_MC)
    # Inheritor by tier
    rows = []
    for rules in ('p1', 'full'):
        rs = out[rules][('careful', 'inheritor')]
        for tier in ('uneconomic', 'marginal', 'good', 'excellent'):
            t = [r for r in rs if r['cls'] == tier]
            if t:
                rows.append([rules, tier, len(t), f"{100 * mean([r['survived'] for r in t]):.0f}", f"{100 * mean([r['going'] for r in t]):.0f}",
                             f"{100 * mean([r['mined'][0] for r in t]):.0f}", fmt_k(pct([r['ni'][0] for r in t], .5)),
                             f"{100 * mean([r.get('inhClass') == tier for r in t]):.0f}%"])
    table(['rules', 'family-ground tier', 'n', 'B2 %', 'S2 %', 'mined s1 %', 'NI s1 p50', 'yardstick class = tier after §3 3.6.1 conditioning'],
          rows, "E4. Inheritor outcomes by hidden tier")
    return out


def part_E_sweep(pools):
    global LB_DISC, MAINT_MULT, DIG_FROZEN, ARID_MAKEUP
    print("\nE5. Lever sensitivity (P1 rules, n = %d per cell; cautious bot unless noted)" % N_SWEEP)
    rows = []
    base = (LB_DISC, MAINT_MULT, DIG_FROZEN, ARID_MAKEUP, START['bootstrapper']['cash'])
    levers = [('baseline (current sections)', {}),
              ('game.start.inheritor.companyCashUsd 250k → 300k', dict(inh=dict(cash=300000))),
              ("game.inheritor.noteSchedule 'seasonal' → 'level'", dict(inh=dict(note='level'))),
              ('game.inheritor.preStrippedBlocks 2 → 0', dict(inh=dict(prestrip=0))),
              ('game.start.bootstrapper.companyCashUsd 400k → 325k', dict(BOOT_CASH=325000)),
              ('market.localBuyer.discount 0.10 → 0.08', dict(LB_DISC=0.08)),
              ('fleet.p1MaintUsdPerHr × 0.85', dict(MAINT_MULT=0.85)),
              ('ops.digMult gravel frozen 0.35 → 0.50', dict(DIG_FROZEN=0.50)),
              ('ops.makeupFrac.arid 0.15 → 0.20', dict(ARID_MAKEUP=0.20))]
    for nm, kv in levers:
        LB_DISC, MAINT_MULT, DIG_FROZEN, ARID_MAKEUP, START['bootstrapper']['cash'] = base
        inh = kv.get('inh')
        for k, v in kv.items():
            if k == 'BOOT_CASH':
                START['bootstrapper']['cash'] = v
            elif k != 'inh':
                globals()[k] = v
        ECON.clear()
        DRAWDOWN.clear()
        cfg = [('careful', 'bootstrapper'), ('careful', 'backed'), ('undercap', 'bootstrapper')]
        res = run_mc(pools, N_SWEEP, 'p1', configs=cfg, seed0=555)
        res.update(run_mc(pools, N_SWEEP, 'p1', configs=[('careful', 'inheritor')], seed0=555, inh=inh))
        a, b = summarize(res[('careful', 'bootstrapper')]), summarize(res[('careful', 'backed')])
        u, ih = summarize(res[('undercap', 'bootstrapper')]), summarize(res[('careful', 'inheritor')])
        METRICS[('sweep', nm)] = (a, b, ih, u)
        rows.append([nm, f"{100 * a['going']:.0f}", f"{100 * a['fp']:.0f}", f"{a['nw']:.2f}", f"{100 * a['arid']:.0f}%",
                     f"{100 * b['going']:.0f}", f"{100 * ih['going']:.0f}", f"{100 * ih['m1']:.0f}", f"{100 * u['going']:.0f} / {100 * u['surv']:.0f}"])
    LB_DISC, MAINT_MULT, DIG_FROZEN, ARID_MAKEUP, START['bootstrapper']['cash'] = base
    ECON.clear()
    DRAWDOWN.clear()
    table(['lever', 'Boot S2 %', 'Boot first profit %', 'Boot NW p50', 'Boot arid share', 'Backed S2 %', 'Inheritor S2 %',
           'Inheritor s1 attempt %', 'undercap S2 / B2 %'], rows)


def part_E_backgrounds(pools):
    print("\nE6. Owner-background parity (O-07; P1 rules, cautious bot, n = %d per cell; P1 stubs per §1 1.7)" % N_SWEEP)
    rows = []
    bgs = ['none', 'operator', 'mechanic', 'geologist', 'banker', 'landman']
    for start in ('bootstrapper', 'backed'):
        vals = {}
        for bg in bgs:
            rs = [play('careful', start, 'p1', R(424242 + 7919 * i), pools, background=bg) for i in range(N_SWEEP)]
            vals[bg] = summarize(rs)
        mu = mean([vals[bg]['going'] for bg in bgs[1:]])
        for bg in bgs:
            v = vals[bg]
            rows.append([start, bg, f"{100 * v['going']:.0f}", f"{100 * (v['going'] - mu):+.0f}" if bg != 'none' else '-',
                         f"{v['nw']:.2f}", f"{100 * v['up']:.0f}", f"{100 * v['fp']:.0f}"])
        METRICS[('bg', start)] = (vals, mu)
    table(['start', 'background', 'S2 %', 'Δ vs mean of the five', 'NW ratio y2 p50', 'owner NW y2 >= start %',
           'first-season profit %'], rows)
    # the EC-11 fallback for the Mechanic edge
    rs = [play('careful', 'bootstrapper', 'p1', R(424242 + 7919 * i), pools, background='mechanic80') for i in range(N_SWEEP)]
    METRICS['mech80'] = summarize(rs)


def part_E_five_years(pools):
    print("\nE7. Five-year runs (O-04 dominance, O-06 year-5 NW, O-14 cost per ounce, O-15 profitable claims; n = %d per cell)" % N_Y5)
    out = {}
    for rules in ('p1', 'full'):
        res = run_mc(pools, N_Y5, rules, configs=Y5_CONFIGS, seed0=900000, years=5)
        out[rules] = res
        rows = []
        for (strat, start), rs in res.items():
            n = len(rs)
            s2 = mean([r['going'] for r in rs])                        # going concern measured at the end of year 5 here
            b5 = mean([r['survived'] for r in rs])
            nw2 = [nw_ratio(r, 1) for r in rs]
            nw5 = [nw_ratio(r, 4) for r in rs]
            cl = [c for r in rs for c in r['claims']]
            prof = mean([c['pl'] > 0 for c in cl]) if cl else float('nan')
            seas = [x for r in rs for x in r['seasons']]
            cash = pct([x['cash'] for x in seas], .5) if seas else float('nan')
            aisc = pct([x['aisc'] / x['realized'] for x in seas if x['realized'] > 0], .5) if seas else float('nan')
            flip = mean([x['margin'] > 0 and x['net'] < 0 for x in seas]) if seas else float('nan')
            up5 = mean([v >= 1.0 for v in nw5])                         # owner ahead of starting NW at the end of year 5
            METRICS[('y5', rules, strat, start)] = dict(b5=b5, s5=s2, nw2=pct(nw2, .5), nw5=pct(nw5, .5), nw5_90=pct(nw5, .9), up5=up5,
                                                        nw5_10=pct(nw5, .1), prof=prof, ncl=len(cl), cash=cash, aisc=aisc, flip=flip,
                                                        nseas=len(seas))
            rows.append([BOT_LABEL[strat], start, n, f"{100 * b5:.0f}", f"{100 * s2:.0f}",
                         ' / '.join(f"{pct(nw2, q):.2f}" for q in (.1, .5, .9)), ' / '.join(f"{pct(nw5, q):.2f}" for q in (.1, .5, .9)),
                         f"{100 * up5:.0f}%", f"{100 * prof:.0f}% of {len(cl)}", f"{cash:,.0f}", f"{100 * aisc:.0f}%", f"{100 * flip:.0f}%"])
        table(['bot', 'start', 'n', 'B5 %', 'S5 % (going at y5)', 'NW ratio y2 p10/50/90', 'NW ratio y5 p10/50/90', 'NW y5 >= start',
               'claims profitable (reduced M-CLAIMPROFIT)', 'cash cost/oz p50 (producing seasons)', 'AISC ÷ realized p50',
               'M-FLIP share'], rows, f"E7{'a' if rules == 'p1' else 'b'}. Rules = {rules.upper()}, 5 years")
    return out


def part_E_levers(pools):
    """Lever checks behind BALANCE §8.3 R-1 (permitStub) and R-3 (Inheritor cash), n = N_MC on the E1/E2 seeds."""
    global PERMIT_STUB
    print("\nE8. Lever checks for BALANCE §8.3 (cautious bot, n = %d per cell, E1/E2 seeds)" % N_MC)
    rows = []
    starts = ('bootstrapper', 'backed', 'backedRoyalty', 'inheritor')
    cfg = [('careful', st) for st in starts] + [('undercap', 'bootstrapper')]

    def pooled_of(o, key):
        return (o[('careful', 'bootstrapper')][key] + 0.5 * (o[('careful', 'backed')][key] + o[('careful', 'backedRoyalty')][key])
                + o[('careful', 'inheritor')][key]) / 3

    def row(label, rules, o, share):
        rows.append([label, rules.upper(), share] + [f"{100 * o[('careful', st)]['going']:.0f}" for st in starts]
                    + [f"{100 * pooled_of(o, 'going'):.0f}", f"{100 * pooled_of(o, 'fp'):.0f}", f"{100 * pooled_of(o, 'surv'):.0f}",
                       f"{100 * o[('undercap', 'bootstrapper')]['going']:.0f} / {100 * o[('undercap', 'bootstrapper')]['surv']:.0f}"])
        METRICS[('lever', label, rules)] = dict(pooled=pooled_of(o, 'going'), fp=pooled_of(o, 'fp'),
                                                 **{st: o[('careful', st)]['going'] for st in starts})

    def summ(res):
        return {k: summarize(v) for k, v in res.items()}

    base_share = f"{100 * METRICS['planShare_north']:.1f}%"
    inh = dict(cash=300000)
    for rules in ('p1', 'full'):
        o = {k: METRICS[('mc', rules) + k] for k in cfg}
        row('current sections', rules, o, base_share)
        res = run_mc(pools, N_MC, rules, configs=[c for c in cfg if c[1] != 'inheritor'])
        res.update(run_mc(pools, N_MC, rules, configs=[('careful', 'inheritor')], inh=inh))
        row('R-3 game.start.inheritor.companyCashUsd 300k', rules, summ(res), base_share)
    saved = dict(PERMIT_STUB)
    PERMIT_STUB = dict(minLastSeasonYear=2000, planP=0.60, noticeP=0.20)
    try:
        pools2 = make_world(R(SEED), NDIST)
        held, w, _ = pools2['north']
        share = f"{100 * sum(wt for c, wt in zip(held, w) if c.get('permit') == 'plan') / sum(w):.1f}%"
        held, w, _ = pools2['arid']
        METRICS['planShare_R1_arid'] = sum(wt for c, wt in zip(held, w) if c.get('permit') == 'plan') / sum(w)
        METRICS['planShare_R1_north'] = float(share[:-1]) / 100
        o = summ(run_mc(pools2, N_MC, 'full', configs=cfg))
        row('R-1 permitStub 2000 / 0.60 / 0.20', 'full', o, share)
        res = run_mc(pools2, N_MC, 'full', configs=[c for c in cfg if c[1] != 'inheritor'])
        res.update(run_mc(pools2, N_MC, 'full', configs=[('careful', 'inheritor')], inh=inh))
        row('R-1 + R-3', 'full', summ(res), share)
    finally:
        PERMIT_STUB = saved
    table(['lever', 'rules', 'north plan-authority share', 'S2 Boot', 'S2 Backed eq', 'S2 Backed roy', 'S2 Inheritor',
           'pooled S2', 'pooled FSP', 'pooled B2', 'undercap S2 / B2'], rows)
    print("  R-1 regenerates the world with the new stub draw (another world on the same seed); R-3 changes only the Inheritor start.")


def part_G():
    """Calendar (T-12) and price cross-check (O-11)."""
    print("\n" + "=" * 100)
    print("PART G. CALENDAR (T-12) AND PRICE CROSS-CHECK (O-11)")
    print("=" * 100)
    rng = R(SEED + 5)
    site_w, sluice_w, arid_w = [], [], []
    for i in range(N_CAL):
        wk, sm = make_year('north', rng)
        site_w.append(sm['opWeeks'])
        op = ref_backed()
        full = op.days * op.hours
        eff = 0.0
        for x in wk:
            if x['phase'] == 'operating':
                eff += (0.80 if x['band'] == 'cool' else 1.0)
            elif x['phase'] == 'freezeup':
                eff += 0.6
        sluice_w.append(eff * 0.92 * (0.85 + 0.15 * 0.40) / 1.0)           # × p1MechAvailability × foreman F(40)
        wa, _ = make_year('arid', rng, hours=10)
        arid_w.append(sum(x['W'] for x in wa))
    print(f"  north site season (operating weeks, §1 calendar): p10/p50/p90 {pct(site_w, .1):.0f} / {pct(site_w, .5):.0f} / {pct(site_w, .9):.0f};"
          f" mean {mean(site_w):.1f}")
    print(f"  north effective sluicing weeks (cool-week 0.80, freeze-up 0.6, × A 0.92 × F 0.91): p50 {pct(sluice_w, .5):.1f}"
          f" (without A and F: {pct(sluice_w, .5) / (0.92 * 0.91):.1f})")
    print(f"  arid effective day-shift weeks (Σ heat × fire hours factor, 6 × 10 h): p10/p50/p90 {pct(arid_w, .1):.1f} / {pct(arid_w, .5):.1f}"
          f" / {pct(arid_w, .9):.1f}")
    METRICS['cal'] = dict(site=pct(site_w, .5), sluice=pct(sluice_w, .5) / (0.92 * 0.91), sluiceAF=pct(sluice_w, .5), arid=pct(arid_w, .5))
    falls = 0
    for i in range(N_PRICE):
        pth = price_path(R(31000 + i), 52)
        if pth[-1] / SPOT < 0.85:
            falls += 1
    METRICS['fall15'] = falls / N_PRICE
    print(f"  P(gold falls > 15 % in year 1), this model's price path (no macro, no fair-value pull): {100 * METRICS['fall15']:.1f}%"
          f" over {N_PRICE} seeds (§10 10.5 states 12 %)")


def part_F():
    print("\n" + "=" * 100)
    print("PART F. TARGET SCORECARD INPUTS (preflight; BALANCE.md §9 assigns the status)")
    print("=" * 100)
    M = METRICS
    rows = []
    pn, pa = M['pool_north'], M['pool_arid']
    rows.append(['T-01', 'mined grade p10/p50/p90 N; A; PS bcy in band N/A; pockets N/A',
                 f"{M['minedGrade_north'][0]:.3f}/{M['minedGrade_north'][1]:.3f}/{M['minedGrade_north'][2]:.3f}; "
                 f"{M['minedGrade_arid'][0]:.3f}/{M['minedGrade_arid'][1]:.3f}/{M['minedGrade_arid'][2]:.3f}; "
                 f"{100 * M['psInBand_north']:.0f}%/{100 * M['psInBand_arid']:.0f}%; {100 * M['pockets_north']:.2f}%/{100 * M['pockets_arid']:.2f}%"])
    rows.append(['T-02', '§3 yardstick listing pool N; A', f"{pn[0]:.1f}/{pn[1]:.1f}/{pn[2]:.1f}/{pn[3]:.1f}; {pa[0]:.1f}/{pa[1]:.1f}/{pa[2]:.1f}/{pa[3]:.1f}"])
    on, oa = M['op_refSmallNorth_north'], M['op_Arid_arid']
    rows.append(['T-03', 'EconTest refSmallNorth; arid starter', f"{on[0]:.1f}/{on[1]:.1f}/{on[2]:.1f}/{on[3]:.1f}; {oa[0]:.1f}/{oa[1]:.1f}/{oa[2]:.1f}/{oa[3]:.1f}"])
    rows.append(['T-04', 'bcy/hr season 2: starterNorth, inheritorNorth, starterArid (d / d1 / d2)',
                 f"{M[('starterNorth', 2)]['rate']:.0f}, {M[('inheritorNorth', 2)]['rate']:.0f}, {M[('starterArid', 2)]['rate']:.0f} / "
                 f"{M[('starterAridWellOnly', 2)]['rate']:.0f} / {M[('starterAridWell300', 2)]['rate']:.0f}"])
    rows.append(['T-05', 'matureNorth bcy/hr; bcy season 2', f"{M[('matureNorth', 2)]['rate']:.0f}; {M[('matureNorth', 2)]['washed']:,.0f}"])
    r1, r2 = M[('refSmallNorth', 1)], M[('refSmallNorth', 2)]
    rows.append(['T-06', 'refSmallNorth s2 bcy / raw oz / fine oz; s1 bcy (share of s2)',
                 f"{r2['washed']:,.0f} / {r2['raw']:,.0f} / {r2['fine']:,.0f}; {r1['washed']:,.0f} ({100 * r1['washed'] / r2['washed']:.0f}%)"])
    fx = [k for k in ('starterNorth', 'refSmallNorth', 'matureNorth', 'starterArid', 'inheritorNorth')]
    rows.append(['T-07', 'fuel+wages / R&M / fuel share of site opex (s2): ' + ', '.join(fx),
                 '; '.join(f"{100 * M[(k, 2)]['fw']:.0f}/{100 * M[(k, 2)]['maint'] / M[(k, 2)]['so']:.0f}/{100 * M[(k, 2)]['fuel'] / M[(k, 2)]['so']:.0f}" for k in fx)])
    m0 = M[('refSmallNorth', 2)]['rev'] - M[('refSmallNorth', 2)]['so']
    rR = M[('refSmallNorthRoyalty', 2)]
    rD = M[('refSmallNorthDebt', 2)]
    mR = rR['rev'] + rR['roy'] - rR['so']                                 # operating margin before royalties (BALANCE M-MARGIN)
    mD = rD['rev'] + rD['roy'] - rD['so']
    METRICS['T08'] = (m0, mR, rR['roy'] / mR, mD, (rD['roy'] + rD['ds']) / mD, rR['after'], rD['after'])
    rows.append(['T-08', 'refSmallNorth s2 margin; royalty variant royalty/margin; debt variant (royalty+debt)/margin; nets',
                 f"{fmt_k(m0)}; {fmt_k(rR['roy'])}/{fmt_k(mR)} = {rR['roy'] / mR:.2f}; ({fmt_k(rD['roy'])}+{fmt_k(rD['ds'])})/{fmt_k(mD)}"
                 f" = {(rD['roy'] + rD['ds']) / mD:.2f}; net {fmt_k(rR['after'])} / {fmt_k(rD['after'])}"])
    rows.append(['T-09', 'P1 used asks ex30 / ld966 / adt30 at grade B and C',
                 '; '.join(f"{m} {fmv_used(m, 'B') / 1e3:.0f}k/{fmv_used(m, 'C') / 1e3:.0f}k" for m in ('ex30', 'ld966', 'adt30'))])
    BE = M['BE']
    rows.append(['T-10', 'refSmallNorth BE SR3 p0.8 opex/+roy/+cap; mature ratio (local, refinery)',
                 '/'.join(f"{x:.4f}" for x in BE[('refSmallNorth', 0.8, 3)]) + f"; {M['matureRatio'][0]:.2f}, {M['matureRatio'][1]:.2f}, thawed {M['matureRatio'][2]:.2f}"])
    c2 = M['c2_level']
    rows.append(['T-11', 'refSmallNorthDebt level: min month-end, month, drawdown ÷ outflows, year net',
                 f"{fmt_k(c2['min'])}, {c2['month']}, {100 * c2['draw'] / c2['outflow']:.0f}%, {fmt_k(c2['net'])}"])
    cal = M['cal']
    rows.append(['T-12', 'north site season p50; sluicing weeks p50; arid effective weeks p50',
                 f"{cal['site']:.0f}; {cal['sluice']:.1f}; {cal['arid']:.1f}"])
    for rules in ('p1', 'full'):
        g = {st: M[('mc', rules, 'careful', st)] for st in ('bootstrapper', 'backed', 'backedRoyalty', 'inheritor')}
        rows.append([f'O-01 {rules}', 'cautious S2 Boot / Backed eq / Backed roy / Inh; pooled; pooled B2',
                     ' / '.join(f"{100 * g[k]['going']:.0f}" for k in g) + f"; {100 * pooled(M, rules):.0f}; {100 * pooled(M, rules, 'surv'):.0f}"])
        fps = {f"{BOT_LABEL[k[2]]}/{k[3][:4]}": v['fp'] for k, v in M.items() if isinstance(k, tuple) and k[:2] == ('mc', rules)}
        rows.append([f'O-02 {rules}', 'cautious pooled FSP; max any bot; min any bot',
                     f"{100 * pooled(M, rules, 'fp'):.0f}; {100 * max(fps.values()):.0f} ({max(fps, key=fps.get)}); {100 * min(fps.values()):.0f}"])
        u = M[('mc', rules, 'undercap', 'bootstrapper')]
        rows.append([f'O-03 {rules}', 'undercap S2; B2', f"{100 * u['going']:.0f}; {100 * u['surv']:.0f}"])
        ih = M[('mc', rules, 'careful', 'inheritor')]
        rows.append([f'O-06 {rules}', 'Inheritor season-1 attempt', f"{100 * ih['m1']:.0f}"])
    for d_ in ('easy', 'standard', 'hard'):
        pass
    de = [M[('diff', d_, 'careful', 'bootstrapper')] for d_ in ('easy', 'standard', 'hard')]
    db = [M[('diff', d_, 'careful', 'backed')] for d_ in ('easy', 'standard', 'hard')]
    rows.append(['O-05', 'cautious S2 easy/std/hard Boot; Backed; B2 Boot',
                 '/'.join(f"{100 * x['going']:.0f}" for x in de) + '; ' + '/'.join(f"{100 * x['going']:.0f}" for x in db) + '; '
                 + '/'.join(f"{100 * x['surv']:.0f}" for x in de)])
    for start in ('bootstrapper', 'backed'):
        vals, mu = M[('bg', start)]
        rows.append([f'O-07 {start}', 'S2 by background (operator/mechanic/geologist/banker/landman); mean',
                     '/'.join(f"{100 * vals[b]['going']:.0f}" for b in ('operator', 'mechanic', 'geologist', 'banker', 'landman')) + f"; {100 * mu:.0f}"])
        upm = mean([vals[b]['up'] for b in ('operator', 'mechanic', 'geologist', 'banker', 'landman')])
        rows.append([f'O-07 {start} NW', 'owner NW y2 >= start % by background (same order); mean',
                     '/'.join(f"{100 * vals[b]['up']:.0f}" for b in ('operator', 'mechanic', 'geologist', 'banker', 'landman')) + f"; {100 * upm:.0f}"])
    for start in ('bootstrapper', 'backed'):
        a, b = M[('mc', 'p1', 'careful', start)], M[('mc', 'p1', 'carefulNoTest', start)]
        rows.append([f'O-08 {start}', 'P1 S2 gain cautious − noTest (pp); NW y2 p50 gain; owner-ahead gain (pp); testing ÷ commitment',
                     f"{100 * (a['going'] - b['going']):+.0f}; {a['nw'] - b['nw']:+.2f}; {100 * (a['up'] - b['up']):+.0f}; {100 * a['explore_share']:.0f}%"])
    for rules in ('p1', 'full'):
        y = lambda st, b='careful': M[('y5', rules, b, st)]
        rows.append([f'O-04 {rules}', 'Bootstrapper cautious / balanced / aggressive: S5; NW y5 p50; NW y5 p90',
                     ' / '.join(f"{100 * y('bootstrapper', b)['s5']:.0f}" for b in ('careful', 'balanced', 'aggressive')) + '; '
                     + ' / '.join(f"{y('bootstrapper', b)['nw5']:.2f}" for b in ('careful', 'balanced', 'aggressive')) + '; '
                     + ' / '.join(f"{y('bootstrapper', b)['nw5_90']:.2f}" for b in ('careful', 'balanced', 'aggressive'))])
        sts = ('bootstrapper', 'backed', 'backedRoyalty', 'inheritor')
        rows.append([f'O-06b {rules}', 'cautious NW y5 p50 Boot/Backed/BackedRoy/Inh; owner ahead at y5 %',
                     '/'.join(f"{y(st)['nw5']:.2f}" for st in sts) + '; ' + '/'.join(f"{100 * y(st)['up5']:.0f}" for st in sts)])
        rows.append([f'O-14 {rules}', 'cautious cash cost/oz p50 and AISC ÷ realized p50, Boot/Backed/BackedRoy/Inh',
                     '/'.join(f"{y(st)['cash']:,.0f}" for st in sts) + '; ' + '/'.join(f"{100 * y(st)['aisc']:.0f}%" for st in sts)])
        cl = sum(y(st)['prof'] * y(st)['ncl'] for st in sts) / sum(y(st)['ncl'] for st in sts)
        rows.append([f'O-15 {rules}', 'claims profitable: cautious (claim-weighted over starts); aggressive Boot; undercap',
                     f"{100 * cl:.0f}%; {100 * y('bootstrapper', 'aggressive')['prof']:.0f}%; {100 * y('bootstrapper', 'undercap')['prof']:.0f}%"])
    rows.append(['T-15', 'north (arid) listing-pool share with plan authority: current; with R-1',
                 f"{100 * M['planShare_north']:.1f}% ({100 * M['planShare_arid']:.1f}%); {100 * M['planShare_R1_north']:.1f}% ({100 * M['planShare_R1_arid']:.1f}%)"])
    for (lab, ru) in (('R-3 game.start.inheritor.companyCashUsd 300k', 'p1'), ('R-3 game.start.inheritor.companyCashUsd 300k', 'full'),
                      ('R-1 permitStub 2000 / 0.60 / 0.20', 'full'), ('R-1 + R-3', 'full')):
        v = M[('lever', lab, ru)]
        rows.append([f'O-01 {ru} {lab.split()[0]}' if lab != 'R-1 + R-3' else 'O-01 full R-1+R-3',
                     'pooled cautious S2; Inheritor S2; pooled FSP', f"{100 * v['pooled']:.0f}; {100 * v['inheritor']:.0f}; {100 * v['fp']:.0f}"])
    rows.append(['O-11', 'P(year-1 fall > 15 %), model price path', f"{100 * M['fall15']:.1f}%"])
    rows.append(['O-16', 'cautious Bootstrapper arid share P1 / FULL',
                 f"{100 * M[('mc', 'p1', 'careful', 'bootstrapper')]['arid']:.0f}% / {100 * M[('mc', 'full', 'careful', 'bootstrapper')]['arid']:.0f}%"])
    table(['target', 'measure', 'preflight value'], rows)


def print_simplifications():
    print("\n" + "=" * 100)
    print("SIMPLIFICATIONS (this is a sanity check, not the simulator)")
    print("=" * 100)
    for x in [
        "Geology: creek network, parcel layout and dredged stretches simplified (independent creeks); no tailings piles as feed;"
        " recentCat history gaps drawn at 0.2 per season (§3 says 'occasional'); Inheritor run drawn from three generated 20-ac creek parcels.",
        "Operations: weekly aggregation of §7's hour-block flow (stages capped per week, pad buffer 1,500 bcy); thaw per §7.4 on queue blocks;"
        " single cut, best-first block order (no contiguity), fixed haul distance and push distance; no concurrent reclamation hours.",
        "Recovery: §7.9 capture with φ, skill, cold, prep, clay, oversize; riffle loading ignored (cleanup every 2 weeks); gold room per §7.10.",
        "Costs: P1 flat maintenance (§9) in every rule set (FULL adds P3 availability by grade only); no breakdowns, parts lead times or"
        " winter rebuilds, except the §11.15 fixture, which moves $110k of R&M cash into Jan-Apr.",
        "Staff: wages at résumé-free asks (skill 50/55), remote premium and the spring-rush multiplier; no morale, quits, injuries or fatigue.",
        "Land: §5 asks, reservations, royalties, AMR and structures by situation; negotiated price = max(reservation, 0.8 × ask); no title"
        " defects, closings or first look; P1 leases instant; the starter permitted lease (P2+) is added to the year-1 market.",
        "Sellers: honesty mix, tilts and transforms per §3.10 applied to a claim-level 'honest' grade (no per-sample draws); evidence class"
        " from §3.10.3's rules in reduced form.",
        "Estimation: §4 not run; estimate error drawn as lognormal noise calibrated to §4.9 (indicated: claim sd 0.18, block sd 0.45).",
        "Finance: P1 insolvency counter (bankrupt after finance.p1InsolvencyGraceWeeks open weeks, after a last-resort dealer sale of the"
        " fleet); FULL adds equipment loans (aggressive, undercap), hard money (aggressive, undercap), insurance, G&A, the §6 plan delay"
        " (20 weeks of preparation + LN(40 wk, 0.6) review) and a surety bond; no covenants, cards, revolver or taxes.",
        "Market: FULL price = regime GARCH + jumps without macro or fair-value pull; diesel AR(1); no ripples on wages, iron or land prices.",
        "Events and competitors: not modeled beyond season-length variance; competitors do not bid against the bots; no investor"
        " check-ins, so no Backed ouster.",
        "Bots: reduced versions of BALANCE.md §4 / §2.12.1 (20 random listings plus, in FULL year 1, two starter leases, seen once a year;"
        " one claim at a time; aggressive takes no second claim).",
        "Hard rock (§14) is not modeled: §14.13's lode generator, refEconomicsLode and the hardrockSeeker bot are not in this model.",
    ]:
        print("  - " + x)


def main():
    global NDIST, N_MC, N_SWEEP, N_Y5, N_CAL, N_PRICE
    NDIST = 12 if FAST else 40
    N_MC = 60 if FAST else 500
    N_SWEEP = 40 if FAST else 200
    N_Y5 = 30 if FAST else 300
    N_CAL = 100 if FAST else 500
    N_PRICE = 300 if FAST else 2000
    print("GOLD MINING TYCOON — PREFLIGHT ECONOMIC MODEL" + ("  [FAST]" if FAST else ""))
    print(f"seed {SEED}; districts per template {NDIST}; MC games per cell {N_MC} (2 years), {N_Y5} (5 years); sweeps {N_SWEEP}")
    rng = R(SEED)
    pools = make_world(rng, NDIST)
    nplan = {tn: mean([c.get('permit') == 'plan' for c in pools[tn][0]]) for tn in pools}
    print(f"world generated: north {len(pools['north'][2])} parcels, arid {len(pools['arid'][2])} parcels ({time.time() - T0:.0f}s);"
          f" held parcels with a true plan stub: north {100 * nplan['north']:.1f}%, arid {100 * nplan['arid']:.1f}%")
    for tn in pools:
        held, w, _ = pools[tn]
        METRICS['planShare_' + tn] = sum(wt for c, wt in zip(held, w) if c.get('permit') == 'plan') / sum(w)
    print(f"  listing-pool share with true plan authority (steady-state weights): north {100 * METRICS['planShare_north']:.1f}%,"
          f" arid {100 * METRICS['planShare_arid']:.1f}% (§3 3.11 / §5 5.20 gate: ≥ 8 % north)")
    part_A(pools)
    part_B()
    part_C()
    part_D()
    part_E(pools)
    part_E_sweep(pools)
    part_E_backgrounds(pools)
    part_E_five_years(pools)
    part_E_levers(pools)
    part_G()
    part_F()
    print_simplifications()
    print(f"\nrun time {time.time() - T0:.0f}s")


if __name__ == '__main__':
    main()
