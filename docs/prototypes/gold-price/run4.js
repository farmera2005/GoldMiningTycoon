const g = require('./goldsim.js');
const common = { jumpBase: 0.02, jumpExpMean: 0.015, sbar: 0.0180 };
const V = {
  G: { etaV: 1.0, mu: { bull: 0.14, range: 0.01, bear: -0.13 }, exitP: { bull: 0.0040, range: 0.0085, bear: 0.0050 }, kappa: 0.20 },
  H: { etaV: 1.0, mu: { bull: 0.13, range: 0.01, bear: -0.12 }, exitP: { bull: 0.0040, range: 0.0085, bear: 0.0050 }, kappa: 0.25 },
  I: { etaV: 0.8, etaSplitV: 1.0, mu: { bull: 0.13, range: 0.01, bear: -0.13 }, exitP: { bull: 0.0045, range: 0.0085, bear: 0.0050 }, kappa: 0.25 },
};
const w = process.argv[2]; Object.assign(g.P, common, V[w]);
for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); g.P[k] = Number(v); }
console.log('variant', w); g.stats(2000, 10);
