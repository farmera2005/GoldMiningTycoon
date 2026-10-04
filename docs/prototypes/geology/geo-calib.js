// Calibration harness for DESIGN §3 block-model generator (scratch, not shipped).
// Implements the pseudo-code in 03-world-geology.md closely enough to check distribution targets.
'use strict';
const BLOCK_FT = 209, BCY_PER_ACRE_FT = 1613;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mkRng(seed) { const u = mulberry32(seed); let spare = null; return {
  u, n() { if (spare !== null) { const s = spare; spare = null; return s; } let a, b, r; do { a = 2 * u() - 1; b = 2 * u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const m = Math.sqrt(-2 * Math.log(r) / r); spare = b * m; return a * m; },
  ln(med, sig) { return med * Math.exp(sig * this.n()); },
  pick(w) { const ks = Object.keys(w); let t = 0; for (const k of ks) t += w[k]; let x = u() * t; for (const k of ks) { x -= w[k]; if (x <= 0) return k; } return ks[ks.length - 1]; },
  poisson(l) { if (l < 30) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= u(); } while (p > L); return k - 1; } return Math.max(0, Math.round(l + Math.sqrt(l) * this.n())); },
}; }

const TPL = {
  north: {
    gMed: +process.env.GN || 0.0105, sigDistrict: +(process.env.SD||0.25), sigCreek: +(process.env.SC||0.45), sigRich: +(process.env.SR||0.35), richRangeFt: 3000, sigClaim: +(process.env.SCL||0.20), sigBlock: 0.50,
    blockRangeAlongFt: 700, blockRangeAcrossFt: 120,
    halfWidthMedFt: 110, sigHalfWidth: 0.40, wanderSdFt: 140, bgRatio: 0.10,
    obMedFt: 15, sigObDistrict: 0.15, sigObCreek: 0.25, sigObAR: 0.25, sigObClaim: 0.15, sigObBlock: 0.15, obAxisBoost: 0.3,
    payMedFt: 5, sigPayCreek: 0.15, sigPayAR: 0.15, sigPayBlock: 0.15,
    bedrock: { schist: 0.65, slate: 0.15, granite: 0.15, basalt: 0.05 },
    deposit: { creek: 0.60, bench: 0.20, deepMuck: 0.10, dredged: 0.10 },
    oldTimer: { none: 0.25, handCut: 0.15, drift: 0.30, recentCat: 0.30 },
    mix: { proximal: [45, 35, 15, 5], midReach: [25, 40, 27, 8], bench: [15, 40, 35, 10] },
    finMean: 0.86, finDistSd: 0.02, finClaimSd: 0.025, finLo: 0.80, finHi: 0.92,
    pocketP: 0.015, permafrostP: { creek: 0.75, bench: 0.35, deepMuck: 0.95, dredged: 0.1 },
    clayMed: 0.15, boulderMed: 0.20, cementMed: 0.0,
    ref: { strip: 2.5, stripFrozenAdd: 0.6, wash: 12.0, washBoulder: 0.3, washClay: 0.3, devBase: 150000, devPerAcre: 8000 },
  },
  arid: {
    gMed: +process.env.GA || 0.0075, sigDistrict: +(process.env.SD||0.25), sigCreek: +(process.env.SC||0.45), sigRich: +(process.env.SRA||0.40), richRangeFt: 2000, sigClaim: +(process.env.SCLA||0.25), sigBlock: 0.65,
    blockRangeAlongFt: 500, blockRangeAcrossFt: 120,
    halfWidthMedFt: 130, sigHalfWidth: 0.45, wanderSdFt: 180, bgRatio: 0.12,
    obMedFt: 5, sigObDistrict: 0.2, sigObCreek: 0.3, sigObAR: 0.3, sigObClaim: 0.25, sigObBlock: 0.25, obAxisBoost: 0.2,
    payMedFt: 4, sigPayCreek: 0.2, sigPayAR: 0.2, sigPayBlock: 0.2,
    bedrock: { granite: 0.40, basalt: 0.25, clayFalse: 0.35 },
    deposit: { fan: 0.45, gulch: 0.35, bench: 0.10, dredged: 0.10 },
    oldTimer: { none: 0.45, dryWash: 0.35, recentCat: 0.20 },
    mix: { fan: [10, 30, 40, 20], gulch: [30, 35, 25, 10], bench: [10, 35, 35, 20] },
    finMean: 0.78, finDistSd: 0.04, finClaimSd: 0.035, finLo: 0.70, finHi: 0.88,
    pocketP: 0.02, permafrostP: {}, clayMed: 0.25, boulderMed: 0.15, cementMed: 0.30,
    ref: { strip: 2.2, stripFrozenAdd: 0, stripCement: 0.5, wash: 14.0, washBoulder: 0.3, washClay: 0.3, devBase: 120000, devPerAcre: 7000 },
  },
};
const BR = { schist: [1.5, 0.20], slate: [2.5, 0.30], granite: [1.0, 0.10], basalt: [0.7, 0.08], clayFalse: [0.3, 0.12] };
const CAP = [0.95, 0.88, 0.62, 0.25];
const SPOT = 4200, PAYABLE = 0.95;

