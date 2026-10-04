const L = require('./lib'); const E = require('./est');
function bench(nA, nC, nS, reps) { const pr = E.buildPriors(nA, nC); const cl = L.genClaim(104, nA, nC); const r = new L.Rng(3);
  const s = []; for (let k = 0; k < nS; k++) s.push(L.drawSample(cl.blocks[(k * 7) % cl.blocks.length], 5, 'excavatorPit', r));
  E.estimate(pr, s, {}); const t0 = process.hrtime.bigint(); let ag; for (let i = 0; i < reps; i++) { const res = E.estimate(pr, s, {}); ag = E.aggregate(pr, res); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / reps; const res = E.estimate(pr, s, {}); console.log(`${nA}x${nC} blocks, ${nS} samples, ${pr.hyps.length} hyps -> surviving ${res.hypIdx.length}; ${ms.toFixed(1)} ms per estimate+aggregate; P50 ${ag.P50.toFixed(0)}`); }
bench(5, 4, 0, 5); bench(5, 4, 20, 10); bench(16, 10, 60, 2);
