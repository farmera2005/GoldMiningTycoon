// Color math behind the token checks (DESIGN §13.20, test T20): WCAG 2.2 relative luminance and contrast, OKLab and
// OKLCH, and color-vision-deficiency simulation by Machado, Oliveira & Fernandes (2009) at severity 1.0. The ΔE
// thresholds in 13.20 are calibrated to exactly this model, so swapping the simulation would move borderline pairs.

/** sRGB channels, 0–255. */
export type Rgb = readonly [number, number, number];
export type CvdKind = 'protan' | 'deutan';

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #rrggbb color: ${hex}`);
  return [parseInt(m[1] ?? '', 16), parseInt(m[2] ?? '', 16), parseInt(m[3] ?? '', 16)];
}

function toLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearRgb(rgb: Rgb): [number, number, number] {
  return [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])];
}

export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = linearRgb(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The pixel a browser paints when `top` at `alpha` is composited over an opaque `base`: blended in sRGB and stored
 * as 8-bit channels. 13.20's grain figures (5.0, 9.1, 5.7, 14.3) are contrasts against this rounded pixel.
 */
export function compositeOver(base: Rgb, top: Rgb, alpha: number): Rgb {
  const mix = (b: number, t: number): number => Math.round(b * (1 - alpha) + t * alpha);
  return [mix(base[0], top[0]), mix(base[1], top[1]), mix(base[2], top[2])];
}

type Vec3 = readonly [number, number, number];

function oklabFromLinear([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklab(rgb: Rgb): Vec3 {
  return oklabFromLinear(linearRgb(rgb));
}

export interface Oklch {
  readonly l: number;
  readonly c: number;
  /** Hue in degrees, [0, 360). */
  readonly h: number;
}

export function oklch(rgb: Rgb): Oklch {
  const [l, a, b] = oklab(rgb);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l, c: Math.hypot(a, b), h };
}

const MACHADO_2009: Readonly<Record<CvdKind, readonly Vec3[]>> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

function simulateLinear(rgb: Rgb, kind: CvdKind): Vec3 {
  const lin = linearRgb(rgb);
  const clamp = (x: number): number => Math.min(1, Math.max(0, x));
  const row = (i: number): number => {
    const m = MACHADO_2009[kind][i] ?? [0, 0, 0];
    return clamp(m[0] * lin[0] + m[1] * lin[1] + m[2] * lin[2]);
  };
  return [row(0), row(1), row(2)];
}

/** Euclidean OKLab distance × 100, under normal vision or a simulated deficiency. */
export function deltaE(a: Rgb, b: Rgb, kind?: CvdKind): number {
  const pa = oklabFromLinear(kind ? simulateLinear(a, kind) : linearRgb(a));
  const pb = oklabFromLinear(kind ? simulateLinear(b, kind) : linearRgb(b));
  return 100 * Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

/** The worse of protanopia and deuteranopia, which is what 13.20's CVD gate reports. */
export function cvdDeltaE(a: Rgb, b: Rgb): number {
  return Math.min(deltaE(a, b, 'protan'), deltaE(a, b, 'deutan'));
}
