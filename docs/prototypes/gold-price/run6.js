const g = require('./goldsim.js');
Object.assign(g.P, { jumpBase: 0.02, jumpExpMean: 0.015, sbar: 0.0180, etaV: 1.0, mu: { bull: 0.14, range: 0.01, bear: -0.16 }, exitP: { bull: 0.0045, range: 0.0085, bear: 0.0045 }, kappa: 0.25, toBullFromRange: 0.45 });
const N = 3000; const occ = { bull: 0, range: 0, bear: 0 }; let y1down15 = 0, y1up15 = 0, y2min = [], wk1abs = [];
const y1 = [];
for (let p = 0; p < N; p++) {
  const r = g.runPath(1000 + p, 2);
  occ[r.regimes[0]]++;
  const e1 = r.prices[52] / r.prices[0]; y1.push(e1);
  if (e1 < 0.85) y1down15++; if (e1 > 1.15) y1up15++;
  y2min.push(Math.min(...r.prices.slice(0, 105)) / r.prices[0]);
}
y1.sort((a,b)=>a-b); y2min.sort((a,b)=>a-b);
console.log('opening regime (week 1) share', Object.fromEntries(Object.entries(occ).map(([k,v])=>[k,(v/N).toFixed(3)])));
console.log('year-1 S52/S0 p10', y1[Math.floor(.1*N)].toFixed(3), 'p50', y1[Math.floor(.5*N)].toFixed(3), 'p90', y1[Math.floor(.9*N)].toFixed(3), 'P(<0.85)', (y1down15/N).toFixed(3), 'P(>1.15)', (y1up15/N).toFixed(3));
console.log('2-yr min S/S0 p10', y2min[Math.floor(.1*N)].toFixed(3), 'p25', y2min[Math.floor(.25*N)].toFixed(3), 'p50', y2min[Math.floor(.5*N)].toFixed(3));
