'use strict';
const L = require('./lib');
L.TPL.obMed = +(process.env.OBMED ?? 30);
const E = require('./est'); const X = require('./example'); const pr = X.pr; const K = L.K;
const seed = 104; const cl = L.genClaim(seed);
const r = new L.Rng(seed * 7919 + 13); const B = cl.blocks; const rec = { histGrade: cl.histGrade };
let pans = []; for (let k = 0; k < 24; k++) pans.push(L.drawSample(B.filter(x => x.channel)[k % 5], 0.067, 'pan', r));
const base = pans; const res = E.estimate(pr, base, { records: rec }); const ag = E.aggregate(pr, res);
function synth(a, mName, V, reach) { const m = L.METHODS[mName]; const b = pr.blocks[a]; const g = E.blockQuant(pr, res, a)[1]; const R = (b.aPost ?? b.a) * Math.exp(res.co.mr); const cs = R / (1 + R);
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
// default develop context
const price = 4200, fin = 0.86, rcv = 0.777, pay = 0.95, wash = 12, strip = 2.5, cap = 4.0, gStrip = 1 + 0.6 * 0.75, gWash = 1.0;
const k = price * fin * rcv * pay;
let devCost = 0, nM = 0, bcyM = 0;
for (let a = 0; a < 20; a++) { const D = Math.exp(res.geo.D.mean[a]); const T = Math.exp(res.geo.T.mean[a]); const Bh = res.geo.Bhat[a]; const ob = Math.max(0, D - T + Bh); const s50 = ob / T;
  const g50 = E.blockQuant(pr, res, a)[1]; const cpb = wash * gWash + strip * gStrip * s50; const cut = cpb / k; if (g50 >= cut) { nM++; const v = T * 1613; bcyM += v; devCost += v * (cpb + cap); } }
const Obe = devCost / k;
function sig(a) { return a.mean * Math.sqrt(Math.exp((Math.log(a.bP90 / a.bP10) / (2 * 1.2816)) ** 2) - 1); }
const sO = sig(ag);
console.log(`base: mean ${ag.mean.toFixed(0)} P10/50/90 ${ag.P10.toFixed(0)}/${ag.P50.toFixed(0)}/${ag.P90.toFixed(0)} base spread ${ag.baseSpread.toFixed(2)} sigmaO ${sO.toFixed(0)}; minable blocks ${nM} payBcy ${bcyM.toFixed(0)} devCost $${(devCost/1000).toFixed(0)}k k $${k.toFixed(0)} Obe ${Obe.toFixed(0)}`);
const cands = { '20 pits 30t (22 ft)': B.map(b => synth(b.idx, 'excavatorPit', 5, 22)), '20 pits 45t (27 ft)': B.map(b => synth(b.idx, 'excavatorPit', 5, 27)), '20 sonic': B.map(b => synth(b.idx, 'sonic', 'drill')), '10 sonic (2 fences)': B.filter(b => b.i === 1 || b.i === 3).map(b => synth(b.idx, 'sonic', 'drill')) };
for (const n in cands) { const r1 = E.estimate(pr, base.concat(cands[n]), { records: rec }); const a1 = E.aggregate(pr, r1); const s1 = sig(a1); const s = Math.sqrt(Math.max(0, sO * sO - s1 * s1)); const d = ag.mean - Obe;
  const ev = s > 0 ? k * (s * L.phi(d / s) - Math.abs(d) * L.Phi(-Math.abs(d) / s)) : 0;
  console.log(`${n.padEnd(22)} spread' ${a1.baseSpread.toFixed(2)} sigma' ${s1.toFixed(0)} s ${s.toFixed(0)} d ${d.toFixed(0)} EVSI $${(ev/1000).toFixed(0)}k (${(ev/k).toFixed(1)} oz) phi ${L.phi(d/s).toFixed(3)} Phi ${L.Phi(-Math.abs(d)/s).toFixed(3)}`); }
// hole footage and lab
let ft = 0, lab = 0; for (const b of cl.blocks) { const f = b.OB + b.Tg + 3; ft += f; const payInt = Math.ceil((b.Tg + 3) / 5); const barInt = Math.ceil(b.OB / 5); lab += 90 * payInt + 15 * barInt; }
console.log('true footage', ft.toFixed(0), 'lab', lab, 'planner D50 mean', (pr.blocks.reduce((a,b)=>a+b.D50,0)/20).toFixed(1));
let pf = 0; for (const b of pr.blocks) pf += b.D50 + 3; console.log('planner footage', pf.toFixed(0));
