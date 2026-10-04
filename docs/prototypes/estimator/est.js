'use strict';
const L = require('./lib');
const { K, BCY, TPL, PM, PCV, ALPHA, posMult, digamma, trigamma, Phi, chol, solveL, solveLT, invTrigamma, overlapF } = L;
const EST = {
  modelErrLogSd: 0.10, posFullLogSd: 0.10, posUpperLogSd: 0.40, posUpperExtra: 0.15, expoLambdaLogSd: 0.25, expoThickElast: 1.6,
  coarseBlockLogSd: 0.25, coarseMassPriorCount: 5, coarseClaimLogSd: null /* from §3 jitter */,
  censorTrigger: 1.10, censorPad: 1.15, censorLogSd: 0.25, streakRangeAlong: 2000,
  recordsRatio: 2.5, recordsLogSd: 0.5, streakNodes: 9, prune: +(process.env.PRUNE ?? 1e-4), smallCount: process.env.SC === 'irls' ? 'irls' : true, epSweeps: +(process.env.EP ?? 2), epMaxNe: 3, irlsMaxRatio: +(process.env.IRMAX ?? 1e9), irlsSwitchN: +(process.env.IRSW ?? 1e9), passes: +(process.env.PASSES ?? 2), streakResidLogSd: +(process.env.RESID ?? 0.35), pocketP: 0.015, pocketBcyMean: 1650, pocketBcy2: 3.33e6, pocketGradeMin: 0.15, pocketGradeMult: 15, pocketGradeCv2: 0.30, pocketHitNcGrade: 0.04, pocketHitMult: 6, bLogSdKnown: 0.115, bSdUnknownFt: 0.39,
};
const Z = 1.2816;
const SMALL = JSON.parse(require('fs').readFileSync(__dirname + '/smalltab.json', 'utf8'));
function smallCount(Ne) { // returns bias b, variance v, slope beta of E[t] wrt ln G
  const xs = SMALL.map(r => Math.log(r.n)); const x = Math.log(Math.max(SMALL[0].n, Math.min(SMALL[SMALL.length - 1].n, Ne)));
  let i = 0; while (i < xs.length - 2 && x > xs[i + 1]) i++; const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  const b = SMALL[i].b + t * (SMALL[i + 1].b - SMALL[i].b), v = SMALL[i].v + t * (SMALL[i + 1].v - SMALL[i].v); const slope = (SMALL[i + 1].b - SMALL[i].b) / (xs[i + 1] - xs[i]);
  if (Ne > SMALL[SMALL.length - 1].n) return { b: -0.5 * Math.log(1 + 1 / Ne), v: Math.log(1 + 1 / Ne), beta: 1 };
  return { b, v, beta: Math.max(0.05, 1 + slope) }; }
