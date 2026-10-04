// Calibration sim for §10 gold price + macro model (scratch, not shipped).
// Uses Math.* freely; the engine version uses dmath + xoshiro.
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const u = mulberry32(seed);
  let spare = null;
  const r = {
    u,
    n() {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let a = 0; while (a === 0) a = u();
      const b = u();
      const m = Math.sqrt(-2 * Math.log(a));
      spare = m * Math.sin(2 * Math.PI * b);
      return m * Math.cos(2 * Math.PI * b);
    },
    t5() { // student t nu=5 scaled to unit variance
      const z = r.n(); let c = 0; for (let i = 0; i < 5; i++) { const x = r.n(); c += x * x; }
      return z / Math.sqrt(c / 5) * Math.sqrt(3 / 5);
    },
    exp(mean) { return -Math.log(1 - u()) * mean; },
  };
  return r;
}

const P = {
  dt: 1 / 52,
  // regimes
  mu: { bull: 0.18, range: 0.02, bear: -0.14 },
  volM: { bull: 1.10, range: 0.80, bear: 1.10 },
  exitP: { bull: 0.0050, range: 0.0096, bear: 0.0070 },
  toBearFromBull: 0.30, toBullFromRange: 0.50, toBullFromBear: 0.40,
  etaV: 2.0, etaM: 0.5, etaSplitV: 1.5, etaSplitM: 0.5,
  hazLo: 0.4, hazHi: 3.0,
  // garch
  sbar: 0.0190, alpha: 0.07, gammaUp: 0.03, beta: 0.88, sigLo: 0.008, sigHi: 0.065,
  // jumps
  jumpP: 0.025, jumpUp: { bull: 0.6, range: 0.5, bear: 0.4 }, jumpBase: 0.025, jumpExpMean: 0.02, jumpCap: 0.15,
  blowoffV: 0.25, blowoffUpShift: -0.25,
  // mean reversion
  kappa: 0.20, fvRealGrowth: 0.005, vLo: Math.log(0.40), vHi: Math.log(2.8),
  // macro drift betas
  bRR: -0.03, bCB: 0.02, bGeo: 0.0008, bEq: -0.04,
  // same-week
  piUsd: -0.6, piRR: -4.0, piGeo: 0.0012, piEq: 0.05,
  // macro processes
  pibar: 0.03, phiPi: 0.985, sigPi: 0.0020, thetaOil: 0.02,
  d0: 3.60, phiD: 0.98, sigD: 0.030, dSpikeP: 0.005, dSpikeLo: 0.12, dSpikeHi: 0.30, dGlutP: 0.005, dGlutLo: 0.10, dGlutHi: 0.30,
  eqbar: 0.2, phiEq: 0.96, sigEq: 0.06, crashP: 0.005, crashLo: 0.6, crashHi: 1.0,
  rNeutral: 0.01, phiT: 0.5, phiS: 0.015, polPhi: 0.98, polSig: 0.0005,
  phiU: 0.995, psiR: 2.0, psiS: -0.02, sigU: 0.009,
  cbLevels: { low: 350, normal: 650, high: 1000 }, cbExit: 0.006, cbAdj: 0.03, cbSig: 12, cbNeutral: 650,
  geoBar: 30, phiG: 0.97, sigG: 1.5, geoSpikeP: 0.02, geoSpikeLo: 12, geoSpikeHi: 35,
  meetingWeeks: new Set([5, 11, 18, 24, 31, 37, 44, 50]),
  S0: 4200, burnIn: 260,
};

