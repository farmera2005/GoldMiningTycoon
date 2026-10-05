// The header grain tile (DESIGN §13.20, D-13.60): a 128 × 128 px noise tile from an SVG feTurbulence filter (base
// frequency 0.8, two octaves), embedded as a data URI so the build ships no image file. The speckle is one flat ink
// color (desaturated) and its per-pixel alpha is the noise scaled by `maxAlpha`, so no pixel is more opaque than the
// `ui.theme.grainOpacity*` bound that T20 checks text against. tokens.css carries the generated URIs; grain.test.ts
// regenerates them from here and fails if the two drift.
import { parseHex } from './color';

export const GRAIN_TILE_PX = 128;
export const GRAIN_BASE_FREQUENCY = 0.8;
export const GRAIN_OCTAVES = 2;

export interface GrainSpec {
  /** Speckle color: the ink of the band it sits on (ink-1 on content bands, chrome-ink on chrome). */
  readonly colorHex: string;
  /** Upper bound on per-pixel alpha. */
  readonly maxAlpha: number;
}

function channel01(value255: number): string {
  // Four decimals are finer than 8-bit color, so the tile's speckle equals the token color.
  return String(Math.round((value255 / 255) * 10000) / 10000);
}

export function grainSvg({ colorHex, maxAlpha }: GrainSpec): string {
  const [r, g, b] = parseHex(colorHex);
  // Color matrix rows: R, G and B are constants (the ink), alpha = maxAlpha × the noise's red channel ∈ [0, 1].
  // `color-interpolation-filters='sRGB'` keeps those constants in sRGB rather than the filter default linearRGB.
  const matrix = [
    `0 0 0 0 ${channel01(r)}`,
    `0 0 0 0 ${channel01(g)}`,
    `0 0 0 0 ${channel01(b)}`,
    `${maxAlpha} 0 0 0 0`,
  ].join(' ');
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${GRAIN_TILE_PX}' height='${GRAIN_TILE_PX}'>` +
    `<filter id='g' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${GRAIN_BASE_FREQUENCY}' numOctaves='${GRAIN_OCTAVES}' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='${matrix}'/>` +
    `</filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`
  );
}

/** The CSS `url(...)` value for a tile: only the characters that break a quoted CSS URL or a data URI are escaped. */
export function grainCssUrl(spec: GrainSpec): string {
  const encoded = grainSvg(spec).replace(/[%<>"#{} ]/g, (ch) => encodeURIComponent(ch));
  return `url("data:image/svg+xml,${encoded}")`;
}
