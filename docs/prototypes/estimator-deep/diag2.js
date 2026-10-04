'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
if ((process.argv[2]||'').includes('nopocket')) L.TPL.pocketP = 0;
const N = +process.argv[3] || 300;
const acc = { streak: [], off: [], streakNc: [], offNc: [] }; let lt = [], lm = [];
for (let t = 0; t < N; t++) {
  const cl = L.genClaim(300000 + t); const r = new L.Rng(t * 17 + 3);
  const samples = cl.blocks.map(b => L.drawSample(b, 5, 'excavatorPit', r));
  const res = E.estimate(pr, samples, {});
  const ag = E.aggregate(pr, res); const tr = E.truthOz(cl); lt.push(Math.log(tr / ag.P50)); lm.push(Math.log(tr / ag.mean));
  for (let a = 0; a < 20; a++) { const b = cl.blocks[a]; const m = res.wts[0] * res.blk[0][a] + res.wts[1] * res.blk[1][a]; const sd = Math.sqrt(res.cg[a][a]);
    const z = (Math.log(b.g) - m) / sd; const zn = (Math.log(b.g * (1 - b.mix[0])) - (m - res.W[a].Ew)) / sd;
    (b.f >= 0.4 ? acc.streak : acc.off).push(z); (b.f >= 0.4 ? acc.streakNc : acc.offNc).push(zn); }
}
const st = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return `n ${a.length} mean ${m.toFixed(3)} sd ${sd.toFixed(3)}`; };
for (const k in acc) console.log(k, st(acc[k]));
console.log('ln(truth/P50)', st(lt), ' ln(truth/mean)', st(lm));
