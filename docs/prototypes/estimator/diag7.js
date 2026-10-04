'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4); L.METHODS.excavatorPit.maxDepth = 60;
let found = 0;
for (let t = 0; t < 400 && found < 2; t++) {
  const cl = L.genClaim(900000 + t); const r = new L.Rng(t * 13 + 5);
  const samples = cl.blocks.map(b => L.drawSample(b, 5, 'excavatorPit', r));
  if (!samples.every(s => s.reachedBedrock) || cl.barren) continue;
  const res = E.estimate(pr, samples, {}); const ag = E.aggregate(pr, res); const tr = E.truthOz(cl);
  if (tr < ag.P90) continue; found++;
  console.log('claim', t, 'truth', tr.toFixed(0), 'P10/50/90', ag.P10.toFixed(0), ag.P50.toFixed(0), ag.P90.toFixed(0), 'pBarren', ag.pBarren.toFixed(3), 'claimLog', cl.claimLog.toFixed(2));
  const top = res.wts.map((w, h) => [w, h]).sort((a, b) => b[0] - a[0]).slice(0, 3);
  for (const [w, h] of top) console.log('  hyp w', w.toFixed(3), 'f', pr.hyps[h].f.map(v => v.toFixed(1)).join(' '), 'm', res.out[h].mu[0].toFixed(2));
  console.log('  true f', cl.blocks.map(b => b.f.toFixed(1)).join(' '));
  for (let a = 0; a < 20; a++) { const b = cl.blocks[a]; const m = res.wts.reduce((acc, w, h) => acc + w * res.blk[h][a], 0); const row = res.rows.find(q => q.block === a);
    console.log('  ', a, 'f', b.f.toFixed(2), 'lnG', Math.log(b.g).toFixed(2), 'obs', row.y.toFixed(2), 'v', row.v.toFixed(2), 'post', m.toFixed(2), 'T', (b.Tg + b.B).toFixed(1), 'That', Math.exp(res.geo.T.mean[a]).toFixed(1), b.pocket ? 'POCKET' : ''); }
}
