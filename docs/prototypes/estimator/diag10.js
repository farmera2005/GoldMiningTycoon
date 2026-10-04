'use strict';
const L = require('./lib'); const E = require('./est');
const mode = process.argv[2];
if (mode === 'masses') L.METHODS.sonic.masses = true;
if (mode === 'big') L.METHODS.sonic.perFt = 0.0073 * 8;
if (mode === 'nopocket') L.TPL.pocketP = 0;
const pr = E.buildPriors(5, 4);
const R = { in: 0, lo: 0, hi: 0, le: [] }; const N = 300;
for (let t = 0; t < N; t++) { const cl = L.genClaim(100000 + t); const r = new L.Rng(t * 7 + 3);
  const s = []; for (let k = 0; k < 30; k++) s.push(L.drawSample(cl.blocks[k % 20], 'drill', 'sonic', r));
  const ag = E.aggregate(pr, E.estimate(pr, s, { records: { histGrade: cl.histGrade } })); const tr = E.truthOz(cl);
  if (tr < ag.P10) R.lo++; else if (tr > ag.P90) R.hi++; else R.in++; R.le.push(Math.log(ag.P50 / tr)); }
R.le.sort((a, b) => a - b); console.log(mode, 'cover', (R.in / N).toFixed(3), 'lo', (R.lo / N).toFixed(3), 'hi', (R.hi / N).toFixed(3), 'median', R.le[N / 2].toFixed(3));
