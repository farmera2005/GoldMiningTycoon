const L = require('./lib'); const E = require('./est'); const X = require('./example');
const keys = ['s0', 's0r', 's1', 's2', 's3', 's4', 'A', 'B']; const acc = Object.fromEntries(keys.map(k => [k, { sp: [], bsp: [], cls: {} }]));
for (let t = 0; t < 300; t++) { const cl = L.genClaim(100000 + t); const st = X.stages(cl, 100000 + t);
  for (const k of keys) { const res = E.estimate(X.pr, st[k].samples, { records: st[k].rec }); const ag = E.aggregate(X.pr, res); const c = X.classify(res, ag, st[k].samples); acc[k].sp.push(ag.spread); acc[k].bsp.push(ag.baseSpread); acc[k].cls[c.cls] = (acc[k].cls[c.cls] || 0) + 1; } }
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const k of keys) console.log(k.padEnd(4), 'median spread', med(acc[k].sp).toFixed(2), 'median base spread', med(acc[k].bsp).toFixed(2), JSON.stringify(acc[k].cls));