// size-mix jitter → prior sd of ln R (paystreak-centre)
function coarsePriorSd(nDraw = 200000) { const r = new L.Rng(4242); let s = 0, s2 = 0; for (let t = 0; t < nDraw; t++) { let m = TPL.mix.map(x => x * Math.exp(0.25 * r.norm())); const S = m.reduce((a, b) => a + b); m = m.map(x => x / S); const lr = Math.log(m[0] / (1 - m[0])); s += lr; s2 += lr * lr; } const mu = s / nDraw; return { mean: mu, sd: Math.sqrt(s2 / nDraw - mu * mu) }; }
// paystreak quadrature over centre offset c ~ N(0, wanderSd²) and half-width hw ~ LN(hwMed, sigHW)
function streakStats(xs) {
  const nc = 41, nh = 21; const cs = [], ws = [], hs = [], wh = [];
  for (let a = 0; a < nc; a++) { const z = -4 + 8 * a / (nc - 1); cs.push(z * TPL.wanderSd); ws.push(Math.exp(-z * z / 2)); }
  for (let a = 0; a < nh; a++) { const z = -3.5 + 7 * a / (nh - 1); hs.push(TPL.hwMed * Math.exp(TPL.sigHW * z)); wh.push(Math.exp(-z * z / 2)); }
  const W = ws.reduce((x, y) => x + y) * wh.reduce((x, y) => x + y);
  const n = xs.length; const Ef = Array(n).fill(0), Ef2 = Array(n).fill(0), El = Array(n).fill(0), Ell = xs.map(() => Array(n).fill(0));
  for (let a = 0; a < nc; a++) for (let b = 0; b < nh; b++) {
    const w = ws[a] * wh[b] / W; const f = xs.map(x => overlapF(x, cs[a], hs[b])); const lx = f.map(v => (v + (1 - v) * TPL.bgRatio));
    for (let i = 0; i < n; i++) { Ef[i] += w * f[i]; Ef2[i] += w * f[i] * f[i]; El[i] += w * lx[i]; for (let j = 0; j < n; j++) Ell[i][j] += w * lx[i] * lx[j]; }
  }
  // lx holds X (linear); moment-match a multivariate lognormal: S_ij = ln(1 + Cov(X_i,X_j)/(E X_i E X_j)), mu_i = ln E X_i − S_ii/2
  const S = Ell.map((r, i) => r.map((v, j) => Math.log(1 + (v - El[i] * El[j]) / (El[i] * El[j]))));
  return { fbar: Ef, fsd: Ef.map((m, i) => Math.sqrt(Math.max(0, Ef2[i] - m * m))), mean: El.map((m, i) => Math.log(m) - S[i][i] / 2), cov: S };
}
function buildPriors(nAlong, nAcross) {
  const xs = []; for (let j = 0; j < nAcross; j++) xs.push((j - (nAcross - 1) / 2) * 209);
  const st = streakStats(xs); const s = TPL.sig;
  const Vm = s.district ** 2 + s.creek ** 2 + s.rich ** 2 + s.claim ** 2;
  const cp = coarsePriorSd();
  const blocks = [];
  const Bbar = TPL.bedrock.reduce((a, b) => a + b[1] * b[2], 0), sbbar = TPL.bedrock.reduce((a, b) => a + b[1] * b[3], 0);
  for (let i = 0; i < nAlong; i++) for (let j = 0; j < nAcross; j++) {
    const x = xs[j]; const fb = st.fbar[j]; const sf = 0.3 * st.fsd[j] / (0.7 + 0.3 * fb);
    const OB = TPL.obMed * (1 + 0.3 * Math.exp(-((x / 400) ** 2))); const Tg = TPL.payMed * (0.7 + 0.3 * fb); const D = OB + Tg, T = Tg + Bbar;
    blocks.push({ idx: blocks.length, i, j, x, along: i * 209, across: j * 209, acres: 1, fbar: fb, a: 0.5 + 0.5 * fb, muS: st.mean[j],
      D50: D, T50: T, tDc: (OB * OB * TPL.obSigClaim ** 2 + Tg * Tg * TPL.paySigClaim ** 2) / (D * D), tDb: (OB * OB * TPL.obSigBlock ** 2 + Tg * Tg * (TPL.paySigBlock ** 2 + sf * sf)) / (D * D),
      tTc: (Tg * Tg * TPL.paySigClaim ** 2 + EST.bSdUnknownFt ** 2) / (T * T), tTb: (Tg * Tg * (TPL.paySigBlock ** 2 + sf * sf)) / (T * T) });
  }
  const n = blocks.length; const ra = TPL.rangeAlong, rc = TPL.rangeAcross;
  const useHyp = !EST.momentMatchStreak;
  const E = blocks.map(a => blocks.map(b => s.block ** 2 * Math.exp(-Math.abs(a.along - b.along) / ra - Math.abs(a.across - b.across) / rc) + (useHyp ? 0 : st.cov[a.j][b.j] * Math.exp(-Math.abs(a.along - b.along) / EST.streakRangeAlong))));
  // discrete paystreak hypotheses: centre offset c (13 nodes, 0.5 sd apart) x half-width (3 nodes) x barren {0,1}
  for (let a = 0; a < n; a++) E[a][a] += EST.streakResidLogSd ** 2;
  const hyps = [];
  if (useHyp) { const hz = [[-1.2247, 1 / 6], [0, 2 / 3], [1.2247, 1 / 6]]; const nz = EST.streakNodes, dz = 6 / (nz - 1);
    const rho = Math.exp(-((nAlong - 1) * 209) / EST.streakRangeAlong); const zs = []; for (let a = 0; a < nz; a++) zs.push(-3 + a * dz);
    const pairs = []; let pw = 0;
    for (const z1 of zs) for (const z2 of zs) { const w = Math.exp(-(z1 * z1 - 2 * rho * z1 * z2 + z2 * z2) / (2 * (1 - rho * rho))); pairs.push([z1, z2, w]); pw += w; }
    for (const [z1, z2, wc] of pairs) for (const [zh, wh] of hz) { const hw = TPL.hwMed * Math.exp(TPL.sigHW * zh);
      const fv = blocks.map(b => { const t = nAlong > 1 ? b.i / (nAlong - 1) : 0.5; const c = ((1 - t) * z1 + t * z2) * TPL.wanderSd; return overlapF(b.x, c, hw); });
      const muS = fv.map(f => Math.log(f + (1 - f) * TPL.bgRatio));
      for (const barren of [0, 1]) hyps.push({ c: [z1 * TPL.wanderSd, z2 * TPL.wanderSd], hw, barren, muS, f: fv, prior: (wc / pw) * wh * (barren ? TPL.pBarren : 1 - TPL.pBarren) }); } }
  else { for (const barren of [0, 1]) hyps.push({ barren, muS: blocks.map(b => b.muS), f: blocks.map(b => b.fbar), prior: barren ? TPL.pBarren : 1 - TPL.pBarren }); }
  return { blocks, n, Vm, E, hyps, M: Math.log(TPL.gMed), barrenShift: Math.log(TPL.barrenMult), pBarren: TPL.pBarren, Bbar, sbbar,
    R0: Math.exp(cp.mean), alpha0: invTrigamma(cp.sd * cp.sd), coarseSd: cp.sd, tauClaimDev2: s.rich ** 2 + s.claim ** 2 };
}
const BED = Object.fromEntries(TPL.bedrock.map(b => [b[0], { B: b[2], sb: b[3] }]));
// ---------- geometry: claim mean + iid block closed form ----------
function geomField(pr, obsByBlock, which, muOverride) {
  const bl = pr.blocks;
  const mu = muOverride || bl.map(b => Math.log(which === 'D' ? b.D50 : b.T50));
  const tauC = which === 'D' ? bl.map(b => b.tDc) : bl.map(b => b.tTc); const tauB = which === 'D' ? bl.map(b => b.tDb) : bl.map(b => b.tTb);
  const tc2 = tauC.reduce((a, c) => a + c) / tauC.length; // claim-level variance (average)
  let P = 1 / tc2, num = 0; const yb = [], vb = [];
  bl.forEach((b, k) => { const o = obsByBlock[k]; if (o && o.length) { let p = 0, py = 0; for (const q of o) { p += 1 / q.v; py += q.y / q.v; } yb[k] = py / p; vb[k] = 1 / p; P += 1 / (tauB[k] + vb[k]); num += (yb[k] - mu[k]) / (tauB[k] + vb[k]); } });
  const dhat = num / P;
  const lam = bl.map((b, k) => yb[k] !== undefined ? tauB[k] / (tauB[k] + vb[k]) : 0);
  const mean = bl.map((b, k) => mu[k] + dhat + lam[k] * ((yb[k] ?? 0) - mu[k] - dhat));
  const cov = bl.map((a, i) => bl.map((b, j) => i === j ? (lam[i] * (vb[i] ?? 0) + (1 - lam[i]) ** 2 / P + (yb[i] === undefined ? tauB[i] : 0)) : (1 - lam[i]) * (1 - lam[j]) / P));
  return { mean, cov };
}
function geometry(pr, samples) {
  const bt = {}; for (const s of samples) if (s.obs && s.obs.bedrock) bt[s.block] = s.obs.bedrock; // last logged type per block
  const Bhat = pr.blocks.map((b, k) => bt[k] ? BED[bt[k]].B : pr.Bbar);
  const sbhat = pr.blocks.map((b, k) => bt[k] ? BED[bt[k]].sb : pr.sbbar);
  const oD = {}, oT = {};
  for (const s of samples) { if (!s.reachedBedrock || !s.obs.D) continue; const m = L.METHODS[s.method];
    (oD[s.block] = oD[s.block] || []).push({ y: Math.log(s.obs.D), v: Math.log(1 + m.geomCv ** 2) });
    const T = s.obs.Tg + Bhat[s.block]; (oT[s.block] = oT[s.block] || []).push({ y: Math.log(T), v: (s.obs.Tg / T) ** 2 * Math.log(1 + 0.01) + (Bhat[s.block] * EST.bLogSdKnown / T) ** 2 }); }
  const T0 = geomField(pr, oT, 'T');
  for (const s of samples) { if (s.reachedBedrock || !s.reachedPay || s.interval === 'exposure' || s.obs.OB === undefined) continue; const m = L.METHODS[s.method];
    const Tg = Math.max(0.5, Math.exp(T0.mean[s.block]) - Bhat[s.block]); const Dv = s.obs.OB + Tg;
    (oD[s.block] = oD[s.block] || []).push({ y: Math.log(Dv), v: ((s.obs.OB * m.geomCv) ** 2 + (Tg ** 2) * T0.cov[s.block][s.block] * (Math.exp(T0.mean[s.block]) / Tg) ** 2) / (Dv * Dv) }); }
  let D = geomField(pr, oD, 'D');
  // censoring pseudo-observations
  const oD2 = JSON.parse(JSON.stringify(oD)); let added = false;
  for (const s of samples) { if (s.reachedBedrock || s.reachedPay || s.method === 'pan' || s.interval === 'exposure') continue; const h = s.depthReached; if (Math.exp(D.mean[s.block]) < EST.censorTrigger * h) { (oD2[s.block] = oD2[s.block] || []).push({ y: Math.log(EST.censorPad * h), v: EST.censorLogSd ** 2 }); added = true; } }
  if (added) D = geomField(pr, oD2, 'D');
  const T = geomField(pr, oT, 'T');
  // hypothesis-specific pay-column means (grade and thickness both rise with paystreak fraction f)
  const Th = pr.hyps.map(h => geomField(pr, oT, 'T', pr.blocks.map((b, k) => Math.log(TPL.payMed * (0.7 + 0.3 * h.f[k]) + Bhat[k]))).mean);
  return { D, T, Th, Bhat, sbhat };
}
// ---------- coarse factor ----------
function coarse(pr, samples, Rtilde) {
  const kap = 1 + PCV[0] ** 2;
  let cm = 0, cc = 0; for (const s of samples) { if (!s.reachedPay || !L.METHODS[s.method].masses) continue; cm += s.massBy[0] / L.METHODS[s.method].cap[0]; cc += s.colors[0] / L.METHODS[s.method].cap[0]; }
  const muC = (EST.coarseMassPriorCount * TPL.coarseMg + cm) / (EST.coarseMassPriorCount + cc);
  let alpha = pr.alpha0, beta = Math.exp(digamma(pr.alpha0)) / pr.R0; const per = {};
  for (const s of samples) { const m = L.METHODS[s.method]; if (!s.reachedPay || s.interval === 'exposure' || !m.masses) continue;
    const nc = s.massBy[1] / m.cap[1] + s.massBy[2] / m.cap[2] + s.massBy[3] / m.cap[3]; const b = pr.blocks[s.block];
    const q = (per[s.block] = per[s.block] || { N: 0, E: 0 }); q.N += s.massBy[0] / (muC * kap); q.E += m.cap[0] * nc * (b.aPost ?? b.a) / (muC * kap); }
  for (const k in per) { const q = per[k]; const ph = 1 / (1 + Rtilde * q.E * EST.coarseBlockLogSd ** 2); alpha += ph * q.N; beta += ph * q.E; }
  return { mr: digamma(alpha) - Math.log(beta), vr: trigamma(alpha), alpha, beta, muC };
}
function wOf(b, mr, vr) { const R = (b.aPost ?? b.a) * Math.exp(mr); const p = R / (1 + R); return { Ew: Math.log(1 + R) + 0.5 * p * (1 - p) * vr, p }; }
// ---------- main estimate ----------
function estimate(pr, samples, opts = {}) {
  const n = pr.n; const bl = pr.blocks; bl.forEach(b => { delete b.aPost; });
  const geo = geometry(pr, samples);
  // position multipliers
  const pmOf = s => { const b = s.block; const Tc = Math.exp(geo.T.mean[b]); const Tg = Math.max(0.5, Tc - geo.Bhat[b]); const B = geo.Bhat[b], sb = geo.sbhat[b]; const m = L.METHODS[s.method];
    if (s.interval === 'fullColumn') return { pm: posMult(-Math.min(B, m.pen), Tg, Tg, B, sb, TPL.lambdaG), v: EST.posFullLogSd ** 2 };
    if (s.interval === 'upperPay') { const gh = [[-2.0202, 0.0200], [-0.9586, 0.3936], [0, 0.9453], [0.9586, 0.3936], [2.0202, 0.0200]]; let sw = 0, e1 = 0, e2 = 0;
      const sdT = Math.sqrt(geo.T.cov[b][b]); const pen = Math.max(0.1, s.depthReached - (s.obs.OB ?? (Math.exp(geo.D.mean[b]) - Tg)));   // gravel penetrated (observed)
      for (const [zz, ww] of gh) { const Tq = Math.max(0.5, Math.exp(geo.T.mean[b] + Math.SQRT2 * sdT * zz) - B); const h1 = Math.max(0.02 * Tq, Tq - pen); const lp = Math.log(posMult(Math.min(h1, 0.98 * Tq), Tq, Tq, B, sb, TPL.lambdaG)); sw += ww; e1 += ww * lp; e2 += ww * lp * lp; }
      e1 /= sw; e2 /= sw; return { pm: Math.exp(e1), v: Math.max(0, e2 - e1 * e1) + EST.posFullLogSd ** 2 + EST.posUpperExtra ** 2 }; }
    if (s.interval === 'exposure') return { pm: posMult(0.6 * Tg, Tg, Tg, B, sb, TPL.lambdaG), v: 0, shared: EST.expoLambdaLogSd ** 2 + EST.expoThickElast ** 2 * geo.T.cov[b][b] };
    return null; };
  let co = coarse(pr, samples, pr.R0);
  let post = null, Gt = bl.map(b => Math.exp(pr.M + b.muS - wOf(b, Math.log(pr.R0), 0).Ew));
  const ncShare = [null, 0.40 / 0.75, 0.27 / 0.75, 0.08 / 0.75];
  let res;
  for (let pass = 0; pass < EST.passes; pass++) {
    if (pass >= 1) co = coarse(pr, samples, Math.exp(co.mr));
    const W = bl.map(b => wOf(b, co.mr, co.vr));
    // composite obs per block (non-exposure), exposure obs separate
    const groups = {}; const expo = []; const pocketHit = {};
    for (const s of samples) { if (!s.reachedPay) continue; const m = L.METHODS[s.method];
      const ncg = (s.massBy[1] / m.cap[1] + s.massBy[2] / m.cap[2] + s.massBy[3] / m.cap[3]) / (s.V * K);   // non-coarse grade: a pocket lifts it, a lone nugget does not
      const p90 = Math.exp(pr.M + Math.max(...pr.hyps.map(h => h.muS[s.block])) + 1.2816 * Math.sqrt(pr.Vm + pr.E[s.block][s.block])) * 0.75;
      if (s.V < 0.5 * EST.pocketBcyMean && ncg >= EST.pocketHitNcGrade && ncg >= EST.pocketHitMult * p90) { pocketHit[s.block] = Math.max(pocketHit[s.block] || 0, ncg / 0.4); continue; }
      if (s.interval === 'exposure') expo.push(s); else (groups[s.block] = groups[s.block] || []).push(s); }
    const rows = []; // {h: Map idx->coef, y, v, group?}
    const mkNc = (list, b) => {
      let Mnc = 0, Veff = 0, P = 0, cvL = 0, cvM = 0, vpos = 0, shared = 0; const parts = [];
      for (const s of list) { const m = L.METHODS[s.method]; const pmv = pmOf(s); const mnc = s.massBy[1] / m.cap[1] + s.massBy[2] / m.cap[2] + s.massBy[3] / m.cap[3];
        const ve = s.V * pmv.pm; Mnc += mnc; Veff += ve; parts.push({ s, m, ve, pmv }); }
      const Vb = Math.exp(geo.T.mean[b]) * BCY * bl[b].acres;
      for (const q of parts) { const w = q.ve / Veff; const mu = ncShare[1] * PM[1] * (1 + PCV[1] ** 2) / q.m.cap[1] + ncShare[2] * PM[2] * (1 + PCV[2] ** 2) / q.m.cap[2] + ncShare[3] * PM[3] * (1 + PCV[3] ** 2) / q.m.cap[3];
        P += q.ve * mu; if (q.s.Vtrue < Vb) cvL += w * w * (Math.pow(Vb / q.s.V, ALPHA) - 1); cvM += w * w * ((1 + q.m.volumeCv ** 2) * (1 + q.m.weighCv ** 2) - 1); vpos += w * w * q.pmv.v; shared += w * (q.pmv.shared || 0); }
      const cvP = P / (Gt[b] * K * Veff * Veff); const muS = P / Veff; const Ne = Gt[b] * K * Veff / muS;
      const g = Math.max(Mnc, 0.5 * muS) / (Veff * K);
      let y, vP;
      if (EST.smallCount === 'irls') { const lG = Math.log(Gt[b]); const Nobs = Mnc / muS; const r = Math.min(Nobs / Ne, EST.irlsMaxRatio); y = lG + (r - 1); vP = 1 / Ne;
        if (Ne > EST.irlsSwitchN) { y = Math.log(g) + 0.5 * Math.log(1 + cvP); vP = Math.log(1 + cvP); } }
      else if (EST.smallCount) { const sc = smallCount(Ne); const lG = Math.log(Gt[b]); y = lG + (Math.log(g) - lG - sc.b) / sc.beta; vP = sc.v / (sc.beta * sc.beta); }
      else { y = Math.log(g) + 0.5 * Math.log(1 + cvP); vP = Math.log(1 + cvP); }
      y += 0.5 * Math.log((1 + cvL) * (1 + cvM)) + W[b].Ew;
      const v = vP + Math.log((1 + cvL) * (1 + cvM)) + vpos + EST.modelErrLogSd ** 2 + W[b].p ** 2 * EST.coarseBlockLogSd ** 2;
      return { y, v, shared, cvP, cvL, cvM, Ne, lgObs: Math.log(g), muS, Veff, Ew: W[b].Ew, vOther: Math.log((1 + cvL) * (1 + cvM)) + vpos + EST.modelErrLogSd ** 2 + W[b].p ** 2 * EST.coarseBlockLogSd ** 2, corr: 0.5 * Math.log((1 + cvL) * (1 + cvM)) };
    };
    for (const b in groups) { const o = mkNc(groups[b], +b); const h = {}; h[0] = 1; h[1 + (+b)] = 1; h[n + 1] = -W[+b].p; rows.push({ h, y: o.y, v: o.v, info: o, block: +b }); }
    const eb = {}; for (const s of expo) (eb[s.block] = eb[s.block] || []).push(s);
    for (const b in eb) { const o = mkNc(eb[b], +b); const h = {}; h[0] = 1; h[1 + (+b)] = 1; h[n + 1] = -W[+b].p; rows.push({ h, y: o.y, v: o.v, group: 'expo', gv: o.shared, block: +b, info: o }); }
    if (opts.records) { const h = {}; h[0] = 1; rows.push({ h, y: Math.log(opts.records.histGrade) - Math.log(EST.recordsRatio), v: EST.recordsLogSd ** 2 + pr.tauClaimDev2 }); }
    // GP over latent x = [m, e_0..e_{n-1}, r]
    const dim = n + 2; const S0 = Array.from({ length: dim }, () => Array(dim).fill(0)); S0[0][0] = pr.Vm; for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) S0[1 + a][1 + c] = pr.E[a][c]; S0[n + 1][n + 1] = co.vr;
    let hyps = pr.hyps.map((h, i) => ({ M: pr.M + (h.barren ? pr.barrenShift : 0), prior: h.prior, muS: h.muS, f: h.f, idx: i }));
    if (EST.prune && res && res.wts) { const keep = res.hypIdx.filter((hi, j) => res.wts[j] >= EST.prune); hyps = keep.map(i => ({ M: pr.M + (pr.hyps[i].barren ? pr.barrenShift : 0), prior: pr.hyps[i].prior, muS: pr.hyps[i].muS, f: pr.hyps[i].f, idx: i })); }
    const m0 = h => { const v = Array(dim).fill(0); v[0] = h.M; for (let a = 0; a < n; a++) v[1 + a] = h.muS[a]; return v; };
    const nr = rows.length;
    const solve = () => { let SH, Ch;
      if (nr) { SH = Array.from({ length: dim }, (_, i) => rows.map(r => { let s = 0; for (const k in r.h) s += S0[i][+k] * r.h[k]; return s; }));
        const Kmat = rows.map((r, a) => rows.map((q, c) => { let s = 0; for (const k in r.h) s += r.h[k] * SH[+k][c]; if (a === c) s += r.v; if (r.group && r.group === q.group) s += Math.sqrt(r.gv * q.gv); return s; }));
        Ch = chol(Kmat); }
      const out = hyps.map(hy => { const mu0 = m0(hy); if (!nr) return { mu: mu0, ll: 0 };
        const resid = rows.map(r => { let s = 0; for (const k in r.h) s += r.h[k] * mu0[+k]; return r.y - s; });
        const z = solveL(Ch, resid); const al = solveLT(Ch, z); const ll = -0.5 * z.reduce((a, c) => a + c * c, 0);
        return { mu: mu0.map((v, i) => v + SH[i].reduce((a, c, j) => a + c * al[j], 0)), ll }; });
      let Spost = S0; if (nr) { const Wt = SH.map(row => solveL(Ch, row)); Spost = S0.map((r, i) => r.map((v, j) => v - Wt[i].reduce((a, c, t) => a + c * Wt[j][t], 0))); }
      const lw = out.map((o, i) => Math.log(hyps[i].prior) + o.ll); const mx = Math.max(...lw); let wts = lw.map(v => Math.exp(v - mx)); const sw = wts.reduce((a, c) => a + c); wts = wts.map(v => v / sw);
      return { out, Spost, wts }; };
    let { out, Spost, wts } = solve();
    // low-count site refinement (1-D moment matching against the small-count table likelihood)
    for (let it = 0; it < (EST.epSweeps || 0); it++) { let changed = false;
      rows.forEach((r, i) => { const o = r.info; if (!o || o.Ne >= EST.epMaxNe) return;
        let mm = 0, m2 = 0; out.forEach((ou, h) => { let x = 0; for (const k in r.h) x += r.h[k] * ou.mu[+k]; mm += wts[h] * x; m2 += wts[h] * x * x; });
        let vv = m2 - mm * mm; for (const k in r.h) for (const k2 in r.h) vv += r.h[k] * r.h[k2] * Spost[+k][+k2];
        const pc = 1 / vv - 1 / r.v; if (pc <= 1e-6) return; const sc2 = 1 / pc; const muc = sc2 * (mm / vv - r.y / r.v);
        let w0 = 0, w1 = 0, w2 = 0; const sc = Math.sqrt(sc2);
        for (let q = 0; q < 24; q++) { const zq = -4 + 8 * q / 23; const x = muc + sc * zq; const lgnc = x - o.Ew; const Ne = Math.exp(lgnc) * K * o.Veff / o.muS; const t = smallCount(Ne);
          const mean = lgnc + t.b - o.corr; const v = t.v + o.vOther; const wq = Math.exp(-zq * zq / 2) * Math.exp(-0.5 * (o.lgObs - mean) ** 2 / v) / Math.sqrt(v); w0 += wq; w1 += wq * x; w2 += wq * x * x; }
        if (w0 <= 0) return; const mt = w1 / w0, vt = Math.max(1e-6, w2 / w0 - mt * mt);
        const pnew = 1 / vt - 1 / sc2; const vnew = pnew > 1e-4 ? 1 / pnew : 1e4; const ynew = vnew * (mt / vt - muc / sc2);
        r.v = vnew; r.y = ynew; changed = true; });
      if (!changed) break; ({ out, Spost, wts } = solve()); }
    // block log-grade moments
    const blk = out.map(o => bl.map((b, a) => o.mu[0] + o.mu[1 + a]));
    const cg = bl.map((_, a) => bl.map((_, c) => Spost[0][0] + Spost[0][1 + c] + Spost[1 + a][0] + Spost[1 + a][1 + c]));
    const mixMean = bl.map((_, a) => wts.reduce((acc, w, h) => acc + w * blk[h][a], 0));
    Gt = bl.map((b, a) => Math.exp(mixMean[a] - W[a].Ew));
    const fPost = bl.map((_, a) => wts.reduce((acc, w, h) => acc + w * hyps[h].f[a], 0)); bl.forEach((b, a) => { b.aPost = 0.5 + 0.5 * fPost[a]; });
    const pBarren = wts.reduce((acc, w, h) => acc + (pr.hyps[hyps[h].idx].barren ? w : 0), 0);
    // undetected-pocket hazard per block: P(no sample hit an existing pocket)
    const missP = bl.map((b, a) => { const Vb = Math.exp(geo.T.mean[a]) * BCY * b.acres; let pm = 1; for (const s of samples) if (s.block === a && s.reachedPay && s.interval !== 'exposure') pm *= Math.max(0, 1 - (EST.pocketBcyMean + s.V) / Vb); return pm; });
    res = { geo, co, W, rows, wts, blk, cg, Spost, out, fPost, pBarren, pocketHit, missP, hypIdx: hyps.map(h => h.idx) };
  }
  return res;
}
function fw(mus, C, sel) { let ES = 0, ES2 = 0; for (let a = 0; a < mus.length; a++) { if (!sel[a]) continue; ES += Math.exp(mus[a] + C[a][a] / 2); for (let b = 0; b < mus.length; b++) { if (!sel[b]) continue; ES2 += Math.exp(mus[a] + mus[b] + 0.5 * (C[a][a] + C[b][b]) + C[a][b]); } } const s2 = Math.log(ES2 / (ES * ES)); return { mu: Math.log(ES) - s2 / 2, s2, ES }; }
function mixQuant(comps, q) { // comps: [{w, mu, s}]
  const cdf = x => comps.reduce((a, c) => a + c.w * Phi((x - c.mu) / Math.sqrt(c.s2)), 0);
  let lo = Math.min(...comps.map(c => c.mu - 7 * Math.sqrt(c.s2))), hi = Math.max(...comps.map(c => c.mu + 7 * Math.sqrt(c.s2)));
  for (let t = 0; t < 80; t++) { const mid = (lo + hi) / 2; if (cdf(mid) < q) lo = mid; else hi = mid; } return Math.exp((lo + hi) / 2); }
