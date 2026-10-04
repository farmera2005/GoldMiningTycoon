'use strict';
const L = require('./lib');
const E = require('./est'); const X = require('./example'); const pr = X.pr;
const seed = 104; const cl = L.genClaim(seed); const st = X.stages(cl, seed);
for (const key of ['s2','s3']) {
const base = st[key].samples; const rec = st[key].rec;
const res = E.estimate(pr, base, { records: rec });
const k = 4200 * 0.86 * 0.777 * 0.95;
const F = []; let obe = 0;
for (let a = 0; a < 20; a++) { const D = Math.exp(res.geo.D.mean[a]); const T = Math.exp(res.geo.T.mean[a]); const Bh = res.geo.Bhat[a]; const s50 = Math.max(0, D - T + Bh) / T;
  const q = E.blockQuant(pr, res, a); const cpb = 12 + 2.5 * 1.45 * s50; if (q[2] >= cpb / k) { F.push(a); obe += T * 1613 * (cpb + 4) / k; } }
const sel = pr.blocks.map((_, a) => F.includes(a)); const ag = E.aggregate(pr, res, sel);
// CDF at obe via bisection on quantile
let lo = 0.0001, hi = 0.9999; 
// reconstruct comps like aggregate does (with pockets): approximate using quantile function by recomputing aggregate for q
function quant(q) { // use lognormal interpolation between P10/P50/P90 (approx)
  return null; }
// approximate: lognormal fit on P10/P90
const mu = Math.log(ag.P50), sd = Math.log(ag.P90 / ag.P10) / (2 * 1.2816);
const p = 1 - L.Phi((Math.log(obe) - mu) / sd);
const agAll = E.aggregate(pr, res);
console.log(key, `F ${F.length} S_F P10/50/90 ${ag.P10.toFixed(0)}/${ag.P50.toFixed(0)}/${ag.P90.toFixed(0)} Obe ${obe.toFixed(0)} pPays ~${p.toFixed(3)} | claim ${agAll.P10.toFixed(0)}/${agAll.P50.toFixed(0)}/${agAll.P90.toFixed(0)}`);
}