function ar1(r, n, rangeFt, sig) { const rho = Math.exp(-BLOCK_FT / rangeFt), s = Math.sqrt(1 - rho * rho); const a = []; let z = r.n(); for (let i = 0; i < n; i++) { if (i) z = rho * z + s * r.n(); a.push(z * sig); } return a; }
function overlap(d, h) { const lo = Math.max(d - BLOCK_FT / 2, -h), hi = Math.min(d + BLOCK_FT / 2, h); return Math.max(0, hi - lo) / BLOCK_FT; }

function genWorld(seed, tplKey, nDistricts) {
  const T = TPL[tplKey], r = mkRng(seed), claims = [];
  for (let d = 0; d < nDistricts; d++) {
    const dG = Math.exp(T.sigDistrict * r.n()), dOb = Math.exp(T.sigObDistrict * r.n());
    const finD = Math.min(T.finHi, Math.max(T.finLo, T.finMean + T.finDistSd * r.n()));
    const nCreeks = 6 + Math.floor(r.u() * 4);
    for (let c = 0; c < nCreeks; c++) {
      const rows = 60 + Math.floor(r.u() * 120); // 2.4-7 mi of valley
      const cG = Math.exp(T.sigCreek * r.n()), cOb = Math.exp(T.sigObCreek * r.n()), cPay = Math.exp(T.sigPayCreek * r.n());
      const rich = ar1(r, rows, T.richRangeFt, T.sigRich), obL = ar1(r, rows, 2500, T.sigObAR), payL = ar1(r, rows, 1500, T.sigPayAR);
      const wander = ar1(r, rows, 2000, T.wanderSdFt), hwL = ar1(r, rows, 1500, T.sigHalfWidth);
      // lay claims along the creek
      let row = Math.floor(r.u() * 6);
      while (row < rows - 5) {
        const sz = r.pick({ 20: 0.55, 40: 0.2, 80: 0.15, 160: 0.10 });
        const dims = { 20: [5, 4], 40: [10, 4], 80: [10, 8], 160: [20, 8] }[sz];
        let [nA, nC] = dims; if (row + nA > rows) { nA = rows - row; }
        const dep = r.pick(T.deposit);
        claims.push(genClaim(r, T, { row, nA, nC, dep, dG, cG, dOb, cOb, cPay, rich, obL, payL, wander, hwL, finD, rowFrac: row / rows }));
        row += nA + (r.u() < 0.25 ? Math.floor(r.u() * 6) : 0);
      }
    }
  }
  return claims;
}

