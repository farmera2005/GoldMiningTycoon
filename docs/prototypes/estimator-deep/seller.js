'use strict';
const L = require('./lib'); const E = require('./est'); const X = require('./example');
const K = L.K; const pr = X.pr;
L.METHODS.sellerPit3 = { mode: 'pit', maxDepth: 22, frozenOk: true, pen: 0.5, cap: [0.97, 0.93, 0.80, 0.45], volumeCv: 0.15, weighCv: 0.05, geomCv: 0.10, masses: true };
const cl = L.genClaim(104); const r = new L.Rng(4040);
const nDug = 15; const w = cl.blocks.map(b => (0.15 + b.f) * ((b.OB + b.Tg) <= 22 ? 1 : 0.4)); const sw = w.reduce((a, c) => a + c);
const dug = []; for (let k = 0; k < nDug; k++) { let u = r.unif() * sw, a = 0; while (u > w[a]) { u -= w[a]; a++; } const s = L.drawSample(cl.blocks[a], 3, 'sellerPit3', r); const m = L.METHODS.sellerPit3; s.stated = s.massBy.reduce((x, y) => x + y, 0) / (s.V * K); dug.push(s); }
dug.sort((a, b) => b.stated - a.stated); const shown = dug.slice(0, Math.max(3, Math.ceil(0.35 * nDug)));
const A = shown.reduce((a, s) => a + s.stated, 0) / shown.length;
console.log('seller dug', nDug, 'all-pit mean', (dug.reduce((a, s) => a + s.stated, 0) / nDug).toFixed(4), 'shown', shown.length, 'blocks', shown.map(s => s.block).join(','), 'grades', shown.map(s => s.stated.toFixed(3)).join(', '), 'stated avg', A.toFixed(4));
console.log('truth on shown blocks', shown.map(s => cl.blocks[s.block].g.toFixed(4)).join(', '), 'claim truth', E.truthOz(cl).toFixed(0));
// player: 6 twins on distinct shown blocks + 2 others
const tb = [...new Set(shown.map(s => s.block))]; const others = [0, 1, 2, 3, 16, 17, 18, 19].filter(a => !tb.includes(a)).slice(0, 8 - Math.min(6, tb.length));
const own = X.stages(cl, 104).s2.samples.filter(q => q.method === 'excavatorPit');
const recs = { histGrade: cl.histGrade };
const res = E.estimate(pr, own, { records: recs }); const ag = E.aggregate(pr, res);
console.log('own 8 pits:', 'P10/50/90', ag.P10.toFixed(0), ag.P50.toFixed(0), ag.P90.toFixed(0), 'spread', ag.spread.toFixed(2), 'pits', own.map(s => s.block + (s.reachedBedrock ? 'B' : s.reachedPay ? 'u' : 'o')).join(' '));
// naive: treat seller samples as own pits (capture-corrected as if excavatorPit-like)
const naive = own.concat(shown.map(s => ({ ...s, method: 'sellerPit3', reachedBedrock: true, interval: 'fullColumn', obs: { D: cl.blocks[s.block].OB + cl.blocks[s.block].Tg, Tg: cl.blocks[s.block].Tg, bedrock: cl.blocks[s.block].bedrock, OB: cl.blocks[s.block].OB } })));
const resN = E.estimate(pr, naive, { records: recs }); const agN = E.aggregate(pr, resN);
console.log('naive (seller as own):', agN.P10.toFixed(0), agN.P50.toFixed(0), agN.P90.toFixed(0));
// consistency test
const Bs = tb; const comps = res.out.map((o, h) => { const mus = Bs.map(a => res.blk[h][a]); const C = Bs.map(a => Bs.map(c => res.cg[a][c])); const f = E.fw(mus, C, Bs.map(() => true)); return { w: res.wts[h], ES: f.ES / Bs.length, s2: f.s2 }; });
const ES = comps.reduce((a, c) => a + c.w * c.ES, 0); const s2ref = comps.reduce((a, c) => a + c.w * c.s2, 0); const muRef = Math.log(ES) - s2ref / 2;
const pc = Math.exp(res.co.mr) / (1 + Math.exp(res.co.mr)); const sh = [pc, ...[0.40, 0.27, 0.08].map(x => x / 0.75 * (1 - pc))]; const m = L.METHODS.sellerPit3;
const capRatio = sh.reduce((a, s, k) => a + s * m.cap[k], 0); const pm = L.posMult(-0.5, 5, 5, 1.5, 0.19, 2.0);
const muTot = sh.reduce((a, s, k) => a + s * [150, 3, 0.1, 0.004][k] * (1 + L.PCV[k] ** 2) / m.cap[k], 0);
const Vb = 6.5 * 1613; const cvL = Math.pow(Vb / 3, 0.028) - 1; const cvP = muTot / (ES * 3 * K); const cvM = (1 + 0.15 ** 2) * (1 + 0.05 ** 2) - 1;
const cv1 = (1 + cvL) * (1 + cvP) * (1 + cvM) - 1; const ns = shown.length; const s2s = Math.log(1 + cv1 / ns);
const zz = (Math.log(A) - muRef - Math.log(capRatio * pm) + s2s / 2) / Math.sqrt(s2ref + s2s); const pH = 2 * (1 - L.Phi(Math.abs(zz)));
console.log(`consistency: ref mean ${ES.toFixed(4)} median ${Math.exp(muRef).toFixed(4)} sd_ref ${Math.sqrt(s2ref).toFixed(3)}; capRatio ${capRatio.toFixed(3)} pm ${pm.toFixed(3)} -> expected honest ${(ES * capRatio * pm).toFixed(4)}; CV2 per pit: local ${cvL.toFixed(3)} particle ${cvP.toFixed(3)} meas ${cvM.toFixed(3)} total ${cv1.toFixed(3)}; n_s ${ns} sigma_s ${Math.sqrt(s2s).toFixed(3)}; z ${zz.toFixed(2)} pHonest ${pH.toFixed(4)}`);
// twin test
for (const s of shown) { const a = s.block; const comps2 = res.out.map((o, h) => ({ w: res.wts[h], mu: res.blk[h][a] })); const mu = comps2.reduce((x, c) => x + c.w * c.mu, 0); const v = res.cg[a][a] + comps2.reduce((x, c) => x + c.w * (c.mu - mu) ** 2, 0);
  const cv1b = (1 + cvL) * (1 + muTot / (Math.exp(mu) * 3 * K)) * (1 + cvM) - 1; const zt = (Math.log(s.stated) - mu - Math.log(capRatio * pm) + 0.5 * Math.log(1 + cv1b)) / Math.sqrt(v + Math.log(1 + cv1b));
  console.log(`  twin block ${a}: seller ${s.stated.toFixed(4)} player posterior median ${Math.exp(mu).toFixed(4)} z ${zt.toFixed(2)}`); }

