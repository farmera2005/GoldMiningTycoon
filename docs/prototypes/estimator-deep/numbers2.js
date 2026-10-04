'use strict';
const L = require('./lib'); const E = require('./est'); const X = require('./example');
const K = L.K; const pr = X.pr;
const SM = JSON.parse(require('fs').readFileSync('smalltab.json'));
// one-block, schist
{ const M = Math.log(0.0095); const v0 = pr.Vm + 0.25 + 0.35 ** 2; const R0 = pr.R0, a0 = pr.alpha0; const pc = R0 / (1 + R0); const vr = L.trigamma(a0); const Ew = Math.log(1 + R0) + 0.5 * pc * (1 - pc) * vr;
  const m = L.METHODS.excavatorPit; const pm = L.posMult(-1, 5, 5, 1.5, 0.20, 2.0); const Vb = 6.5 * 1613;
  const cvL = Math.pow(Vb / 5, 0.028) - 1, cvM = (1 + m.volumeCv ** 2) * (1 + m.weighCv ** 2) - 1;
  const gobs = 0.0100; // capture-corrected non-coarse grade as logged (before position correction)
  const lg = Math.log(gobs / pm); const Ne = 1166 * pm; // large: lognormal regime
  const y = lg - 0.5 * Math.log(1 + 1 / Ne) * -1 * 0 + 0.5 * Math.log(1 + 1 / Ne) + 0.5 * Math.log((1 + cvL) * (1 + cvM)) + Ew;
  const v = Math.log(1 + 1 / Ne) + Math.log((1 + cvL) * (1 + cvM)) + 0.10 ** 2 + 0.10 ** 2 + pc * pc * 0.25 ** 2; const veff = v + pc * pc * vr;
  const w = v0 / (v0 + veff); const post = M + w * (y - M); const pv = v0 * veff / (v0 + veff);
  const z = 1.2816; console.log(`one-block schist: pm ${pm.toFixed(3)} Ew ${Ew.toFixed(3)} vr ${vr.toFixed(4)} CV2L ${cvL.toFixed(3)} CV2M ${cvM.toFixed(3)} y ${y.toFixed(3)} v ${v.toFixed(3)} veff ${veff.toFixed(3)} w ${w.toFixed(3)} post ${post.toFixed(3)} var ${pv.toFixed(4)} sd ${Math.sqrt(pv).toFixed(3)} -> ${Math.exp(post - z * Math.sqrt(pv)).toFixed(4)} / ${Math.exp(post).toFixed(4)} / ${Math.exp(post + z * Math.sqrt(pv)).toFixed(4)}; prior ${Math.exp(M - z * Math.sqrt(v0)).toFixed(4)}/${Math.exp(M).toFixed(4)}/${Math.exp(M + z * Math.sqrt(v0)).toFixed(4)} ratio prior ${Math.exp(2 * z * Math.sqrt(v0)).toFixed(1)} post ${Math.exp(2 * z * Math.sqrt(pv)).toFixed(1)}`); }
// ---- VOI on seed 104 after s2 ----
const cl = L.genClaim(104); const st = X.stages(cl, 104); const base = st.s2.samples; const rec = st.s2.rec;
const res = E.estimate(pr, base, { records: rec }); const ag = E.aggregate(pr, res);
function synth(a, mName, V) { const m = L.METHODS[mName]; const b = pr.blocks[a]; const g = E.blockQuant(pr, res, a)[1]; const R = (b.aPost ?? b.a) * Math.exp(res.co.mr); const cs = R / (1 + R);
  const sh = [cs, ...[0.40, 0.27, 0.08].map(x => x / 0.75 * (1 - cs))]; const D = Math.exp(res.geo.D.mean[a]); const T = Math.exp(res.geo.T.mean[a]); const Bh = res.geo.Bhat[a];
  const sdD = Math.sqrt(res.geo.D.cov[a][a]); const pReach = m.maxDepth == null || m.maxDepth > 100 ? 1 : L.Phi((Math.log(m.maxDepth) - Math.log(D)) / sdD);
  if (V === 'drill') V = m.perFt * T; const bed = pReach >= 0.5; const pmv = bed ? L.posMult(-Math.min(Bh, m.pen), T - Bh, T - Bh, Bh, 0.19, 2.0) : 0.5;
  const mm = [150, 3, 0.1, 0.004]; const massBy = sh.map((s, k) => g * s * V * K * m.cap[k] * pmv); const colors = massBy.map((x, k) => Math.round(x / mm[k]));
  return { block: a, method: mName, V, Vtrue: V, reachedPay: true, reachedBedrock: bed, depthReached: bed ? D : m.maxDepth, massBy, colors, obs: bed ? { D, Tg: T - Bh, bedrock: 'schist', OB: D - (T - Bh) } : { OB: D - (T - Bh) }, interval: bed ? 'fullColumn' : 'upperPay' }; }
const kPrice = 4200 * 0.86 * 0.777 * 0.95; const Obe = 1500;
function evsi(ag0, ag1) { const sO = ag0.mean * Math.sqrt(Math.exp(Math.log(ag0.bP90 / ag0.bP10) ** 2 / (2 * 1.2816) ** 2 * 1) - 1); const sO1 = ag0.mean * Math.sqrt(Math.exp(Math.log(ag1.bP90 / ag1.bP10) ** 2 / (2 * 1.2816) ** 2) - 1);
  const s = Math.sqrt(Math.max(0, sO * sO - sO1 * sO1)); const d = ag0.mean - Obe; return { sO, sO1, evsi: s > 0 ? kPrice * (s * L.phi(d / s) - Math.abs(d) * L.Phi(-Math.abs(d) / s)) : 0 }; }
console.log(`VOI base (after 8 pits): mean ${ag.mean.toFixed(0)} P10/50/90 ${ag.P10.toFixed(0)}/${ag.P50.toFixed(0)}/${ag.P90.toFixed(0)} base spread ${ag.baseSpread.toFixed(2)} k ${kPrice.toFixed(0)}`);
const remaining = pr.blocks.filter(b => !(b.i === 1 || b.i === 3)).map(b => b.idx);
let bestA = 0, bv = -1e9; for (let a = 0; a < 20; a++) { const g = E.blockQuant(pr, res, a)[1]; if (g > bv) { bv = g; bestA = a; } }
const cands = { '+12 pits (remaining blocks)': remaining.map(a => synth(a, 'excavatorPit', 5)), '+1 bulk 500 bcy': [synth(bestA, 'bulk', 500)], '+30 sonic holes': Array.from({ length: 30 }, (_, k) => synth(k % 20, 'sonic', 'drill')), '+12 pits + bulk': [...remaining.map(a => synth(a, 'excavatorPit', 5)), synth(bestA, 'bulk', 500)] };
for (const name in cands) { const r1 = E.estimate(pr, base.concat(cands[name]), { records: rec }); const a1 = E.aggregate(pr, r1); const e = evsi(ag, a1); console.log(`${name.padEnd(28)} base spread' ${a1.baseSpread.toFixed(2)} sigmaO ${e.sO.toFixed(0)} -> ${e.sO1.toFixed(0)} EVSI $${(e.evsi / 1000).toFixed(0)}k (${(e.evsi / kPrice).toFixed(1)} oz-eq)`); }
console.log('bulk block', bestA);
