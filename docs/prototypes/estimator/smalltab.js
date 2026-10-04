'use strict';
const L = require('./lib');
// transform t = ln(max(M, 0.5 mu*) / E[M]) for non-coarse composite mass; table of mean and variance by N_eff = E[M]/mu*
const share = [0.40 / 0.75, 0.27 / 0.75, 0.08 / 0.75], mu = [3, 0.1, 0.004], cv = [1.0, 0.7, 0.5];
const muStar = share.reduce((a, s, k) => a + s * mu[k] * (1 + cv[k] ** 2), 0);
const r = new L.Rng(77);
const grid = [0.03, 0.1, 0.3, 0.5, 1, 2, 3, 5, 10, 20, 50, 100, 300];
const out = [];
for (const Ne of grid) { const E = Ne * muStar; let s1 = 0, s2 = 0; const n = 40000;
  for (let t = 0; t < n; t++) { let M = 0; for (let k = 0; k < 3; k++) { const lam = E * share[k] / mu[k]; const N = r.pois(lam); if (N <= 40) for (let q = 0; q < N; q++) M += mu[k] * r.lnMean(cv[k]); else M += Math.max(0, N * mu[k] + Math.sqrt(N) * mu[k] * cv[k] * r.norm()); }
    const x = Math.log(Math.max(M, 0.5 * muStar) / E); s1 += x; s2 += x * x; }
  const m = s1 / n, v = s2 / n - m * m; out.push([Ne, m, v, -0.5 * Math.log(1 + 1 / Ne), Math.log(1 + 1 / Ne)]); }
console.log('muStar', muStar.toFixed(3));
for (const o of out) console.log(`Neff ${String(o[0]).padStart(5)}  bias ${o[1].toFixed(3)}  var ${o[2].toFixed(3)}  | lognormal approx bias ${o[3].toFixed(3)} var ${o[4].toFixed(3)}`);
require('fs').writeFileSync('smalltab.json', JSON.stringify(out.map(o => ({ n: o[0], b: +o[1].toFixed(4), v: +o[2].toFixed(4) }))));