function logistic(x) { return 1 / (1 + Math.exp(-x)); }
function logit(p) { return Math.log(p / (1 - p)); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function initState(rng) {
  const u = rng.u();
  const regime = u < 0.35 ? 'bull' : u < 0.75 ? 'range' : 'bear';
  return {
    week: 1, regime, h: P.sbar * P.sbar, lastE: 0, lnS: Math.log(P.S0), lnF: Math.log(P.S0), years: 0,
    pi: P.pibar, piExp: P.pibar, cpi: 1, lnD: Math.log(P.d0), lnDbar: Math.log(P.d0),
    eq: P.eqbar, base: 0.04, pol: 0, rr: 0.04 - P.pibar, lnU: Math.log(100),
    cbState: 'normal', cb: 650, geo: 30, hi26: [],
  };
}

function step(s, rng, rec) {
  const dt = P.dt;
  // --- macro ---
  s.cpiPrev = s.cpi;
  const lnDprev = s.lnD; const lnDbarPrev = s.lnDbar;
  // inflation uses this week's oil change; oil anchor uses last cpi
  s.lnDbar = Math.log(P.d0 * s.cpi);
  let dev = P.phiD * (lnDprev - lnDbarPrev) + P.sigD * rng.n();
  if (rng.u() < P.dSpikeP) dev += P.dSpikeLo + (P.dSpikeHi - P.dSpikeLo) * rng.u();
  if (rng.u() < P.dGlutP) dev -= P.dGlutLo + (P.dGlutHi - P.dGlutLo) * rng.u();
  dev = clamp(dev, Math.log(0.5), Math.log(2.5));
  s.lnD = s.lnDbar + dev;
  s.pi = clamp(P.pibar + P.phiPi * (s.pi - P.pibar) + P.thetaOil * (s.lnD - lnDprev) + P.sigPi * rng.n(), -0.02, 0.12);
  s.cpi = s.cpi * Math.pow(1 + s.pi, 1 / 52);
  s.piExp = s.piExp + (2 / 27) * (s.pi - s.piExp);
  const eqPrev = s.eq;
  let eq = P.eqbar + P.phiEq * (s.eq - P.eqbar) + P.sigEq * rng.n();
  let crash = false;
  if (rng.u() < P.crashP) { eq -= P.crashLo + (P.crashHi - P.crashLo) * rng.u(); crash = true; }
  s.eq = clamp(eq, -1, 1);
  s.pol = P.polPhi * s.pol + P.polSig * rng.n();
  const target = P.rNeutral + s.piExp + P.phiT * (s.piExp - P.pibar) + P.phiS * (s.eq - P.eqbar) + s.pol;
  const gap = target - s.base;
  const rrPrev = s.rr;
  if (P.meetingWeeks.has(s.week)) {
    if (Math.abs(gap) >= 0.00625) s.base += Math.sign(gap) * 0.005;
    else if (Math.abs(gap) >= 0.00125) s.base += Math.sign(gap) * 0.0025;
  } else if (crash && s.base >= 0.005 && gap < -0.005) {
    s.base -= 0.005;
  }
  s.base = clamp(Math.round(s.base / 0.0025) * 0.0025, 0, 0.10);
  s.rr = s.base - s.piExp;
  const lnUprev = s.lnU;
  s.lnU = s.lnU + (1 - P.phiU) * (Math.log(100) - s.lnU) + P.psiR * (s.rr - rrPrev) + P.psiS * (s.eq - eqPrev) + P.sigU * rng.n();
  s.lnU = clamp(s.lnU, Math.log(70), Math.log(140));
  if (rng.u() < P.cbExit) {
    const geoTilt = clamp(0.5 + 0.01 * (s.geo - 30), 0.2, 0.9);
    const x = rng.u();
    if (s.cbState === 'low') s.cbState = x < 0.8 ? 'normal' : 'high';
    else if (s.cbState === 'normal') s.cbState = x < geoTilt ? 'high' : 'low';
    else s.cbState = x < 0.85 ? 'normal' : 'low';
  }
  s.cb = s.cb + P.cbAdj * (P.cbLevels[s.cbState] - s.cb) + P.cbSig * rng.n();
  const geoPrev = s.geo;
  let g = P.geoBar + P.phiG * (s.geo - P.geoBar) + P.sigG * rng.n();
  if (rng.u() < P.geoSpikeP) g += P.geoSpikeLo + (P.geoSpikeHi - P.geoSpikeLo) * rng.u();
  s.geo = clamp(g, 5, 100);

  // --- gold ---
  const muMacro = P.bRR * (s.rr - P.rNeutral) * 100 + P.bCB * (s.cb - P.cbNeutral) / 100 + P.bGeo * (s.geo - P.geoBar) + P.bEq * (s.eq - P.eqbar);
  s.years += dt;
  s.lnF = Math.log(s.F0 || P.S0) + Math.log(s.cpi) + P.fvRealGrowth * s.years;
  const v = s.lnS - s.lnF;
  // regime transition
  let haz = P.exitP[s.regime];
  if (s.regime === 'bull') haz *= clamp(Math.exp(P.etaV * Math.max(0, v) - P.etaM * muMacro / 0.05), P.hazLo, P.hazHi);
  if (s.regime === 'bear') haz *= clamp(Math.exp(P.etaV * Math.max(0, -v) + P.etaM * muMacro / 0.05), P.hazLo, P.hazHi);
  const tau = P.etaSplitV * (-v) + P.etaSplitM * (muMacro / 0.05);
  if (rng.u() < haz) {
    const x = rng.u();
    if (s.regime === 'bull') s.regime = x < logistic(logit(P.toBearFromBull) - tau) ? 'bear' : 'range';
    else if (s.regime === 'bear') s.regime = x < logistic(logit(P.toBullFromBear) + tau) ? 'bull' : 'range';
    else s.regime = x < logistic(logit(P.toBullFromRange) + tau) ? 'bull' : 'bear';
  }
  // garch
  const m = P.volM[s.regime];
  const pers = P.alpha + P.gammaUp / 2 + P.beta;
  const omega = P.sbar * P.sbar * m * m * (1 - pers);
  s.h = omega + (P.alpha + (s.lastE > 0 ? P.gammaUp : 0)) * s.lastE * s.lastE + P.beta * s.h;
  const sig = clamp(Math.sqrt(s.h), P.sigLo, P.sigHi);
  const e = sig * rng.t5();
  s.lastE = e;
  // jump
  let J = 0;
  if (rng.u() < P.jumpP) {
    let pUp = P.jumpUp[s.regime];
    const atHigh = s.hi26.length > 0 && s.lnS >= Math.max(...s.hi26);
    if (v > P.blowoffV && atHigh) pUp += P.blowoffUpShift;
    const size = Math.min(P.jumpCap, P.jumpBase + rng.exp(P.jumpExpMean));
    J = (rng.u() < pUp ? 1 : -1) * size;
  }
  const same = P.piUsd * (s.lnU - lnUprev) + P.piRR * (s.rr - rrPrev) + P.piGeo * (s.geo - geoPrev) + P.piEq * (s.eq - eqPrev);
  const ret = (P.mu[s.regime] + muMacro) * dt + P.kappa * (-v) * dt + same + e + J;
  let lnS = s.lnS + ret;
  let v2 = lnS - s.lnF;
  if (v2 > P.vHi) v2 = P.vHi - 0.5 * (v2 - P.vHi);
  if (v2 < P.vLo) v2 = P.vLo + 0.5 * (P.vLo - v2);
  lnS = s.lnF + v2;
  const realized = lnS - s.lnS;
  s.lnS = lnS;
  s.hi26.push(lnS); if (s.hi26.length > 26) s.hi26.shift();
  s.week = s.week % 52 + 1;
  if (rec) rec(realized, s, J !== 0, same, e);
}

function runPath(seed, years) {
  const rng = makeRng(seed);
  const s = initState(rng);
  s.F0 = P.S0;
  for (let i = 0; i < P.burnIn; i++) step(s, rng, null);
  // rescale: price to S0; F scaled equally; cpi reset to 1; years reset
  const v = s.lnS - s.lnF;
  s.F0 = P.S0 * Math.exp(-v) / s.cpi / Math.exp(P.fvRealGrowth * s.years); // so lnF recomputed equals lnS0 - v at t=0 with cpi=1, years=0
  s.F0 = P.S0 * Math.exp(-v);
  s.cpi = 1; s.years = 0; s.lnS = Math.log(P.S0); s.lnF = Math.log(s.F0);
  s.hi26 = s.hi26.map(x => x - (s.hi26[s.hi26.length - 1] - Math.log(P.S0)));
  const rets = []; const prices = [P.S0]; const regimes = []; const cpis = [1]; const diesel = []; const base = []; const infl = []; let jumps = 0;
  for (let i = 0; i < years * 52; i++) {
    step(s, rng, (r, st, j) => { rets.push(r); prices.push(Math.exp(st.lnS)); regimes.push(st.regime); cpis.push(st.cpi); diesel.push(Math.exp(st.lnD)); base.push(st.base); infl.push(st.pi); if (j) jumps++; });
  }
  return { rets, prices, regimes, cpis, diesel, base, infl, jumps, startV: v };
}

function quant(arr, q) { const a = [...arr].sort((x, y) => x - y); const i = clamp(Math.floor(q * (a.length - 1)), 0, a.length - 1); return a[i]; }

function stats(N, years) {
  const vols = []; const mdd = []; const end = []; const endReal = []; let dbl10 = 0, half10 = 0, dbl5 = 0, dd30in3 = 0, big10 = 0;
  let big5count = 0; let allR = []; const occ = { bull: 0, range: 0, bear: 0 };
  const startV = []; const dieselY5 = []; const baseAll = []; const inflAll = []; const maxRatio = []; const minRatio = [];
  const bullGains = []; const bearDDs = [];
  let jumpsTot = 0; const annR = []; const dur = { bull: [], range: [], bear: [] };
  for (let p = 0; p < N; p++) {
    const r = runPath(1000 + p, years);
    jumpsTot += r.jumps;
    for (let y = 0; y < years; y++) annR.push(Math.log(r.prices[(y + 1) * 52] / r.prices[y * 52]));
    startV.push(r.startV);
    const m = r.rets.reduce((a, b) => a + b, 0) / r.rets.length;
    const sd = Math.sqrt(r.rets.reduce((a, b) => a + (b - m) ** 2, 0) / (r.rets.length - 1));
    vols.push(sd * Math.sqrt(52));
    allR = allR.concat(r.rets.map(x => x - m));
    let peak = r.prices[0], dd = 0, mx = 1, mn = 1;
    for (let i = 0; i < r.prices.length; i++) {
      const px = r.prices[i]; peak = Math.max(peak, px); dd = Math.max(dd, 1 - px / peak);
      mx = Math.max(mx, px / r.prices[0]); mn = Math.min(mn, px / r.prices[0]);
      if (i === 5 * 52 && mx >= 2) dbl5++;
      if (i === 3 * 52 && dd >= 0.30) dd30in3++;
    }
    maxRatio.push(mx); minRatio.push(mn);
    mdd.push(dd); if (mx >= 2) dbl10++; if (mn <= 0.5) half10++;
    const e = r.prices[r.prices.length - 1] / r.prices[0]; end.push(e); endReal.push(e / r.cpis[r.cpis.length - 1]);
    for (const x of r.rets) { if (Math.abs(x) >= 0.05) big5count++; }
    if (r.rets.some(x => Math.abs(x) >= 0.10)) big10++;
    for (const g of r.regimes) occ[g]++;
    dieselY5.push(r.diesel[5 * 52 - 1]);
    baseAll.push(...r.base.filter((_, i) => i % 13 === 0)); inflAll.push(...r.infl.filter((_, i) => i % 13 === 0));
    // regime episode moves
    let i0 = 0;
    for (let i = 1; i <= r.regimes.length; i++) {
      if (i === r.regimes.length || r.regimes[i] !== r.regimes[i0]) {
        const g = r.regimes[i0];
        if (i0 > 0 && i < r.regimes.length) dur[g].push(i - i0);
        if (i - i0 >= (P.minEp || 26)) {
          const seg = r.prices.slice(i0, i + 1);
          if (g === 'bull') bullGains.push(seg[seg.length - 1] / seg[0] - 1);
          if (g === 'bear') { let pk = seg[0], d = 0; for (const x of seg) { pk = Math.max(pk, x); d = Math.max(d, 1 - x / pk); } bearDDs.push(d); }
        }
        i0 = i;
      }
    }
  }
  const n = allR.length; const v2 = allR.reduce((a, b) => a + b * b, 0) / n; const k4 = allR.reduce((a, b) => a + b ** 4, 0) / n;
  const tot = occ.bull + occ.range + occ.bear;
  const f = (x) => (100 * x).toFixed(1) + '%';
  console.log(`paths=${N} years=${years}`);
  console.log(`annVol median ${f(quant(vols, 0.5))} p10 ${f(quant(vols, 0.1))} p90 ${f(quant(vols, 0.9))}; pooled ${f(Math.sqrt(v2 * 52))}; excess kurt ${(k4 / v2 / v2 - 3).toFixed(2)}`);
  console.log(`maxDD median ${f(quant(mdd, 0.5))} p10 ${f(quant(mdd, 0.1))} p90 ${f(quant(mdd, 0.9))}`);
  console.log(`P(double in 10y) ${f(dbl10 / N)}  P(halve in 10y) ${f(half10 / N)}  P(double in 5y) ${f(dbl5 / N)}  P(DD>=30% in 3y) ${f(dd30in3 / N)}`);
  console.log(`S10/S0 nominal p10 ${quant(end, 0.1).toFixed(2)} p50 ${quant(end, 0.5).toFixed(2)} p90 ${quant(end, 0.9).toFixed(2)}; real p10 ${quant(endReal, 0.1).toFixed(2)} p50 ${quant(endReal, 0.5).toFixed(2)} p90 ${quant(endReal, 0.9).toFixed(2)}`);
  console.log(`|wk|>=5% per year ${(big5count / N / years).toFixed(2)}; P(any |wk|>=10% in 10y) ${f(big10 / N)}; jumps/yr ${(jumpsTot / N / years).toFixed(2)}`);
  console.log(`regime occupancy bull ${f(occ.bull / tot)} range ${f(occ.range / tot)} bear ${f(occ.bear / tot)}`);
  console.log(`start valuation v p10 ${quant(startV, 0.1).toFixed(2)} p50 ${quant(startV, 0.5).toFixed(2)} p90 ${quant(startV, 0.9).toFixed(2)}`);
  console.log(`bull episodes(>=26wk) n=${bullGains.length} gain p25 ${f(quant(bullGains, 0.25))} p50 ${f(quant(bullGains, 0.5))} p75 ${f(quant(bullGains, 0.75))} p90 ${f(quant(bullGains, 0.9))}`);
  console.log(`bear episodes(>=26wk) n=${bearDDs.length} maxDD p25 ${f(quant(bearDDs, 0.25))} p50 ${f(quant(bearDDs, 0.5))} p75 ${f(quant(bearDDs, 0.75))} p90 ${f(quant(bearDDs, 0.9))}`);
  console.log(`diesel at y5 p5 ${quant(dieselY5, 0.05).toFixed(2)} p50 ${quant(dieselY5, 0.5).toFixed(2)} p95 ${quant(dieselY5, 0.95).toFixed(2)}`);
  console.log(`base rate p5 ${f(quant(baseAll, 0.05))} p50 ${f(quant(baseAll, 0.5))} p95 ${f(quant(baseAll, 0.95))}; infl p5 ${f(quant(inflAll, 0.05))} p50 ${f(quant(inflAll, 0.5))} p95 ${f(quant(inflAll, 0.95))}`);
  { const m = annR.reduce((a,b)=>a+b,0)/annR.length; const sd = Math.sqrt(annR.reduce((a,b)=>a+(b-m)**2,0)/annR.length); console.log(`annual log-return sd ${f(sd)} mean ${f(m)}; complete regime durations (wks) median bull ${quant(dur.bull,0.5)} range ${quant(dur.range,0.5)} bear ${quant(dur.bear,0.5)}; mean bull ${(dur.bull.reduce((a,b)=>a+b,0)/dur.bull.length).toFixed(0)} range ${(dur.range.reduce((a,b)=>a+b,0)/dur.range.length).toFixed(0)} bear ${(dur.bear.reduce((a,b)=>a+b,0)/dur.bear.length).toFixed(0)}`); }
  console.log(`max S/S0 p50 ${quant(maxRatio, 0.5).toFixed(2)} p90 ${quant(maxRatio, 0.9).toFixed(2)}; min S/S0 p10 ${quant(minRatio, 0.1).toFixed(2)} p50 ${quant(minRatio, 0.5).toFixed(2)}`);
}

module.exports = { P, stats, runPath };
if (require.main === module) {
  const args = process.argv.slice(2);
  for (const a of args) { const [k, v] = a.split('='); if (k in P) P[k] = Number(v); }
  stats(2000, 10);
}