// claim-wide test: claimed grade applied to the believed paystreak (nPS blocks) vs player's posterior over the top-nPS blocks
const nPS = cl.blocks.filter(b => b.f >= 0.4).length; const order = pr.blocks.map(b => b.idx).sort((a, c) => E.blockQuant(pr, res, c)[1] - E.blockQuant(pr, res, a)[1]).slice(0, nPS);
const compsW = res.out.map((o, h) => { const mus = order.map(a => res.blk[h][a]); const C = order.map(a => order.map(c => res.cg[a][c])); const f = E.fw(mus, C, order.map(() => true)); return { w: res.wts[h], ES: f.ES / nPS, s2: f.s2 }; });
const ESw = compsW.reduce((a, c) => a + c.w * c.ES, 0); const s2w = compsW.reduce((a, c) => a + c.w * c.s2, 0); const muW = Math.log(ESw) - s2w / 2;
const cvB = Math.exp(0.25 + 0.35 ** 2) - 1; const cv1w = (1 + cvL) * (1 + muTot / (ESw * 3 * K)) * (1 + cvM) - 1; const s2sw = Math.log(1 + (cv1w + cvB) / ns);
const zw = (Math.log(A) - muW - Math.log(capRatio * pm) + s2sw / 2) / Math.sqrt(s2w + s2sw); const pw = 2 * (1 - L.Phi(Math.abs(zw)));
const claimedOz = A * nPS * (5 + 1.54) * 1613;
console.log(`claim-wide: nPS ${nPS} claimedRawOz ${claimedOz.toFixed(0)}; ref mean grade over top-${nPS} ${ESw.toFixed(4)} median ${Math.exp(muW).toFixed(4)} sd ${Math.sqrt(s2w).toFixed(3)}; expected honest ${(ESw * capRatio * pm).toFixed(4)}; CV2 per pit ${cv1w.toFixed(3)} between ${cvB.toFixed(3)} sigma_s ${Math.sqrt(s2sw).toFixed(3)}; z ${zw.toFixed(2)} pHonest ${pw.toFixed(4)}`);
