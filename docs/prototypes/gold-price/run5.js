const g = require('./goldsim.js');
const common = { jumpBase: 0.02, jumpExpMean: 0.015, sbar: 0.0180, etaV: 1.0 };
const V = {
  J: { mu: { bull: 0.13, range: 0.01, bear: -0.15 }, exitP: { bull: 0.0045, range: 0.0085, bear: 0.0045 }, kappa: 0.25 },
  K: { mu: { bull: 0.14, range: 0.01, bear: -0.16 }, exitP: { bull: 0.0045, range: 0.0085, bear: 0.0045 }, kappa: 0.25, toBullFromRange: 0.45 },
  L: { mu: { bull: 0.14, range: 0.00, bear: -0.15 }, exitP: { bull: 0.0045, range: 0.0085, bear: 0.0048 }, kappa: 0.22, toBullFromRange: 0.45 },
};
const w = process.argv[2]; Object.assign(g.P, common, V[w]);
for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); g.P[k] = Number(v); }
console.log('variant', w, process.argv.slice(3).join(' ')); g.stats(2000, 10);
