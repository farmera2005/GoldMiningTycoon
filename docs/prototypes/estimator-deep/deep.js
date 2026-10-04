'use strict';
const L = require('./lib');
const OBMED = +(process.env.OBMED ?? 30);
L.TPL.obMed = OBMED;               // deep-muck setting: visible, so the prior knows it too
const E = require('./est'); const X = require('./example');
const pr = X.pr;
function run(seed, verbose) {
  const cl = L.genClaim(seed); const truth = E.truthOz(cl);
  const r = new L.Rng(seed * 7919 + 13); const B = cl.blocks; const rec = { histGrade: cl.histGrade };
  let pans = []; for (let k = 0; k < 24; k++) pans.push(L.drawSample(B.filter(x => x.channel)[k % 5], 0.067, 'pan', r));
  const pits = B.map(b => L.drawSample(b, 5, 'excavatorPit', r));           // 30-t excavator, 22 ft reach
  const pits45 = B.map(b => L.drawSample(b, 5, 'excavatorPit', r, { maxDepth: 27 })); // 45-t, 27 ft
  const sonic = B.map(b => L.drawSample(b, 'drill', 'sonic', r));          // one hole per block
  const st = { s0r: [], pans: pans, pits: pans.concat(pits), pits45: pans.concat(pits45), sonic: pans.concat(sonic) };
  const out = {};
  for (const k in st) { const res = E.estimate(pr, st[k], { records: rec }); const ag = E.aggregate(pr, res); const c = X.classify(res, ag, st[k]);
    out[k] = { ag, c, res }; }
  const Dm = B.reduce((a, b) => a + b.OB + b.Tg, 0) / B.length; const ft = B.reduce((a, b) => a + b.OB + b.Tg + 3, 0);
  return { seed, truth, Dm, ft, out, cl, pits, sonic };
}
const seeds = process.argv.slice(2).map(Number);
for (const s of seeds) { const o = run(s); 
  console.log(`seed ${s} truth ${o.truth.toFixed(0)} meanD ${o.Dm.toFixed(1)} sonicFt ${o.ft.toFixed(0)} barren ${o.cl.barren} hist ${o.cl.histGrade.toFixed(4)}`);
  console.log('  D:', o.cl.blocks.map(b => (b.OB + b.Tg).toFixed(0)).join(' '));
  console.log('  pits:', o.pits.map(p => p.reachedBedrock ? 'B' : (p.reachedPay ? 'u' : 'o')).join(''));
  for (const k in o.out) { const { ag, c, res } = o.out[k]; const pc = Math.exp(res.co.mr) / (1 + Math.exp(res.co.mr));
    console.log(`  ${k.padEnd(6)} P10 ${ag.P10.toFixed(0)} P50 ${ag.P50.toFixed(0)} P90 ${ag.P90.toFixed(0)} spread ${ag.spread.toFixed(2)} base ${ag.baseSpread.toFixed(2)} pB ${ag.pBarren.toFixed(3)} coarse ${pc.toFixed(2)} sdlnR ${Math.sqrt(res.co.vr).toFixed(2)} | ${c.cls} cov0 ${c.cov0.toFixed(2)} cov2 ${c.cov2.toFixed(2)} coarseSd ${c.coarseSd.toFixed(3)} nBed ${c.nBed} minable ${c.minable} cutMed ${c.cutMed.toFixed(4)}`); }
}
