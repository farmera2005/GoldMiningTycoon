const g = require('./goldsim.js');
const V = {
  D: { jumpBase: 0.02, jumpExpMean: 0.015, mu: { bull: 0.16, range: 0.01, bear: -0.15 }, exitP: { bull: 0.0060, range: 0.0090, bear: 0.0055 }, kappa: 0.25 },
  E: { jumpBase: 0.02, jumpExpMean: 0.015, mu: { bull: 0.16, range: 0.01, bear: -0.15 }, exitP: { bull: 0.0060, range: 0.0090, bear: 0.0055 }, kappa: 0.25, sbar: 0.0180 },
  F: { jumpBase: 0.02, jumpExpMean: 0.015, mu: { bull: 0.17, range: 0.01, bear: -0.16 }, exitP: { bull: 0.0060, range: 0.0090, bear: 0.0055 }, kappa: 0.25, sbar: 0.0180, beta: 0.86 },
};
const w = process.argv[2]; Object.assign(g.P, V[w]);
for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); g.P[k] = Number(v); }
console.log('variant', w); g.stats(2000, 10);
