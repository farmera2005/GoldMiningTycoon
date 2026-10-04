'use strict';
// Revised §4 estimator prototype, checked against a simplified but faithful copy of §3's generator and drawSample.
// Scratch only. Math.* is fine here; the engine uses dmath.
const K = 31103.5;
const BCY = 1613;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
class Rng { constructor(s) { this.u = mulberry32(s); this.sp = null; }
  unif() { return this.u(); }
  norm() { if (this.sp !== null) { const s = this.sp; this.sp = null; return s; } let a, b, r; do { a = 2 * this.u() - 1; b = 2 * this.u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const m = Math.sqrt(-2 * Math.log(r) / r); this.sp = b * m; return a * m; }
  pois(l) { if (l < 30) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= this.u(); } while (p > L); return k - 1; } return Math.max(0, Math.round(l + Math.sqrt(l) * this.norm())); }
  lnMean(cv) { const s2 = Math.log(1 + cv * cv); return Math.exp(Math.sqrt(s2) * this.norm() - s2 / 2); }
}
// ---------- §3 north template (creek, mid-reach) ----------
const TPL = {
  gMed: 0.0095, sig: { district: 0.25, creek: 0.38, rich: 0.28, claim: 0.20, block: 0.50 },
  rangeAlong: 700, rangeAcross: 120, hwMed: 110, sigHW: 0.40, wanderSd: 140, bgRatio: 0.10,
  obMed: 15, obSigClaim: Math.sqrt(0.15 ** 2 + 0.25 ** 2 + 0.25 ** 2 + 0.15 ** 2), obSigBlock: 0.15,
  payMed: 5, paySigClaim: Math.sqrt(0.15 ** 2 + 0.15 ** 2), paySigBlock: 0.15,
  bedrock: [['schist', 0.65, 1.5, 0.20], ['slate', 0.15, 2.5, 0.30], ['granite', 0.15, 1.0, 0.10], ['basalt', 0.05, 0.7, 0.08]],
  mix: [0.25, 0.40, 0.27, 0.08], coarseMg: 150, lambdaG: 2.0, pocketP: 0.015, pBarren: 0.20, barrenMult: 0.15, frozenP: 0.75,
};
const PM = [null, 3, 0.1, 0.004], PCV = [2.0, 1.0, 0.7, 0.5];
const ALPHA = 0.028, LB = 0.6;
function Gcum(h, T, B, sb, lg) { if (h >= 0) return sb + (1 - sb) * (1 - Math.exp(-Math.min(h, T) / lg)) / (1 - Math.exp(-T / lg)); const d = Math.min(B, -h); return sb - sb * (1 - Math.exp(-d / LB)) / (1 - Math.exp(-B / LB)); }
function posMult(h1, h2, T, B, sb, lg) { return (Gcum(h2, T, B, sb, lg) - Gcum(h1, T, B, sb, lg)) / ((h2 - h1) / (T + B)); }
function ar1(r, n, range, sd) { const rho = Math.exp(-209 / range); const z = [r.norm()]; for (let i = 1; i < n; i++) z.push(rho * z[i - 1] + Math.sqrt(1 - rho * rho) * r.norm()); return z.map(v => v * sd); }
function overlapF(x, c, hw) { const d = x - c; return Math.max(0, Math.min(d + 104.5, hw) - Math.max(d - 104.5, -hw)) / 209; }
function genClaim(seed, nAlong = 5, nAcross = 4, opts = {}) {
  const r = new Rng(seed);
  const s = TPL.sig; const Vm = s.district ** 2 + s.creek ** 2 + s.rich ** 2 + s.claim ** 2;
  const creekLog = opts.creekLog ?? Math.sqrt(s.district ** 2 + s.creek ** 2) * r.norm(); const claimLog = creekLog + (opts.claimDev ?? Math.sqrt(s.rich ** 2 + s.claim ** 2) * r.norm());
  const barren = opts.barren ?? (r.unif() < TPL.pBarren);
  const cRow = ar1(r, nAlong, 2000, TPL.wanderSd); const hwRow = ar1(r, nAlong, 1500, TPL.sigHW).map(v => TPL.hwMed * Math.exp(v));
  const ra = Math.exp(-209 / TPL.rangeAlong), rc = Math.exp(-209 / TPL.rangeAcross);
  const z = [];
  for (let i = 0; i < nAlong; i++) { const u = [r.norm()]; for (let j = 1; j < nAcross; j++) u.push(rc * u[j - 1] + Math.sqrt(1 - rc * rc) * r.norm()); z.push(u.map((v, j) => i === 0 ? v : ra * z[i - 1][j] + Math.sqrt(1 - ra * ra) * v)); }
  const claimOb = Math.exp(TPL.obSigClaim * r.norm()), claimPay = Math.exp(TPL.paySigClaim * r.norm());
  let ub = r.unif(), bt = TPL.bedrock[0]; for (const b of TPL.bedrock) { if (ub < b[1]) { bt = b; break; } ub -= b[1]; }
  const lg = TPL.lambdaG * (0.75 + 0.5 * r.unif());
  let mixK = TPL.mix.map(m => m * Math.exp(0.25 * r.norm())); const sm = mixK.reduce((a, b) => a + b); mixK = mixK.map(m => m / sm);
  const coarseMg = TPL.coarseMg * Math.exp(0.3 * r.norm());
  const frozen = r.unif() < TPL.frozenP ? 0.6 + 0.4 * r.unif() : 0;
  const blocks = [];
  for (let i = 0; i < nAlong; i++) for (let j = 0; j < nAcross; j++) {
    const x = (j - (nAcross - 1) / 2) * 209;
    const f = overlapF(x, cRow[i], hwRow[i]);
    const gs = TPL.gMed * Math.exp(claimLog) * (barren ? TPL.barrenMult : 1) * Math.exp(s.block * z[i][j]);
    let g = f * gs + (1 - f) * gs * TPL.bgRatio;
    const OB = Math.min(120, Math.max(0, TPL.obMed * claimOb * (1 + 0.3 * Math.exp(-((x / 400) ** 2))) * Math.exp(TPL.obSigBlock * r.norm())));
    const Tg = Math.min(15, Math.max(1, TPL.payMed * claimPay * (0.7 + 0.3 * f) * Math.exp(TPL.paySigBlock * r.norm())));
    const B = bt[2] * (0.8 + 0.4 * r.unif()); const sb = bt[3] * (0.8 + 0.4 * r.unif());
    const payBcy = (Tg + B) * BCY;
    let pocket = null;
    if (f >= 0.4 && r.unif() < TPL.pocketP) { pocket = { bcy: Math.min(300 + 2700 * r.unif(), 0.5 * payBcy), grade: Math.min(2.0, Math.max(0.15, gs * 15 * Math.exp(0.5 * r.norm()))) }; g = (g * (payBcy - pocket.bcy) + pocket.grade * pocket.bcy) / payBcy; }
    let mix = mixK.slice(); mix[0] *= (0.5 + 0.5 * f); mix = mix.map(m => m * Math.exp(0.10 * r.norm())); const s2 = mix.reduce((a, b) => a + b); mix = mix.map(m => m / s2);
    const perm = frozen > 0 ? Math.min(1, Math.max(0, frozen + 0.08 * r.norm())) : 0.15 * r.unif();
    blocks.push({ idx: blocks.length, i, j, x, along: i * 209, across: j * 209, f, g, OB, Tg, B, sb, lg, bedrock: bt[0], mix, coarseMg, perm, pocket, channel: j === Math.floor(nAcross / 2) });
  }
  return { blocks, claimLog, barren, nAlong, nAcross, histGrade: 2.5 * TPL.gMed * Math.exp(creekLog) * (barren ? TPL.barrenMult : 1) * Math.exp(0.5 * r.norm()) };
}
// ---------- methods in §3 SampleMethodParams shape ----------
const METHODS = {
  pan: { mode: 'exposure', maxDepth: null, frozenOk: false, pen: 0, cap: [0.97, 0.92, 0.80, 0.45], volumeCv: 0.25, weighCv: 0.20, geomCv: 0.15, masses: false },
  handPit: { mode: 'pit', maxDepth: 5, frozenOk: false, pen: 0.5, cap: [0.95, 0.88, 0.62, 0.25], volumeCv: 0.15, weighCv: 0.12, geomCv: 0.10, masses: true },
  excavatorPit: { mode: 'pit', maxDepth: 22, frozenOk: true, pen: 1.0, cap: [0.95, 0.90, 0.75, 0.40], volumeCv: 0.15, weighCv: 0.08, geomCv: 0.04, masses: true },
  trench: { mode: 'pit', maxDepth: 22, frozenOk: true, pen: 1.0, cap: [0.95, 0.90, 0.75, 0.40], volumeCv: 0.10, weighCv: 0.08, geomCv: 0.04, masses: true },
  bulk: { mode: 'fullColumn', maxDepth: null, frozenOk: true, pen: 1.5, cap: [0.95, 0.88, 0.65, 0.30], volumeCv: 0.08, weighCv: 0.05, geomCv: 0.03, masses: true },
  sonic: { mode: 'fullColumn', maxDepth: 300, frozenOk: true, pen: 3, cap: [0.97, 0.95, 0.90, 0.70], volumeCv: 0.05, weighCv: 0.10, geomCv: 0.03, masses: false, perFt: 0.0073 },
  rc: { mode: 'fullColumn', maxDepth: 300, frozenOk: true, pen: 3, cap: [0.95, 0.85, 0.55, 0.25], volumeCv: 0.20, weighCv: 0.20, geomCv: 0.05, masses: false, perFt: 0.0050 },
};
function drawSample(b, V, mName, r, o = {}) {
  const m = METHODS[mName]; const T = b.Tg, B = b.B, dtb = b.OB + T;
  let h1, h2, reachedPay = true, stop = 'none', bottom = null;
  const maxD = o.maxDepth ?? m.maxDepth;
  if (m.mode === 'exposure') { if (b.OB <= 0.5) { h1 = -Math.min(B, m.pen); h2 = T; } else if (b.channel) { h2 = T; h1 = T * 0.6; } else reachedPay = false; }
  else {
    const frozenLimit = (b.perm >= 0.5 && !m.frozenOk) ? 2.0 : Infinity;
    bottom = Math.min(maxD ?? Infinity, frozenLimit, dtb + m.pen);
    if (m.mode === 'pit' && b.perm < 0.5 && dtb > 6 && r.unif() < 0.25) bottom = Math.min(bottom, dtb - (1 + 3 * r.unif()));
    h1 = dtb - bottom; h2 = T;
    if (m.mode === 'fullColumn' && maxD == null) h1 = -Math.min(B, m.pen);
    if (h1 >= T) reachedPay = false;
  }
  if (V === 'drill') V = m.perFt * (T + Math.min(B, m.pen));
  let gLoc, mix = b.mix, reachedBedrock = false;
  if (!reachedPay) { gLoc = 0.03 * b.g; }
  else {
    h1 = Math.max(h1, -B); reachedBedrock = h1 <= 0;
    const pm = posMult(h1, h2, T, B, b.sb, b.lg);
    const Vb = (T + B) * BCY;
    const gMat = b.pocket ? (b.g * Vb - b.pocket.bcy * b.pocket.grade) / (Vb - b.pocket.bcy) : b.g;
    const sL2 = V < Vb ? ALPHA * Math.log(Vb / V) : 0;
    gLoc = gMat * pm * Math.exp(Math.sqrt(sL2) * r.norm() - sL2 / 2);
    if (b.pocket && r.unif() < Math.min(1, (b.pocket.bcy + V) / Vb)) { const phi = Math.min(1, b.pocket.bcy / V); gLoc = (1 - phi) * gLoc + phi * b.pocket.grade * pm; const pmx = [0.60, 0.30, 0.08, 0.02]; mix = mix.map((x, k) => (1 - phi) * x + phi * pmx[k]); }
  }
  const mm = [b.coarseMg, 3, 0.1, 0.004]; const N = [], W = [];
  for (let k = 0; k < 4; k++) {
    const lam = gLoc * V * mix[k] * K / mm[k]; const n = r.pois(lam); let M = 0;
    if (n <= 40) for (let t = 0; t < n; t++) M += mm[k] * r.lnMean(PCV[k]); else M = Math.max(0, n * mm[k] + Math.sqrt(n) * mm[k] * PCV[k] * r.norm());
    N.push(n); W.push(M * m.cap[k]);
  }
  const Vmeas = V * r.lnMean(m.volumeCv); const wf = r.lnMean(m.weighCv);
  const colors = N.map((n, k) => Math.round(n * m.cap[k]));
  const recMg = W.reduce((a, c) => a + c) * wf;
  let massBy = m.masses ? W.slice() : null;
  if (!massBy) { const den = colors.reduce((a, c, k) => a + c * mm[k], 0) || 1; massBy = colors.map((c, k) => recMg * c * (k === 0 ? TPL.coarseMg : mm[k]) / den); }
  const obs = {};
  if (reachedPay && m.mode !== 'exposure') obs.OB = b.OB * r.lnMean(m.geomCv);
  if (reachedBedrock) { obs.D = dtb * r.lnMean(m.geomCv); obs.Tg = T * r.lnMean(0.10); obs.bedrock = r.unif() < 0.9 ? b.bedrock : TPL.bedrock[Math.floor(r.unif() * 4)][0]; }
  return { block: b.idx, method: mName, V: Vmeas, Vtrue: V, reachedPay, reachedBedrock, depthReached: bottom ?? dtb, massBy, colors, obs, interval: !reachedPay ? 'overburdenOnly' : (m.mode === 'exposure' ? 'exposure' : (reachedBedrock ? 'fullColumn' : 'upperPay')) };
}
// ---------- math ----------
function digamma(x) { let r = 0; while (x < 6) { r -= 1 / x; x += 1; } const f = 1 / (x * x); return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f / 252)); }
function trigamma(x) { let r = 0; while (x < 6) { r += 1 / (x * x); x += 1; } const f = 1 / (x * x); return r + 1 / x + f / 2 + (1 / (6 * x * x * x)) * (1 - f * (1 / 5 - f / 7)); }
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
function chol(A) { const n = A.length; const L = A.map(r => r.map(() => 0)); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-12)); else L[i][j] = s / L[j][j]; } return L; }
function solveL(L, b) { const n = L.length, x = b.slice(); for (let i = 0; i < n; i++) { for (let k = 0; k < i; k++) x[i] -= L[i][k] * x[k]; x[i] /= L[i][i]; } return x; }
function solveLT(L, b) { const n = L.length, x = b.slice(); for (let i = n - 1; i >= 0; i--) { for (let k = i + 1; k < n; k++) x[i] -= L[k][i] * x[k]; x[i] /= L[i][i]; } return x; }
function invTrigamma(v) { let lo = 0.05, hi = 1e4; for (let t = 0; t < 80; t++) { const mid = Math.sqrt(lo * hi); if (trigamma(mid) > v) lo = mid; else hi = mid; } return Math.sqrt(lo * hi); }
module.exports = { K, BCY, Rng, TPL, PM, PCV, ALPHA, LB, Gcum, posMult, genClaim, METHODS, drawSample, digamma, trigamma, Phi, phi, chol, solveL, solveLT, invTrigamma, overlapF };
