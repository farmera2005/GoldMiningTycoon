const g = require('./goldsim.js');
const variants = {
  A: { jumpBase: 0.02, jumpExpMean: 0.015, mu: { bull: 0.17, range: 0.02, bear: -0.15 }, exitP: { bull: 0.0055, range: 0.0096, bear: 0.0070 } },
  B: { jumpBase: 0.02, jumpExpMean: 0.015, mu: { bull: 0.16, range: 0.01, bear: -0.16 }, exitP: { bull: 0.0055, range: 0.0090, bear: 0.0065 } },
  C: { jumpBase: 0.02, jumpExpMean: 0.015, mu: { bull: 0.16, range: 0.01, bear: -0.16 }, exitP: { bull: 0.0055, range: 0.0090, bear: 0.0065 }, kappa: 0.25 },
};
const which = process.argv[2];
const base = JSON.parse(JSON.stringify({ mu: g.P.mu, exitP: g.P.exitP }));
Object.assign(g.P, variants[which]);
for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); g.P[k] = Number(v); }
console.log('variant', which);
g.stats(2000, 10);
