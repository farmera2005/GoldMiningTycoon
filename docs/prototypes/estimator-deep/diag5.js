'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
const cl = L.genClaim(+process.argv[2] || 16, 5, 4, { barren: false });
// fake samples: pit masses exactly expected, huge volume to kill noise
const r = new L.Rng(1);
const samples = cl.blocks.map(b => { const s = L.drawSample(b, 5, 'excavatorPit', r); return s; });
const res = E.estimate(pr, samples, {});
console.log('top hyps:', res.wts.map((w, h) => [w, h]).sort((a, b) => b[0] - a[0]).slice(0, 5).map(([w, h]) => `${w.toFixed(3)} c=${pr.hyps[h].c.map(v=>v.toFixed(0)).join('/')} hw=${pr.hyps[h].hw.toFixed(0)} b=${pr.hyps[h].barren}`).join(' | '));
for (let a = 0; a < 8; a++) { const b = cl.blocks[a]; const m = res.wts.reduce((acc, w, h) => acc + w * res.blk[h][a], 0); const row = res.rows.find(q => q.block === a);
  console.log(a, 'f', b.f.toFixed(2), 'ln g', Math.log(b.g).toFixed(2), 'obs(lnG)', row ? row.y.toFixed(2) : '-', 'v', row ? row.v.toFixed(2) : '-', 'post', m.toFixed(2), 'sd', Math.sqrt(res.cg[a][a]).toFixed(2), 'int', samples[a].interval); }
console.log('post m', (res.wts.reduce((acc, w, h) => acc + w * res.out[h].mu[0], 0)).toFixed(2), 'claimLog+M', (cl.claimLog + Math.log(0.0095)).toFixed(2));
