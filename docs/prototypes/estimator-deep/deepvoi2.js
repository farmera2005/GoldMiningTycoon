'use strict';
const L = require('./lib');
const DEEP = process.env.DEEP !== '0';
if (DEEP) L.TPL.obMed = 30;
const E = require('./est'); const X = require('./example'); const pr = X.pr; const K = L.K;
const seed = 104; const cl = L.genClaim(seed);
const r = new L.Rng(seed * 7919 + 13); const B = cl.blocks; const rec = { histGrade: cl.histGrade };
let pans = []; for (let k = 0; k < 24; k++) pans.push(L.drawSample(B.filter(x => x.channel)[k % 5], 0.067, 'pan', r));
let base = pans;
if (!DEEP) { const st = X.stages(cl, seed); base = st.s2.samples; }
const res = E.estimate(pr, base, { records: rec });
function synth(res, a, mName, V, reach) { const m = L.METHODS[mName]; const b = pr.blocks[a]; const g = E.blockQuant(pr, res, a)[1]; const R = (b.aPost ?? b.a) * Math.exp(res.co.mr); const cs = R / (1 + R);
  const sh = [cs, ...[0.40, 0.27, 0.08].map(x => x / 0.75 * (1 - cs))]; const D = Math.exp(res.geo.D.mean[a]); const T = Math.exp(res.geo.T.mean[a]); const Bh = res.geo.Bhat[a];
  const sdD = Math.sqrt(res.geo.D.cov[a][a]); const OB = D - (T - Bh);
  const rch = reach ?? m.maxDepth;
  const pReach = rch == null || rch > 100 ? 1 : L.Phi((Math.log(rch) - Math.log(D)) / sdD);
  const pPay = rch == null || rch > 100 ? 1 : L.Phi((Math.log(rch) - Math.log(OB)) / sdD);
  if (V === 'drill') V = m.perFt * T;
  if (pPay < 0.5) return { block: a, method: mName, V, Vtrue: V, reachedPay: false, reachedBedrock: false, depthReached: rch, massBy: [0,0,0,0], colors: [0,0,0,0], obs: {}, interval: 'overburdenOnly' };
  const bed = pReach >= 0.5; const pmv = bed ? L.posMult(-Math.min(Bh, m.pen), T - Bh, T - Bh, Bh, 0.19, 2.0) : 0.5;
  const mm = [150, 3, 0.1, 0.004]; const massBy = sh.map((s, k) => g * s * V * K * m.cap[k] * pmv); const colors = massBy.map((x, k) => Math.round(x / mm[k]));
  return { block: a, method: mName, V, Vtrue: V, reachedPay: true, reachedBedrock: bed, depthReached: bed ? D : rch, massBy, colors, obs: bed ? { D, Tg: T - Bh, bedrock: 'schist', OB } : { OB }, interval: bed ? 'fullColumn' : 'upperPay' }; }
const price = 4200, fin = 0.86, rcv = 0.777, pay = 0.95, wash = 12, strip = 2.5, cap = 4.0, gStrip = DEEP ? 1 + 0.6 * 0.75 : 1 + 0.6*0.75, gWash = 1.0;
const k = price * fin * rcv * pay;
function sig(a) { return a.mean * Math.sqrt(Math.exp((Math.log(a.bP90 / a.bP10) / (2 * 1.2816)) ** 2) - 1); }
// candidate footprint and per-block quantities on the base
const blk = [];
for (let a = 0; a < 20; a++) { const D = Math.exp(res.geo.D.mean[a]); const T = Math.exp(res.geo.T.mean[a]); const Bh = res.geo.Bhat[a]; const ob = Math.max(0, D - T + Bh); const s50 = ob / T;
  const q = E.blockQuant(pr, res, a); const cpb = wash * gWash + strip * gStrip * s50; const cut = cpb / k; const sel = pr.blocks.map((_, c) => c === a); const ag = E.aggregate(pr, res, sel);
  blk.push({ a, cut, g90: q[2], g50: q[1], cand: q[2] >= cut, minable: q[1] >= cut, obe: T * 1613 * (cpb + cap) / k, mean: ag.mean, sig: sig(ag), s50, T }); }
const F = blk.filter(b => b.cand);
console.log(`base: candidates ${F.length}, minable ${blk.filter(b => b.minable).length}; per-block Obe range ${Math.min(...F.map(b=>b.obe)).toFixed(0)}-${Math.max(...F.map(b=>b.obe)).toFixed(0)}; cut median ${blk.map(b=>b.cut).sort((x,y)=>x-y)[10].toFixed(4)} strip mean ${(blk.reduce((s,b)=>s+b.s50,0)/20).toFixed(2)}`);
const agAll = E.aggregate(pr, res);
const cands = DEEP ? { '20 pits 30t (22 ft)': B.map(b => synth(res, b.idx, 'excavatorPit', 5, 22)), '20 sonic': B.map(b => synth(res, b.idx, 'sonic', 'drill')), '10 sonic (2 fences)': B.filter(b => b.i === 1 || b.i === 3).map(b => synth(res, b.idx, 'sonic', 'drill')) }
  : { '+12 pits': pr.blocks.filter(b => !(b.i === 1 || b.i === 3)).map(b => synth(res, b.idx, 'excavatorPit', 5)), '+30 sonic': Array.from({ length: 30 }, (_, kk) => synth(res, kk % 20, 'sonic', 'drill')) };
for (const n in cands) { const r1 = E.estimate(pr, base.concat(cands[n]), { records: rec }); const a1 = E.aggregate(pr, r1);
  let ev = 0; for (const b of F) { const sel = pr.blocks.map((_, c) => c === b.a); const ab = E.aggregate(pr, r1, sel); const s1 = sig(ab); const s = Math.sqrt(Math.max(0, b.sig ** 2 - s1 ** 2)); const d = b.mean - b.obe; if (s > 0) ev += k * (s * L.phi(d / s) - Math.abs(d) * L.Phi(-Math.abs(d) / s)); }
  console.log(`${n.padEnd(22)} claim spread ${agAll.baseSpread.toFixed(2)} -> ${a1.baseSpread.toFixed(2)}  per-block EVSI $${(ev/1000).toFixed(0)}k`); }
