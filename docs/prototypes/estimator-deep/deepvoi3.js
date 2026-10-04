'use strict';
const L = require('./lib'); L.TPL.obMed = 30;
const E = require('./est'); const X = require('./example'); const pr = X.pr; const K = L.K;
const seed = 104; const cl = L.genClaim(seed);
const r = new L.Rng(seed * 7919 + 13); const B = cl.blocks; const rec = { histGrade: cl.histGrade };
let pans = []; for (let k = 0; k < 24; k++) pans.push(L.drawSample(B.filter(x => x.channel)[k % 5], 0.067, 'pan', r));
const base = pans; const res = E.estimate(pr, base, { records: rec }); const ag = E.aggregate(pr, res);
const k = 4200 * 0.86 * 0.777 * 0.95; let dev = 0;
for (let a = 0; a < 20; a++) { const D = Math.exp(res.geo.D.mean[a]); const T = Math.exp(res.geo.T.mean[a]); const Bh = res.geo.Bhat[a]; const s50 = Math.max(0, D - T + Bh) / T; dev += T * 1613 * (12 + 2.5 * 1.45 * s50 + 4); }
function sig(a) { return a.mean * Math.sqrt(Math.exp((Math.log(a.bP90 / a.bP10) / (2 * 1.2816)) ** 2) - 1); }
const Obe = dev / k; const sO = sig(ag);
const m = L.METHODS.sonic; const syn = B.map(b => { const a = b.idx; const g = E.blockQuant(pr, res, a)[1]; const bb = pr.blocks[a]; const R = (bb.aPost ?? bb.a) * Math.exp(res.co.mr); const cs = R / (1 + R);
  const sh = [cs, ...[0.40, 0.27, 0.08].map(x => x / 0.75 * (1 - cs))]; const D = Math.exp(res.geo.D.mean[a]); const T = Math.exp(res.geo.T.mean[a]); const Bh = res.geo.Bhat[a]; const V = m.perFt * T;
  const pmv = L.posMult(-Math.min(Bh, m.pen), T - Bh, T - Bh, Bh, 0.19, 2.0); const mm = [150, 3, 0.1, 0.004]; const massBy = sh.map((s, kk) => g * s * V * K * m.cap[kk] * pmv);
  return { block: a, method: 'sonic', V, Vtrue: V, reachedPay: true, reachedBedrock: true, depthReached: D, massBy, colors: massBy.map((x, kk) => Math.round(x / mm[kk])), obs: { D, Tg: T - Bh, bedrock: 'schist', OB: D - (T - Bh) }, interval: 'fullColumn' }; });
const r1 = E.estimate(pr, base.concat(syn), { records: rec }); const a1 = E.aggregate(pr, r1); const s1 = sig(a1);
const s = Math.sqrt(sO * sO - s1 * s1); const d = ag.mean - Obe; const ev = k * (s * L.phi(d / s) - Math.abs(d) * L.Phi(-Math.abs(d) / s));
console.log(`whole-claim: dev $${(dev/1e6).toFixed(2)}M Obe ${Obe.toFixed(0)} E ${ag.mean.toFixed(0)} sO ${sO.toFixed(0)} s1 ${s1.toFixed(0)} s ${s.toFixed(0)} d ${d.toFixed(0)} EVSI $${(ev/1000).toFixed(1)}k`);
