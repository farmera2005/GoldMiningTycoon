'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
const flag = process.argv[2] || '';
if (flag.includes('nopocket')) L.TPL.pocketP = 0;
const N = +process.argv[3] || 300;
// block-level check: for each pit with fullColumn, compare non-coarse obs y vs truth ln(Gnc_true) and z-score
let zs = [], zsU = [], zsE = [];
let cov = { in: 0, lo: 0, hi: 0 }, n = 0;
for (let t = 0; t < N; t++) {
  const cl = L.genClaim(200000 + t); const r = new L.Rng(t * 31 + 7);
  const samples = cl.blocks.map(b => L.drawSample(b, 5, 'excavatorPit', r));
  const res = E.estimate(pr, samples, {});
  for (const row of res.rows) { if (row.block === undefined) continue; const b = cl.blocks[row.block];
    const gnc = b.g * (1 - b.mix[0]); const pred = row.y - res.W[row.block].Ew; // obs of ln Gnc (+ ..)
    const s = samples[row.block]; const z = (pred - Math.log(gnc)) / Math.sqrt(row.v);
    if (s.interval === 'fullColumn') zs.push(z); else if (s.interval === 'upperPay') zsU.push(z); }
  // block-level coverage of total grade
  for (let a = 0; a < 20; a++) { const q = E.blockQuant(pr, res, a); const g = cl.blocks[a].g; n++; if (g < q[0]) cov.lo++; else if (g > q[2]) cov.hi++; else cov.in++; }
}
const st = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); const s = a.slice().sort((x, y) => x - y); return `n ${a.length} mean ${m.toFixed(3)} sd ${sd.toFixed(3)} median ${s[Math.floor(a.length / 2)].toFixed(3)}`; };
console.log('fullColumn z', st(zs)); console.log('upperPay z', st(zsU));
console.log('block total-grade coverage', (cov.in / n).toFixed(3), 'below', (cov.lo / n).toFixed(3), 'above', (cov.hi / n).toFixed(3));