function genClaim(r, T, P) {
  const { nA, nC, dep } = P;
  const isBench = dep === 'bench', deep = dep === 'deepMuck', dredged = dep === 'dredged';
  const clG = Math.exp(T.sigClaim * r.n()) * (isBench ? 0.8 : 1) * (deep ? 1.3 : 1);
  const clOb = Math.exp(T.sigObClaim * r.n()) * (isBench ? 2.5 : 1) * (deep ? 2.8 : 1);
  const axisOff = isBench ? (r.u() < 0.5 ? -1 : 1) * (2 + r.u() * 3) * BLOCK_FT : 0;
  const hwMult = isBench ? 2.0 : 1;
  const br = r.pick(T.bedrock); const [brFt, brShare] = BR[br];
  const mixKey = T.mix.proximal ? (isBench ? 'bench' : (P.rowFrac < 0.3 ? 'proximal' : 'midReach')) : (isBench ? 'bench' : (dep === 'gulch' ? 'gulch' : 'fan'));
  const mix0 = T.mix[mixKey].map(x => x / 100 * Math.exp(0.25 * r.n())); const ms = mix0.reduce((a, b) => a + b); const mix = mix0.map(x => x / ms);
  const fin = Math.min(T.finHi, Math.max(T.finLo, P.finD + T.finClaimSd * r.n()));
  const pfP = T.permafrostP[dep] || 0; const frozen = r.u() < pfP ? 0.6 + 0.4 * r.u() : 0;
  const clay = Math.min(1, T.clayMed * Math.exp(0.6 * r.n())), boulders = Math.min(1, T.boulderMed * Math.exp(0.6 * r.n())), cement = Math.min(1, (T.cementMed || 0) * Math.exp(0.5 * r.n()) * (isBench ? 1.5 : 1));
  const ot = dredged ? 'dredge' : r.pick(T.oldTimer);
  // block correlated field (separable AR)
  const ra = Math.exp(-BLOCK_FT / T.blockRangeAlongFt), rc = Math.exp(-BLOCK_FT / T.blockRangeAcrossFt);
  const z = []; for (let i = 0; i < nA; i++) { const u = []; let w = r.n(); for (let j = 0; j < nC; j++) { if (j) w = rc * w + Math.sqrt(1 - rc * rc) * r.n(); u.push(w); } z.push(i ? u.map((x, j) => ra * z[i - 1][j] + Math.sqrt(1 - ra * ra) * x) : u); }
  const blocks = []; let gStreakSum = 0;
  for (let i = 0; i < nA; i++) {
    const row = P.row + i, hw = T.halfWidthMedFt * hwMult * Math.exp(P.hwL[row]), cen = P.wander[row];
    for (let j = 0; j < nC; j++) {
      const x = axisOff + (j - (nC - 1) / 2) * BLOCK_FT, d = x - (isBench ? axisOff : 0) - cen;
      const f = overlap(d, hw);
      const gS = T.gMed * P.dG * P.cG * Math.exp(P.rich[row]) * clG * Math.exp(T.sigBlock * z[i][j] - 0);
      let g = f * gS + (1 - f) * gS * T.bgRatio;
      const valleyShape = 1 + T.obAxisBoost * Math.exp(-Math.pow((x - axisOff) / 400, 2));
      let ob = T.obMedFt * P.dOb * P.cOb * Math.exp(P.obL[row]) * clOb * valleyShape * Math.exp(T.sigObBlock * r.n());
      const pay = Math.min(15, Math.max(1, T.payMedFt * P.cPay * Math.exp(P.payL[row]) * (0.7 + 0.3 * f) * Math.exp(T.sigPayBlock * r.n())));
      const bc = brFt * (0.8 + 0.4 * r.u());
      const payBcy = (pay + bc) * BCY_PER_ACRE_FT;
      // pocket
      if (f >= 0.4 && r.u() < T.pocketP) { const pB = 300 + r.u() * 2700, pG = Math.min(2.0, Math.max(0.15, gS * r.ln(15, 0.5))); g = (g * (payBcy - pB) + pG * pB) / payBcy; }
      let bmix = mix.slice(); bmix[0] *= (0.5 + 0.5 * f); { const s = bmix.reduce((a, b) => a + b); bmix = bmix.map(v => v / s); }
      blocks.push({ i, j, f, gVirgin: g, g, ob, pay, bc, payBcy, mix: bmix, minedOut: 0, mined: false, frozen, gS });
      gStreakSum += gS;
    }
  }
  // old-timers: hit the richest paystreak blocks
  const ps = blocks.filter(b => b.f >= 0.4).sort((a, b) => b.g - a.g);
  const deplete = (b, x, shift) => { b.minedOut = x; b.g *= (1 - x); const s = [1 - 0.85 * x * shift, 1 - 0.75 * x * shift, 1 - 0.4 * x * shift, 1 - 0.1 * x * shift]; b.mix = b.mix.map((v, k) => v * Math.max(0.05, s[k])); const t = b.mix.reduce((a, c) => a + c); b.mix = b.mix.map(v => v / t); };
  if (ot === 'drift') { const n = Math.ceil(ps.length * (0.4 + 0.4 * r.u())); ps.slice(0, n).forEach(b => { if (r.u() < 0.8) deplete(b, 0.75 * (0.6 + 0.3 * r.u()), 1); }); }
  if (ot === 'handCut') { ps.filter(b => b.ob < 10).slice(0, Math.ceil(ps.length * 0.3)).forEach(b => deplete(b, 0.5 + 0.3 * r.u(), 1)); }
  if (ot === 'dryWash') { ps.slice(0, Math.ceil(ps.length * 0.5)).forEach(b => deplete(b, 0.1 + 0.2 * r.u(), 1)); }
  if (ot === 'dredge') { blocks.filter(b => b.f > 0.05).forEach(b => { deplete(b, 0.80 + 0.12 * r.u(), 0.6); b.ob = 0; b.frozen = 0; }); }
  if (ot === 'recentCat') { const n = Math.ceil(ps.length * (0.15 + 0.35 * r.u())); ps.filter(b => !b.minedOut).slice(0, n).forEach(b => { b.mined = true; }); }
  const zq = Math.log(Math.max(1e-6, blocks.filter(b=>b.f>=0.4).reduce((a,b)=>a+b.gS,0)/Math.max(1,blocks.filter(b=>b.f>=0.4).length)) / T.gMed) / 0.5;
  return { zq, nA, nC, acres: nA * nC, dep, br, mixKey, mix, fin, frozen, clay, boulders, cement, ot, blocks, T };
}

