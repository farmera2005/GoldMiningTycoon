'use strict';
const L = require('./lib'); const E = require('./est');
const flag = process.argv[2] || '';
if (flag.includes('nopocket')) L.TPL.pocketP = 0;
const pr = E.buildPriors(5, 4);
const res = E.estimate(pr, [], {}); const ag = E.aggregate(pr, res);
const N = 20000; const tr = []; for (let t = 0; t < N; t++) tr.push(E.truthOz(L.genClaim(500000 + t)));
tr.sort((a, b) => a - b); const q = p => tr[Math.floor(p * N)];
console.log('prior est: P10', ag.P10.toFixed(0), 'P50', ag.P50.toFixed(0), 'P90', ag.P90.toFixed(0), 'mean', ag.mean.toFixed(0));
console.log('truth MC:  P10', q(0.1).toFixed(0), 'P50', q(0.5).toFixed(0), 'P90', q(0.9).toFixed(0), 'mean', (tr.reduce((a, b) => a + b) / N).toFixed(0));
// non-barren only
const tr2 = []; for (let t = 0; t < 8000; t++) tr2.push(E.truthOz(L.genClaim(600000 + t, 5, 4, { barren: false }))); tr2.sort((a, b) => a - b);
console.log('truth nonbarren P10', tr2[800].toFixed(0), 'P50', tr2[4000].toFixed(0), 'P90', tr2[7200].toFixed(0), 'mean', (tr2.reduce((a, b) => a + b) / 8000).toFixed(0));
const nb = res.out.map((o, h) => h).filter(h => !pr.hyps[h].barren);
// estimator nonbarren comps
const bl = pr.blocks; const comps = nb.map(h => { const mus = bl.map((b, a) => res.blk[h][a] + res.geo.T.mean[a] + Math.log(1613)); const C = bl.map((_, a) => bl.map((_, c) => res.cg[a][c] + res.geo.T.cov[a][c])); const r = E.fw(mus, C, bl.map(() => true)); return { w: pr.hyps[h].prior, mu: r.mu, s2: r.s2, ES: r.ES }; });
const sw = comps.reduce((a, c) => a + c.w, 0); comps.forEach(c => c.w /= sw);
console.log('est nonbarren P10', E.mixQuant(comps, 0.1).toFixed(0), 'P50', E.mixQuant(comps, 0.5).toFixed(0), 'P90', E.mixQuant(comps, 0.9).toFixed(0), 'mean', comps.reduce((a, c) => a + c.w * c.ES, 0).toFixed(0));
// thickness check
let sT = 0, sTe = 0; for (let t = 0; t < 2000; t++) { const cl = L.genClaim(700000 + t); for (const b of cl.blocks) sT += Math.log(b.Tg + b.B); } console.log('mean ln T truth', (sT / 40000).toFixed(3), 'est', (res.geo.T.mean.reduce((a, b) => a + b) / 20).toFixed(3));
let sg = 0; for (let t = 0; t < 2000; t++) { const cl = L.genClaim(800000 + t, 5, 4, { barren: false }); for (const b of cl.blocks) sg += Math.log(b.g); } console.log('mean ln g truth nonbarren', (sg / 40000).toFixed(3), 'est', (nb.reduce((a, h) => a + pr.hyps[h].prior / sw * res.blk[h].reduce((x, y) => x + y) / 20, 0)).toFixed(3));
