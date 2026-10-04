'use strict';
const L = require('./lib'); const E = require('./est');
const pr = E.buildPriors(5, 4);
const cl = L.genClaim(19, 5, 4, { barren: false });
const r = new L.Rng(1);
const samples = cl.blocks.map(b => L.drawSample(b, 5, 'excavatorPit', r));
const geo = E.geometry(pr, samples);
for (const a of [2, 3, 4, 6, 7]) { const b = cl.blocks[a], s = samples[a]; const dtb = b.OB + b.Tg; const h1 = dtb - s.depthReached;
  const pmT = L.posMult(Math.max(h1, -b.B), b.Tg, b.Tg, b.B, b.sb, b.lg);
  const Dhat = Math.exp(geo.D.mean[a]); const Tc = Math.exp(geo.T.mean[a]); const Tg = Tc - geo.Bhat[a]; const h1e = Dhat - s.depthReached;
  const pmE = L.posMult(Math.min(0.95 * Tg, Math.max(0.05 * Tg, h1e)), Tg, Tg, geo.Bhat[a], geo.sbhat[a], 2.0);
  console.log(a, `OB ${b.OB.toFixed(1)} obsOB ${s.obs.OB?.toFixed(1)} Tg ${b.Tg.toFixed(1)} B ${b.B.toFixed(1)} lg ${b.lg.toFixed(2)} perm ${b.perm.toFixed(2)} depthReached ${s.depthReached.toFixed(1)} h1 ${h1.toFixed(2)} pmTrue ${pmT.toFixed(3)} | Dhat ${Dhat.toFixed(1)} Tghat ${Tg.toFixed(2)} h1e ${h1e.toFixed(2)} pmEst ${pmE.toFixed(3)}`); }
