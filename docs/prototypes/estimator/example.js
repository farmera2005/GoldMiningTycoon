'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
const PLAN = { price: 4200, fineness: 0.86, payable: 0.95, wash: 12.0, strip: 2.5, cap: [0.95, 0.88, 0.62, 0.25] };
function classify(res, ag, samples) {
  const bl = pr.blocks; const pc = Math.exp(res.co.mr) / (1 + Math.exp(res.co.mr));
  const nc = [0.40, 0.27, 0.08].map(x => x / 0.75 * (1 - pc)); const mix = [pc, ...nc]; const rec = mix.reduce((a, m, k) => a + m * PLAN.cap[k], 0);
  const g50 = bl.map((b, a) => E.blockQuant(pr, res, a)[1]); const g90 = bl.map((b, a) => E.blockQuant(pr, res, a)[2]);
  const T = bl.map((b, a) => Math.exp(res.geo.T.mean[a])); const D = bl.map((b, a) => Math.exp(res.geo.D.mean[a]));
  const ob = bl.map((b, a) => Math.max(0, D[a] - T[a] + res.geo.Bhat[a])); const strip = ob.map((o, a) => o / T[a]);
  const cut = strip.map(s => (PLAN.wash + PLAN.strip * s) / (rec * PLAN.fineness * PLAN.price * PLAN.payable));
  let F = bl.map((b, a) => g50[a] >= cut[a]); if (!F.some(x => x)) F = bl.map((b, a) => g90[a] >= cut[a]); if (!F.some(x => x)) F = bl.map(() => true);
  const bed = new Set(samples.filter(s => s.reachedBedrock).map(s => s.block));
  const d = bl.map(b => { let best = 99; for (const k of bed) { const c = bl[k]; if (Math.abs(c.j - b.j) <= 1 && (c.j === b.j || true)) { if (Math.abs(c.j - b.j) <= 1) best = Math.min(best, (c.j === b.j && c.i === b.i) ? 0 : (c.idx === b.idx ? 0 : Math.max(Math.abs(c.i - b.i), c.j === b.j ? 0 : 0))); } } return bed.has(b.idx) ? 0 : (best === 0 ? 1 : best); });
  const fi = bl.map((b, a) => a).filter(a => F[a]); const cov0 = fi.filter(a => d[a] === 0).length / fi.length, cov2 = fi.filter(a => d[a] <= 2).length / fi.length;
  const coarseSd = pc * Math.sqrt(res.co.vr); const proc = samples.filter(s => s.reachedPay && ['excavatorPit', 'trench', 'bulk', 'handPit'].includes(s.method)).reduce((a, s) => a + s.V, 0);
  const nBed = samples.filter(s => s.reachedBedrock).length; const bulkBlocks = new Set(samples.filter(s => s.method === 'bulk').map(s => s.block)).size;
  const sp = ag.baseSpread; let cls = 'speculative';
  if (sp <= TH.inf && cov2 >= 0.6 && nBed >= 6) cls = 'inferred';
  if (cls === 'inferred' && sp <= TH.ind && cov0 >= 0.7 && coarseSd <= 0.06 && proc >= 75) cls = 'indicated';
  if (cls === 'indicated' && sp <= TH.meas && cov0 >= 0.9 && coarseSd <= 0.04 && bulkBlocks >= 2) cls = 'measured';
  return { cls, cov0, cov2, coarseSd, proc, nBed, minable: fi.length, rec, cutMed: cut.slice().sort((a, b) => a - b)[10] };
}
const TH = { inf: 3.5, ind: 1.9, meas: 1.45 };
function stages(cl, seed) {
  const r = new L.Rng(seed * 7919 + 13); const B = cl.blocks; const out = {}; let s = []; const rec = { histGrade: cl.histGrade };
  out.s0 = { samples: [], rec: null }; out.s0r = { samples: [], rec };
  for (let k = 0; k < 24; k++) s.push(L.drawSample(B.filter(x => x.channel)[k % 5], 0.067, 'pan', r)); const pans = s.slice(); out.s1 = { samples: s.slice(), rec };
  for (const b of B.filter(b => b.i === 1 || b.i === 3)) s.push(L.drawSample(b, 5, 'excavatorPit', r)); out.s2 = { samples: s.slice(), rec };
  for (const b of B.filter(b => !(b.i === 1 || b.i === 3))) s.push(L.drawSample(b, 5, 'excavatorPit', r)); out.s3 = { samples: s.slice(), rec };
  const e3 = E.estimate(pr, s, { records: rec }); let best = 0, bv = -1e9; for (let a = 0; a < 20; a++) { const m = e3.wts.reduce((acc, w, h) => acc + w * e3.blk[h][a], 0); if (m > bv) { bv = m; best = a; } }
  s.push(L.drawSample(B[best], 500, 'bulk', r)); out.s4 = { samples: s.slice(), rec, best };
  let a = pans.slice(); for (let k = 0; k < 30; k++) a.push(L.drawSample(B[k % 20], 'drill', 'sonic', r)); out.A = { samples: a.slice(), rec }; a.push(L.drawSample(B[best], 500, 'bulk', r)); out.B = { samples: a, rec };
  return out;
}
module.exports = { classify, stages, pr, TH, PLAN };
if (require.main === module) {
  const seed = +process.argv[2] || 104; const cl = L.genClaim(seed); console.log('seed', seed, 'truth', E.truthOz(cl).toFixed(0), 'true coarse share (streak-weighted)', (cl.blocks.reduce((a, b) => a + b.mix[0] * b.f, 0) / cl.blocks.reduce((a, b) => a + b.f, 0)).toFixed(2), 'hist', cl.histGrade.toFixed(4), 'coarseMg', cl.blocks[0].coarseMg.toFixed(0), 'bedrock', cl.blocks[0].bedrock);
  console.log('D  :', cl.blocks.map(b => (b.OB + b.Tg).toFixed(0)).join(' ')); console.log('f  :', cl.blocks.map(b => b.f.toFixed(1)).join(' ')); console.log('g  :', cl.blocks.map(b => b.g.toFixed(4)).join(' '));
  const st = stages(cl, seed);
  for (const k of ['s0', 's0r', 's1', 's2', 's3', 's4', 'A', 'B']) { const res = E.estimate(pr, st[k].samples, { records: st[k].rec }); const ag = E.aggregate(pr, res); const c = classify(res, ag, st[k].samples);
    const pc = Math.exp(res.co.mr) / (1 + Math.exp(res.co.mr));
    const nr = st[k].samples.filter(s => s.method === 'excavatorPit'); 
    console.log(k.padEnd(4), `P10 ${ag.P10.toFixed(0)} P50 ${ag.P50.toFixed(0)} P90 ${ag.P90.toFixed(0)} spread ${ag.spread.toFixed(2)} | base ${ag.bP10.toFixed(0)}/${ag.bP50.toFixed(0)}/${ag.bP90.toFixed(0)} bspread ${ag.baseSpread.toFixed(2)} pocketMean ${ag.pocketMean.toFixed(0)} | pBarren ${ag.pBarren.toFixed(3)} coarse ${pc.toFixed(2)} sdlnR ${Math.sqrt(res.co.vr).toFixed(2)} | ${c.cls} cov0 ${c.cov0.toFixed(2)} cov2 ${c.cov2.toFixed(2)} coarseSd ${c.coarseSd.toFixed(3)} proc ${c.proc.toFixed(0)} nBed ${c.nBed} minable ${c.minable} | pits ${nr.map(s => s.reachedBedrock ? 'B' : (s.reachedPay ? 'u' : 'o')).join('')} ${st[k].best !== undefined ? 'bulk@' + st[k].best : ''}`); }
}