function classify(c) {
  const T = c.T, R = T.ref; let rev = 0, cost = 0, acres = 0, payB = 0, obB = 0, oz = 0;
  const per = [], minedG = [];
  for (const b of c.blocks) {
    if (b.mined) continue;
    const rec = b.mix.reduce((a, m, k) => a + m * CAP[k], 0) * (1 - 0.15 * c.clay);
    const obBcy = b.ob * BCY_PER_ACRE_FT;
    const rv = b.payBcy * b.g * rec * c.fin * SPOT * PAYABLE;
    const strip = R.strip * (1 + R.stripFrozenAdd * b.frozen + (R.stripCement || 0) * c.cement);
    const wash = R.wash * (1 + R.washBoulder * c.boulders + R.washClay * c.clay);
    const cs = obBcy * strip + b.payBcy * wash;
    per.push({ b, rv, cs, obBcy });
    if (rv > cs) { minedG.push([b.g, b.payBcy]); rev += rv; cost += cs; acres += 1; payB += b.payBcy; obB += obBcy; oz += b.payBcy * b.g; }
  }
  const dev = R.devBase + R.devPerAcre * acres;
  const cdv = rev - cost - dev, m = rev > 0 ? (rev - cost) / rev : -1; const cdv20 = process.env.NORM ? cdv * 20 / c.acres : cdv;
  let cls = 'uneconomic';
  if (cdv > 0) cls = 'marginal';
  if (cdv20 >= +(process.env.GCDV||500000) && m >= +(process.env.GM||0.35)) cls = 'good';
  if (cdv20 >= +(process.env.ECDV||2500000) && m >= +(process.env.EM||0.55)) cls = 'excellent';
  // descriptive stats
  const psb = c.blocks.filter(b => b.f >= 0.4 && !b.mined).map(b => b.g).sort((a, b) => a - b);
  const medPay = psb.length ? psb[Math.floor(psb.length / 2)] : 0;
  const allPay = c.blocks.reduce((a, b) => a + b.payBcy, 0), allOb = c.blocks.reduce((a, b) => a + b.ob * BCY_PER_ACRE_FT, 0);
  return { zq: c.zq, dep: c.dep, cls, cdv, m, size: c.acres, minedG, ot: c.ot, acres, strip: allOb / allPay, minedStrip: payB ? obB / payB : null, medPay, oz };
}

