'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
const bins = [[0, 0.3], [0.3, 1], [1, 3], [3, 1e9]]; const acc = bins.map(() => []); const accT = bins.map(() => []);
for (let t = 0; t < 300; t++) {
  const cl = L.genClaim(1200000 + t); const r = new L.Rng(t * 11 + 1);
  const samples = cl.blocks.map(b => L.drawSample(b, 'drill', 'sonic', r));
  const res = E.estimate(pr, samples, {});
  for (const row of res.rows) { if (row.block === undefined) continue; const b = cl.blocks[row.block];
    const pred = row.y - res.W[row.block].Ew; const zz = (pred - Math.log(b.g * (1 - b.mix[0]))) / Math.sqrt(row.v);
    const NeT = b.g * (1 - b.mix[0]) * L.K * samples[row.block].V / 3.43; // true Neff
    const k = bins.findIndex(([lo, hi]) => row.info.Ne >= lo && row.info.Ne < hi); acc[k].push(zz);
    const k2 = bins.findIndex(([lo, hi]) => NeT >= lo && NeT < hi); accT[k2].push(zz); }
}
const st = a => { if (!a.length) return 'n 0'; const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return `n ${a.length} mean ${m.toFixed(3)} sd ${sd.toFixed(3)}`; };
bins.forEach((b, i) => console.log('est Neff', b.join('-'), st(acc[i]), ' | true Neff', st(accT[i])));
