const L = require('./lib'); const E = require('./est');
for (const [nodes, prune] of [[9, 1e-4], [7, 1e-3]]) { E.EST.streakNodes = nodes; E.EST.prune = prune;
  for (const [nA, nC, nS, seed] of [[16, 10, 60, 104], [16, 10, 60, 7], [5, 4, 20, 104], [5, 4, 20, 31]]) { const pr = E.buildPriors(nA, nC); const cl = L.genClaim(seed, nA, nC); const r = new L.Rng(3);
    const s = []; for (let k = 0; k < nS; k++) s.push(L.drawSample(cl.blocks[(k * 7) % cl.blocks.length], 5, 'excavatorPit', r));
    const t0 = process.hrtime.bigint(); const res = E.estimate(pr, s, {}); const ag = E.aggregate(pr, res); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`nodes ${nodes} prune ${prune} ${nA}x${nC} seed ${seed}: hyps ${pr.hyps.length} surviving ${res.hypIdx.length} ${ms.toFixed(0)} ms P10/50/90 ${ag.P10.toFixed(0)}/${ag.P50.toFixed(0)}/${ag.P90.toFixed(0)}`); } }
