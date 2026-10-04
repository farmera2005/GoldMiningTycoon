'use strict';
const L = require('./lib');
const E = require('./est'); const X = require('./example'); const pr = X.pr;
const seed = 104; const cl = L.genClaim(seed); const st = X.stages(cl, seed);
for (const mult of [1.0, 0.875]) { pr.M = Math.log(L.TPL.gMed * mult); const out = [];
  for (const k of ['s0','s0r','s1','s2','s3','s4','A']) { const res = E.estimate(pr, st[k].samples, { records: st[k].rec }); const ag = E.aggregate(pr, res); out.push(`${k} ${ag.P10.toFixed(0)}/${ag.P50.toFixed(0)}/${ag.P90.toFixed(0)}`); }
  console.log(mult, out.join(' | ')); }
