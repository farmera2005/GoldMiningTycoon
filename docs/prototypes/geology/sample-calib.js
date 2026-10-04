'use strict';
// drawSample worked-example numbers for §3 (scratch).
const MG = 31103.5;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const u = mulberry32(12345); let spare = null;
const n = () => { if (spare !== null) { const s = spare; spare = null; return s; } let a, b, r; do { a = 2 * u() - 1; b = 2 * u() - 1; r = a * a + b * b; } while (r >= 1 || r === 0); const m = Math.sqrt(-2 * Math.log(r) / r); spare = b * m; return a * m; };
const pois = l => { if (l < 30) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= u(); } while (p > L); return k - 1; } return Math.max(0, Math.round(l + Math.sqrt(l) * n())); };
const lnMean = (mean, cv) => { const s2 = Math.log(1 + cv * cv); return mean * Math.exp(Math.sqrt(s2) * n() - s2 / 2); };
const M = [150, 3, 0.1, 0.004], C = [2.0, 1.0, 0.7, 0.5];
const MIX = { proximal: [.45, .35, .15, .05], mid: [.25, .40, .27, .08], fan: [.10, .30, .40, .20] };
const ALPHA = 0.028, VBLOCK = 8000;
const sigL2 = V => V >= VBLOCK ? 0 : ALPHA * Math.log(VBLOCK / V);
function cvParticle(g, V, mix, mC = 150) { const m = M.slice(); m[0] = mC; let meff = 0; for (let k = 0; k < 4; k++) meff += mix[k] * m[k] * (1 + C[k] * C[k]); return Math.sqrt(meff / (g * V * MG)); }
function draw(g, V, mix, cap, useLocal, mC = 150) {
  const m = M.slice(); m[0] = mC;
  let gl = g; if (useLocal) { const s2 = sigL2(V); gl = g * Math.exp(Math.sqrt(s2) * n() - s2 / 2); }
  let mass = 0, counts = [];
  for (let k = 0; k < 4; k++) { const lam = gl * V * mix[k] * MG / m[k]; const N = pois(lam); counts.push(N); let Mk = 0; if (N <= 40) { for (let i = 0; i < N; i++) Mk += lnMean(m[k], C[k]); } else { Mk = Math.max(0, N * m[k] + Math.sqrt(N) * m[k] * C[k] * n()); } mass += Mk * cap[k]; }
  return { grade: mass / MG / V, counts };
}
function stats(arr) { const s = arr.slice().sort((a, b) => a - b); const q = p => s[Math.floor(p * (s.length - 1))]; const mean = s.reduce((a, b) => a + b) / s.length; const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length); return { mean, p10: q(.1), p50: q(.5), p90: q(.9), p99: q(.99), cv: sd / mean }; }
const g = 0.01;
const capPan = [0.98, 0.95, 0.85, 0.50], capPit = [0.97, 0.93, 0.80, 0.45];
console.log('closed-form particle CV at g=0.01 (coarse 150 mg):');
for (const V of [1 / 150, 0.036, 0.5, 3, 10, 30, 100, 300, 1000]) {
  const row = Object.entries(MIX).map(([k, mix]) => `${k} ${cvParticle(g, V, mix).toFixed(2)}`).join('  ');
  const sl = Math.sqrt(sigL2(V));
  const tot = Object.entries(MIX).map(([k, mix]) => { const c = cvParticle(g, V, mix); return `${k} ${Math.sqrt(Math.exp(Math.log(1 + c * c) + sigL2(V)) - 1).toFixed(2)}`; }).join('  ');
  console.log(`V=${V.toFixed(4)}  particle: ${row} | sigmaL=${sl.toFixed(2)} | total CV: ${tot}`);
}
for (const [name, mix] of [['proximal', MIX.proximal], ['mid', MIX.mid]]) {
  for (const [lbl, V, cap] of [['pan', 1 / 150, capPan], ['sonic5ft', 0.036, capPit], ['pit3', 3, capPit], ['pit10', 10, capPit], ['bulk300', 300, capPit]]) {
    const res = []; let zeroC = 0; const N = 20000;
    for (let i = 0; i < N; i++) { const d = draw(g, V, mix, cap, true); res.push(d.grade / g); if (d.counts[0] === 0) zeroC++; }
    const s = stats(res);
    console.log(`${name} ${lbl}: mean ${s.mean.toFixed(2)} p10 ${s.p10.toFixed(3)} p50 ${s.p50.toFixed(3)} p90 ${s.p90.toFixed(2)} p99 ${s.p99.toFixed(1)} cv ${s.cv.toFixed(2)} P(no coarse) ${(zeroC / N * 100).toFixed(1)}%`);
  }
}
// average of 10 pits (each 10 bcy) in the same block
{ const r = []; for (let t = 0; t < 5000; t++) { let s = 0; for (let i = 0; i < 10; i++) s += draw(g, 10, MIX.proximal, capPit, true).grade; r.push(s / 10 / g); } const s = stats(r); console.log(`proximal mean of 10 x 10-bcy pits: mean ${s.mean.toFixed(2)} p10 ${s.p10.toFixed(2)} p50 ${s.p50.toFixed(2)} p90 ${s.p90.toFixed(2)} cv ${s.cv.toFixed(2)}`); }
{ const r = []; for (let t = 0; t < 5000; t++) { let s = 0; for (let i = 0; i < 40; i++) s += draw(g, 1 / 150, MIX.proximal, capPan, true).grade; r.push(s / 40 / g); } const s = stats(r); console.log(`proximal mean of 40 pans: mean ${s.mean.toFixed(2)} p10 ${s.p10.toFixed(3)} p50 ${s.p50.toFixed(3)} p90 ${s.p90.toFixed(2)} cv ${s.cv.toFixed(2)}`); }
// expected visible counts in one pan
{ const V = 1 / 150; console.log('pan lambdas proximal:', MIX.proximal.map((w, k) => (g * V * w * MG / M[k]).toFixed(3)).join(' ')); }
{ const V = 10; console.log('pit10 lambdas proximal:', MIX.proximal.map((w, k) => (g * V * w * MG / M[k]).toFixed(1)).join(' ')); }
// vertical profile examples
function G(h, T, B, sb, lg = 2.0, lb = 0.6) { if (h >= 0) return sb + (1 - sb) * (1 - Math.exp(-Math.min(h, T) / lg)) / (1 - Math.exp(-T / lg)); const d = Math.min(B, -h); return sb - sb * (1 - Math.exp(-d / lb)) / (1 - Math.exp(-B / lb)); }
function posMult(h1, h2, T, B, sb) { return (G(h2, T, B, sb) - G(h1, T, B, sb)) / ((h2 - h1) / (T + B)); }
console.log('posMult pit stops 2 ft above bedrock (T=6,B=1.5,sb=0.2):', posMult(2, 6, 6, 1.5, 0.2).toFixed(3));
console.log('posMult full column + 1ft bedrock:', posMult(-1, 6, 6, 1.5, 0.2).toFixed(3));
console.log('posMult bedrock scrape (bottom 1 ft gravel + top 1 ft bedrock):', posMult(-1, 1, 6, 1.5, 0.2).toFixed(3));
console.log('posMult top 3 ft only (pit stopped by water at 3 ft above bedrock):', posMult(3, 6, 6, 1.5, 0.2).toFixed(3));
console.log('posMult full column no bedrock:', posMult(0, 6, 6, 1.5, 0.2).toFixed(3));
