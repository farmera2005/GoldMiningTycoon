'use strict';
const L = require('./lib'); const E = require('./est');
const { genClaim, drawSample, Rng, TPL } = L;
const pr = E.buildPriors(5, 4);
function stages(cl, seed, withRecords) {
  const r = new Rng(seed * 7919 + 13);
  const B = cl.blocks; const out = {}; let s = [];
  const rec = withRecords ? { histGrade: cl.histGrade } : null;
  out.s0 = { samples: [], rec: null };
  out.s0r = { samples: [], rec };
  for (let k = 0; k < 24; k++) { const b = B.filter(x => x.channel)[k % 5]; s.push(drawSample(b, 0.067, 'pan', r)); }
  const pans = s.slice(); out.s1 = { samples: s.slice(), rec };
  for (const b of B.filter(b => b.i === 1 || b.i === 3)) s.push(drawSample(b, 5, 'excavatorPit', r));
  out.s2 = { samples: s.slice(), rec };
  for (const b of B.filter(b => !(b.i === 1 || b.i === 3))) s.push(drawSample(b, 5, 'excavatorPit', r));
  out.s3 = { samples: s.slice(), rec };
  // bulk on highest-P50 block per current estimate
  const e3 = E.estimate(pr, s, { records: rec }); let best = 0, bv = -1e9; for (let a = 0; a < B.length; a++) { const m = e3.wts[0] * e3.blk[0][a] + e3.wts[1] * e3.blk[1][a]; if (m > bv) { bv = m; best = a; } }
  s.push(drawSample(B[best], 500, 'bulk', r)); out.s4 = { samples: s.slice(), rec, best };
  let a = pans.slice(); for (let k = 0; k < 30; k++) a.push(drawSample(B[k % 20], 'drill', 'sonic', r));
  out.A = { samples: a.slice(), rec }; a.push(drawSample(B[best], 500, 'bulk', r)); out.B = { samples: a, rec };
  return out;
}
function summarize(cl, st) {
  const res = E.estimate(pr, st.samples, { records: st.rec }); const ag = E.aggregate(pr, res);
  const p = res.W.map(w => w.p); const pc = Math.exp(res.co.mr) / (1 + Math.exp(res.co.mr));
  return { ag, res, coarseShare: pc, sdlnR: Math.sqrt(res.co.vr) };
}
const mode = process.argv[2] || 'example';
if (mode === 'example') {
  const seed = +process.argv[3] || 11;
  const cl = genClaim(seed);
  const t = E.truthOz(cl);
  console.log('seed', seed, 'barren', cl.barren, 'truth oz', t.toFixed(0), 'claimLog', cl.claimLog.toFixed(2), 'hist', cl.histGrade.toFixed(4));
  console.log('D:', cl.blocks.map(b => (b.OB + b.Tg).toFixed(0)).join(' '));
  console.log('f:', cl.blocks.map(b => b.f.toFixed(2)).join(' '));
  console.log('g:', cl.blocks.map(b => b.g.toFixed(4)).join(' '));
  console.log('coarse share truth (block mean):', (cl.blocks.reduce((a, b) => a + b.mix[0], 0) / 20).toFixed(2), 'perm', cl.blocks[0].perm.toFixed(2), 'bedrock', cl.blocks[0].bedrock, 'coarseMg', cl.blocks[0].coarseMg.toFixed(0));
  const st = stages(cl, seed, true);
  for (const k of ['s0', 's0r', 's1', 's2', 's3', 's4', 'A', 'B']) { const r = summarize(cl, st[k]); const ag = r.ag;
    const reached = st[k].samples.filter(s => s.method === 'excavatorPit').map(s => s.reachedBedrock ? 'Y' : 'n').join('');
    console.log(k.padEnd(4), 'P10', ag.P10.toFixed(0).padStart(6), 'P50', ag.P50.toFixed(0).padStart(6), 'P90', ag.P90.toFixed(0).padStart(6), 'spread', ag.spread.toFixed(2), 'pBarren', ag.pBarren.toFixed(3), 'coarse', r.coarseShare.toFixed(2), 'sdlnR', r.sdlnR.toFixed(2), reached, st[k].best !== undefined ? 'bulkBlock ' + st[k].best : ''); }
} else if (mode === 'calib') {
  const N = +process.argv[3] || 300; const keys = ['s0', 's0r', 's1', 's2', 's3', 's4', 'A', 'B']; const R = Object.fromEntries(keys.map(k => [k, { in: 0, lo: 0, hi: 0, le: [], sp: 0 }]));
  let sonicCoarse = { n: 0, below: 0 };
  for (let t = 0; t < N; t++) { const cl = genClaim(100000 + t); const tr = E.truthOz(cl); const st = stages(cl, 100000 + t, true);
    for (const k of keys) { const ag = summarize(cl, st[k]).ag; const q = R[k]; if (tr < ag.P10) q.lo++; else if (tr > ag.P90) q.hi++; else q.in++; q.le.push(Math.log(ag.P50 / tr)); q.sp += ag.spread; }
  }
  for (const k of keys) { const q = R[k]; const le = q.le.sort((a, b) => a - b); console.log(k.padEnd(4), 'cover', (q.in / N).toFixed(3), 'belowP10', (q.lo / N).toFixed(3), 'aboveP90', (q.hi / N).toFixed(3), 'median ln(P50/truth)', le[Math.floor(N / 2)].toFixed(3), 'mean spread', (q.sp / N).toFixed(2)); }
}