function pct(a, p) { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
for (const key of ['north', 'arid']) {
  let all0 = [];
  for (let s = 1; s <= 40; s++) all0 = all0.concat(genWorld(1000 + s, key, 1).map(classify));
  const r = mkRng(77); const staked = key==='north'?0.75:0.60; const a0 = Math.log(staked/(1-staked));
  all0.forEach(x => { const b = (x.dep==='bench'||x.dep==='deepMuck') ? +(process.env.BO||0.3) : +(process.env.BQ||1.2); const p = 1/(1+Math.exp(-(a0 + b*x.zq))); x.held = r.u() < p; });
  { const shA = k => (100*all0.filter(x=>x.cls===k).length/all0.length).toFixed(1); console.log(`[${key}] ALL-PARCELS: U ${shA('uneconomic')} M ${shA('marginal')} G ${shA('good')} E ${shA('excellent')}`); }
  const open = all0.filter(x=>!x.held); const shO = k => (100*open.filter(x=>x.cls===k).length/open.length).toFixed(1);
  console.log(`\n[${key}] ALL n=${all0.length}; OPEN n=${open.length}: U ${shO('uneconomic')} M ${shO('marginal')} G ${shO('good')} E ${shO('excellent')}  open bench/deepMuck share ${(100*open.filter(x=>x.dep==='bench'||x.dep==='deepMuck').length/open.length).toFixed(0)}%`);
  { const ov = open.filter(x=>(x.dep==='bench'||x.dep==='deepMuck')); console.log(`   open overlooked(bench/deepMuck) economic share ${(100*ov.filter(x=>x.cls!=='uneconomic').length/ov.length).toFixed(1)}%; open creek economic ${(100*open.filter(x=>!(x.dep==='bench'||x.dep==='deepMuck')&&x.cls!=='uneconomic').length/open.filter(x=>!(x.dep==='bench'||x.dep==='deepMuck')).length).toFixed(1)}%`); }
  const held = all0.filter(x=>x.held);
  // steady-state listing pool from held claims
  const inflow = {uneconomic:1.1, marginal:1.0, good:0.8, excellent:0.6}, saleMult = {uneconomic:0.7, marginal:1.0, good:1.8, excellent:2.5};
  const W = {}; let Wt=0; for (const k of Object.keys(inflow)) { const n = held.filter(x=>x.cls===k).length; const dur = 1/(1/16 + 0.02*saleMult[k]); W[k] = n*inflow[k]*dur; Wt+=W[k]; }
  console.log('   LISTING POOL steady state: ' + Object.keys(W).map(k=>k[0].toUpperCase()+' '+(100*W[k]/Wt).toFixed(1)).join('  '));
  const all = held; console.log('   (stats below = HELD claims)');
  const n = all.length, sh = k => (100 * all.filter(x => x.cls === k).length / n).toFixed(1);
  console.log(`\n${key}: claims=${n}  uneconomic ${sh('uneconomic')}%  marginal ${sh('marginal')}%  good ${sh('good')}%  excellent ${sh('excellent')}%`);
  const mp = all.map(x => x.medPay);
  console.log(` medPay p25 ${pct(mp,.25).toFixed(4)} p75 ${pct(mp,.75).toFixed(4)}`);
  { const W=[]; all.filter(x=>x.cdv>0).forEach(x=>x.minedG.forEach(w=>W.push(w))); W.sort((a,b)=>a[0]-b[0]); const tot=W.reduce((a,w)=>a+w[1],0); const q=p=>{let acc=0; for(const w of W){acc+=w[1]; if(acc>=p*tot) return w[0].toFixed(4);} }; console.log(` mined-block grade (economic claims, bcy-weighted) p10 ${q(.1)} p50 ${q(.5)} p90 ${q(.9)} p99 ${q(.99)}`); }
  { const o={}; all.forEach(x=>o[x.ot]=(o[x.ot]||0)+1); console.log(' oldTimer', JSON.stringify(o)); }
  console.log(` median paystreak-block grade per claim: p10 ${pct(mp, .1).toFixed(4)} p50 ${pct(mp, .5).toFixed(4)} p90 ${pct(mp, .9).toFixed(4)}`);
  const st = all.map(x => x.strip); console.log(` whole-claim strip ratio p10 ${pct(st, .1).toFixed(2)} p50 ${pct(st, .5).toFixed(2)} p90 ${pct(st, .9).toFixed(2)}`);
  const ms = all.filter(x => x.minedStrip != null).map(x => x.minedStrip); console.log(` mined-block strip p10 ${pct(ms, .1).toFixed(2)} p50 ${pct(ms, .5).toFixed(2)} p90 ${pct(ms, .9).toFixed(2)}`);
  for (const sz of [20,40,80,160]) { const g = all.filter(x => x.size === sz); const f = k => (100*g.filter(x=>x.cls===k).length/g.length).toFixed(0); console.log(`   ${sz}ac n=${g.length}: U ${f('uneconomic')} M ${f('marginal')} G ${f('good')} E ${f('excellent')}`); }
  for (const cl of ['marginal', 'good', 'excellent']) { const g = all.filter(x => x.cls === cl); if (g.length) console.log(`  ${cl}: n=${g.length} medCDV $${(pct(g.map(x => x.cdv), .5) / 1e3).toFixed(0)}k  medMargin ${(pct(g.map(x => x.m), .5) * 100).toFixed(0)}%  medOz ${pct(g.map(x => x.oz), .5).toFixed(0)}  medPay ${pct(g.map(x => x.medPay), .5).toFixed(4)}`); }
}
