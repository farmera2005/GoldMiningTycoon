'use strict';
const L = require('./lib'); const E = require('./est');
const K = L.K; const ALPHA = 0.028;
// ---- 4.4 measurement table ----
const G = 0.010, mix = [0.25, 0.40, 0.27, 0.08], cMg = 150; const Gnc = G * (1 - mix[0]); const ncs = [0.40, 0.27, 0.08].map(x => x / 0.75);
const Tg = 5, B = 1.5, Vb = (Tg + B) * 1613;
const SM = JSON.parse(require('fs').readFileSync('smalltab.json'));
function sc(Ne) { const xs = SM.map(r => Math.log(r.n)); const x = Math.log(Ne); let i = 0; while (i < xs.length - 2 && x > xs[i + 1]) i++; const t = (x - xs[i]) / (xs[i + 1] - xs[i]); if (Ne > 300) return { b: -0.5 * Math.log(1 + 1 / Ne), v: Math.log(1 + 1 / Ne), beta: 1 }; const slope = (SM[i + 1].b - SM[i].b) / (xs[i + 1] - xs[i]); return { b: SM[i].b + t * (SM[i + 1].b - SM[i].b), v: SM[i].v + t * (SM[i + 1].v - SM[i].v), beta: Math.max(0.05, 1 + slope) }; }
for (const [name, m, V] of [['pit 5 bcy', L.METHODS.excavatorPit, 5], ['sonic, 5 ft gravel + 1.5 ft bedrock', L.METHODS.sonic, 0.0073 * 6.5], ['bulk 500 bcy', L.METHODS.bulk, 500]]) {
  const muS = ncs.reduce((a, s, k) => a + s * L.PM[k + 1] * (1 + L.PCV[k + 1] ** 2) / m.cap[k + 1], 0);
  const Enc = Gnc * V * K; const Ne = Enc / muS; const s = sc(Ne);
  const cvL = V < Vb ? Math.pow(Vb / V, ALPHA) - 1 : 0; const cvM = (1 + m.volumeCv ** 2) * (1 + m.weighCv ** 2) - 1;
  const vP = s.v / (s.beta ** 2); const v = vP + Math.log((1 + cvL) * (1 + cvM)) + 0.10 ** 2 + 0.01 + (0.25 ** 2) * 0.2 ** 2;
  const lamC = G * V * mix[0] * K / cMg * m.cap[0];
  console.log(`${name}: mu*nc ${muS.toFixed(3)} mg; E nc mass ${Enc.toFixed(1)} mg; Neff ${Ne.toFixed(2)}; small-count bias ${s.b.toFixed(3)} var ${s.v.toFixed(3)} beta ${s.beta.toFixed(2)} -> vP ${vP.toFixed(3)}; CV2_L ${cvL.toFixed(3)} (sigmaL ${Math.sqrt(Math.log(1 + cvL)).toFixed(2)}); CV2_M ${cvM.toFixed(3)}; v ${v.toFixed(3)} sd ${Math.sqrt(v).toFixed(2)}; coarse particles caught ${lamC.toFixed(3)} P(none) ${(Math.exp(-lamC) * 100).toFixed(1)}%`);
}
// ---- coarse factor ----
const pr = E.buildPriors(5, 4); const a0 = pr.alpha0, R0 = pr.R0; const b0 = Math.exp(L.digamma(a0)) / R0;
console.log('coarse prior alpha0', a0.toFixed(2), 'R0', R0.toFixed(3), 'beta0', b0.toFixed(2), 'sd lnR', Math.sqrt(L.trigamma(a0)).toFixed(3), 'share', (R0 / (1 + R0)).toFixed(3));
function gp(addN, addE, nb, Rt) { let a = a0, b = b0; const ph = 1 / (1 + Rt * addE * 0.25 ** 2); a += nb * ph * addN; b += nb * ph * addE; const mr = L.digamma(a) - Math.log(b); return { a, b, R: Math.exp(mr), sd: Math.sqrt(L.trigamma(a)), ph }; }
{ const Rtrue = 0.45; const mnc = Gnc * 5 * K; const Eb = 0.95 * mnc * 1 / (150 * 5); const r = gp(Rtrue * Eb, Eb, 20, 0.38); console.log('20 pits 5bcy Rtrue 0.45: E_b', Eb.toFixed(3), 'N_b', (Rtrue * Eb).toFixed(3), 'phi', r.ph.toFixed(3), 'alpha', r.a.toFixed(2), 'beta', r.b.toFixed(2), 'R', r.R.toFixed(3), 'sd', r.sd.toFixed(3)); }
{ const Rtrue = 0.45; const mnc = Gnc * 500 * K; const Eb = 0.95 * mnc / (150 * 5); const r = gp(Rtrue * Eb, Eb, 1, 0.42); console.log('bulk 500: E_b', Eb.toFixed(1), 'phi', r.ph.toFixed(3), 'alpha', r.a.toFixed(2), 'beta', r.b.toFixed(2), 'R', r.R.toFixed(3), 'sd', r.sd.toFixed(3), 'factor 1+R', (1 + r.R).toFixed(3), 'P10', (1 + r.R * Math.exp(-1.2816 * r.sd)).toFixed(3), 'P90', (1 + r.R * Math.exp(1.2816 * r.sd)).toFixed(3)); }
{ const r = gp(0, 0, 0, 0.33); console.log('30 sonic holes (no class masses): R', r.R.toFixed(3), 'sd', r.sd.toFixed(3)); }
// ---- one-block example within one paystreak hypothesis (block fully in streak) ----
{ const M = Math.log(0.0095); const v0 = pr.Vm + 0.25 + 0.35 ** 2; const pc = R0 / (1 + R0); const Ew = Math.log(1 + R0) + 0.5 * pc * (1 - pc) * L.trigamma(a0); const vr = L.trigamma(a0);
  const gobs = 0.0100; const m = L.METHODS.excavatorPit; const muS = ncs.reduce((a, s, k) => a + s * L.PM[k + 1] * (1 + L.PCV[k + 1] ** 2) / m.cap[k + 1], 0);
  const Gt = Math.exp(M - Ew) * 0.75; const pm = L.posMult(-1, Tg, Tg, B, 0.10, 2.0); const Veff = 5 * pm; const Ne = Gt * K * Veff / muS; const s = sc(Ne);
  const cvL = Math.pow(Vb / 5, ALPHA) - 1, cvM = (1 + m.volumeCv ** 2) * (1 + m.weighCv ** 2) - 1;
  const lg = Math.log(gobs / pm); const y = Math.log(Gt) + (lg - Math.log(Gt) - s.b) / s.beta + 0.5 * Math.log((1 + cvL) * (1 + cvM)) + Ew;
  const v = s.v / s.beta ** 2 + Math.log((1 + cvL) * (1 + cvM)) + 0.10 ** 2 + 0.10 ** 2 + pc ** 2 * 0.25 ** 2; const veff = v + pc * pc * vr;
  const post = M + (v0 / (v0 + veff)) * (y - M); const pv = v0 * veff / (v0 + veff);
  console.log(`one-block: prior lnG mean ${M.toFixed(3)} var ${v0.toFixed(4)} (P10/50/90 ${Math.exp(M - 1.2816 * Math.sqrt(v0)).toFixed(4)}/${Math.exp(M).toFixed(4)}/${Math.exp(M + 1.2816 * Math.sqrt(v0)).toFixed(4)}); Ew ${Ew.toFixed(3)} p ${pc.toFixed(3)} vr ${vr.toFixed(4)}; pm(granite, -1..5) ${pm.toFixed(3)}; Gt_nc ${Gt.toFixed(5)} Neff ${Ne.toFixed(1)} sc.b ${s.b.toFixed(4)} beta ${s.beta}; CV2L ${cvL.toFixed(3)} CV2M ${cvM.toFixed(3)}; y ${y.toFixed(3)} v ${v.toFixed(3)} veff ${veff.toFixed(3)}; weight ${(v0 / (v0 + veff)).toFixed(3)}; post mean ${post.toFixed(3)} var ${pv.toFixed(4)} -> P10/50/90 ${Math.exp(post - 1.2816 * Math.sqrt(pv)).toFixed(4)}/${Math.exp(post).toFixed(4)}/${Math.exp(post + 1.2816 * Math.sqrt(pv)).toFixed(4)}`); }
// ---- cutoff ----
for (const [lab, wash, strip, sr, price, fin] of [['north strip 2', 12, 2.5, 2, 4200, 0.86], ['north strip 6', 12, 2.5, 6, 4200, 0.86], ['north $3000 strip 2', 12, 2.5, 2, 3000, 0.86], ['arid strip 1.5', 14, 2.2, 1.5, 4200, 0.78]]) {
  const rec = 0.25 * 0.95 + 0.40 * 0.88 + 0.27 * 0.62 + 0.08 * 0.25; const recA = 0.10 * 0.95 + 0.30 * 0.88 + 0.40 * 0.62 + 0.20 * 0.25; const r = lab.startsWith('arid') ? recA : rec;
  console.log(lab, 'rec', r.toFixed(3), 'cutoff', ((wash + strip * sr) / (r * fin * price * 0.95)).toFixed(4)); }
