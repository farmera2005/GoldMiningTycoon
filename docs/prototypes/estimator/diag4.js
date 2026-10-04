'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
const N = +process.argv[2] || 300; const reach = +process.argv[3] || 22;
L.METHODS.excavatorPit.maxDepth = reach;
const grp = { allBed: { in: 0, lo: 0, hi: 0, le: [] }, some: { in: 0, lo: 0, hi: 0, le: [] } };
const zS = [], zO = [];
for (let t = 0; t < N; t++) {
  const cl = L.genClaim(900000 + t); const r = new L.Rng(t * 13 + 5);
  const samples = cl.blocks.map(b => L.drawSample(b, 5, 'excavatorPit', r));
  const res = E.estimate(pr, samples, {}); const ag = E.aggregate(pr, res); const tr = E.truthOz(cl);
  const g = samples.every(s => s.reachedBedrock) ? grp.allBed : grp.some;
  if (tr < ag.P10) g.lo++; else if (tr > ag.P90) g.hi++; else g.in++; g.le.push(Math.log(ag.P50 / tr));
  for (let a = 0; a < 20; a++) { const b = cl.blocks[a]; const m = res.wts.reduce((acc, w, h) => acc + w * res.blk[h][a], 0); const v = res.cg[a][a] + res.wts.reduce((acc, w, h) => acc + w * (res.blk[h][a] - m) ** 2, 0);
    if (!b.pocket) (b.f >= 0.4 ? zS : zO).push((Math.log(b.g) - m) / Math.sqrt(v)); }
}
const st = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return `n ${a.length} mean ${m.toFixed(3)} sd ${sd.toFixed(3)}`; };
for (const k in grp) { const q = grp[k]; const n = q.in + q.lo + q.hi; const le = q.le.sort((a, b) => a - b); console.log(k, 'n', n, 'cover', (q.in / n).toFixed(3), 'lo', (q.lo / n).toFixed(3), 'hi', (q.hi / n).toFixed(3), 'median', le[Math.floor(n / 2)]?.toFixed(3)); }
console.log('streak z', st(zS)); console.log('off z', st(zO));
