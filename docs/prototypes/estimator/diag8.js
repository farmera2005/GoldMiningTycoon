'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
const N = 300; const z = [], zc = [], zn = []; let ne = [];
for (let t = 0; t < N; t++) {
  const cl = L.genClaim(1200000 + t); const r = new L.Rng(t * 11 + 1);
  const samples = cl.blocks.map(b => L.drawSample(b, 'drill', 'sonic', r));
  const res = E.estimate(pr, samples, {});
  for (const row of res.rows) { if (row.block === undefined) continue; const b = cl.blocks[row.block]; const s = samples[row.block];
    const pred = row.y - res.W[row.block].Ew; const zz = (pred - Math.log(b.g * (1 - b.mix[0]))) / Math.sqrt(row.v); z.push(zz); (s.colors[0] > 0 ? zc : zn).push(zz); ne.push(row.info?.Ne ?? 0); }
}
const st = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return `n ${a.length} mean ${m.toFixed(3)} sd ${sd.toFixed(3)}`; };
console.log('sonic nc z all', st(z)); console.log('with coarse colour', st(zc)); console.log('no coarse', st(zn));
ne.sort((a, b) => a - b); console.log('Neff p10/p50/p90', ne[Math.floor(ne.length * 0.1)]?.toFixed(2), ne[Math.floor(ne.length / 2)]?.toFixed(2), ne[Math.floor(ne.length * 0.9)]?.toFixed(2));