function aggregate(pr, res, sel) {
  const bl = pr.blocks; sel = sel || bl.map(() => true);
  const comps = res.out.map((o, h) => { const mus = bl.map((b, a) => res.blk[h][a] + (res.geo.Th ? res.geo.Th[res.hypIdx ? res.hypIdx[h] : h][a] : res.geo.T.mean[a]) + Math.log(BCY * b.acres)); const C = bl.map((_, a) => bl.map((_, c) => res.cg[a][c] + res.geo.T.cov[a][c])); const r = fw(mus, C, sel);
    // pockets: undetected (compound Poisson) + confirmed hits; added as an independent component
    let pm1 = 0, pm2 = 0; const hy = pr.hyps[res.hypIdx ? res.hypIdx[h] : h];
    for (let a = 0; a < bl.length; a++) { if (!sel[a]) continue; const gp = Math.max(EST.pocketGradeMin, EST.pocketGradeMult * Math.exp(res.blk[h][a]));
      if (res.pocketHit && res.pocketHit[a]) { const o1 = res.pocketHit[a] * EST.pocketBcyMean; pm1 += o1; pm2 += o1 * o1 * (EST.pocketBcy2 / EST.pocketBcyMean ** 2 - 1); continue; }
      const lam = (hy.f[a] >= 0.4 ? EST.pocketP : 0) * (res.missP ? res.missP[a] : 1); pm1 += lam * EST.pocketBcyMean * gp; pm2 += lam * EST.pocketBcy2 * gp * gp * (1 + EST.pocketGradeCv2); }
    const ES = r.ES + pm1; const V = (Math.exp(r.s2) - 1) * r.ES * r.ES + pm2; const s2 = Math.log(1 + V / (ES * ES));
    return { w: res.wts[h], mu: Math.log(ES) - s2 / 2, s2, ES }; }).filter(c => c.w > 1e-9);
  const P10 = mixQuant(comps, 0.1), P50 = mixQuant(comps, 0.5), P90 = mixQuant(comps, 0.9);
  const mean = comps.reduce((a, c) => a + c.w * c.ES, 0);
  const base = res.out.map((o, h) => { const mus = bl.map((b, a) => res.blk[h][a] + (res.geo.Th ? res.geo.Th[res.hypIdx ? res.hypIdx[h] : h][a] : res.geo.T.mean[a]) + Math.log(BCY * b.acres)); const C = bl.map((_, a) => bl.map((_, c) => res.cg[a][c] + res.geo.T.cov[a][c])); const r = fw(mus, C, sel); return { w: res.wts[h], mu: r.mu, s2: r.s2, ES: r.ES }; }).filter(c => c.w > 1e-9);
  const bP10 = mixQuant(base, 0.1), bP50 = mixQuant(base, 0.5), bP90 = mixQuant(base, 0.9);
  return { P10, P50, P90, spread: P90 / P10, mean, pBarren: res.pBarren, bP10, bP50, bP90, baseSpread: bP90 / bP10, pocketMean: mean - base.reduce((a, c) => a + c.w * c.ES, 0) };
}
function blockQuant(pr, res, a) { const comps = res.out.map((o, h) => ({ w: res.wts[h], mu: res.blk[h][a], s2: res.cg[a][a] })).filter(c => c.w > 1e-9); return [0.1, 0.5, 0.9].map(q => mixQuant(comps, q)); }
function truthOz(cl) { return cl.blocks.reduce((s, b) => s + b.g * (b.Tg + b.B) * BCY, 0); }
module.exports = { EST, buildPriors, estimate, aggregate, blockQuant, truthOz, wOf, coarse, geometry, coarsePriorSd, fw, mixQuant };
