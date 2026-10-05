// The grain tile and its switch-offs (DESIGN §13.20, D-13.60; the CSS half of T28's grain rules).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { uiConfig } from '../../data/tuning/ui';
import { parseHex } from './color';
import { findBlock, parseCss } from './cssParse';
import { GRAIN_BASE_FREQUENCY, GRAIN_OCTAVES, GRAIN_TILE_PX, grainCssUrl, grainSvg } from './grain';

const themeDir = resolve(process.cwd(), 'src/ui/theme');
const tokens = parseCss(readFileSync(resolve(themeDir, 'tokens.css'), 'utf8'));
const baseCss = readFileSync(resolve(themeDir, 'base.css'), 'utf8');
const base = parseCss(baseCss);
const daylight = findBlock(tokens, ':root').decls;
const lamplight = findBlock(tokens, ":root[data-theme='lamplight']").decls;

function matrixRows(svg: string): number[][] {
  const m = /<feColorMatrix type='matrix' values='([^']+)'/.exec(svg);
  const values = (m?.[1] ?? '').split(' ').map(Number);
  return [0, 1, 2, 3].map((r) => values.slice(r * 5, r * 5 + 5));
}

describe('grain tile', () => {
  it('is a 128 px feTurbulence tile at base frequency 0.8 with two octaves, in sRGB', () => {
    const svg = grainSvg({ colorHex: '#1c1813', maxAlpha: 0.05 });
    expect(GRAIN_TILE_PX).toBe(128);
    expect(svg).toContain(`width='128' height='128'`);
    expect(svg).toContain(`baseFrequency='${GRAIN_BASE_FREQUENCY}'`);
    expect(GRAIN_BASE_FREQUENCY).toBe(0.8);
    expect(svg).toContain(`numOctaves='${GRAIN_OCTAVES}'`);
    expect(GRAIN_OCTAVES).toBe(2);
    expect(svg).toContain(`color-interpolation-filters='sRGB'`);
  });

  it('is one flat ink color whose per-pixel alpha cannot exceed maxAlpha', () => {
    const svg = grainSvg({ colorHex: '#f4ecdc', maxAlpha: 0.07 });
    const [r, g, b, a] = matrixRows(svg);
    const ink = parseHex('#f4ecdc');
    // RGB rows ignore the noise (desaturated) and carry the ink as a constant.
    expect(r?.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(g?.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(b?.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect([r?.[4], g?.[4], b?.[4]].map((v) => Math.round((v ?? 0) * 255))).toEqual([...ink]);
    // Alpha = maxAlpha × one noise channel in [0, 1] and nothing else, so alpha <= maxAlpha everywhere.
    expect(a).toEqual([0.07, 0, 0, 0, 0]);
  });

  it('embeds as a data URI of about 1 kB with no characters that break a quoted CSS url()', () => {
    const url = grainCssUrl({ colorHex: '#1c1813', maxAlpha: 0.05 });
    expect(url.length).toBeLessThanOrEqual(1024);
    const inner = url.slice('url("'.length, -'")'.length);
    expect(inner.startsWith('data:image/svg+xml,')).toBe(true);
    expect(inner).not.toMatch(/[<>"#{} ;]/);
  });

  it('matches the tiles in tokens.css: band ink and chrome ink at ui.theme.grainOpacity*', () => {
    const dayAlpha = uiConfig['ui.theme.grainOpacityDaylight'];
    const lampAlpha = uiConfig['ui.theme.grainOpacityLamplight'];
    expect(daylight['--grain-band']).toBe(grainCssUrl({ colorHex: daylight['--ink-1'] ?? '', maxAlpha: dayAlpha }));
    expect(daylight['--grain-chrome']).toBe(
      grainCssUrl({ colorHex: daylight['--chrome-ink'] ?? '', maxAlpha: dayAlpha }),
    );
    expect(lamplight['--grain-band']).toBe(grainCssUrl({ colorHex: lamplight['--ink-1'] ?? '', maxAlpha: lampAlpha }));
    expect(lamplight['--grain-chrome']).toBe(
      grainCssUrl({ colorHex: lamplight['--chrome-ink'] ?? '', maxAlpha: lampAlpha }),
    );
  });
});

describe('grain switch-offs (T28)', () => {
  it('applies grain only through the .grain and .grain-chrome classes', () => {
    expect(findBlock(base, '.grain').decls['background-image']).toBe('var(--grain-band)');
    expect(findBlock(base, '.grain-chrome').decls['background-image']).toBe('var(--grain-chrome)');
  });

  it('removes grain with headerGrain off, under forced colors, high contrast and in print', () => {
    expect(findBlock(base, ":root[data-grain='off'] :is(.grain, .grain-chrome)").decls['background-image']).toBe(
      'none',
    );
    for (const media of ['@media (forced-colors: active)', '@media (prefers-contrast: more)', '@media print']) {
      expect(findBlock(base, ':is(.grain, .grain-chrome)', [media]).decls['background-image'], media).toBe('none');
    }
  });

  it('keeps the switch-offs after the grain rules and outside any cascade layer, so they win', () => {
    const grainAt = baseCss.indexOf('\n.grain {');
    const offAt = baseCss.indexOf(":root[data-grain='off']");
    expect(grainAt).toBeGreaterThan(0);
    expect(offAt).toBeGreaterThan(grainAt);
    for (const selector of ['.grain', ":root[data-grain='off'] :is(.grain, .grain-chrome)"]) {
      expect(findBlock(base, selector).parents).toEqual([]);
    }
  });
});

describe('display face roles (13.20, D-13.59)', () => {
  it('never sets the display face below ui.theme.displayMinPx', () => {
    const roles = base.filter((b) => b.decls['font-family'] === 'var(--font-display)');
    expect(roles.map((b) => b.prelude).sort()).toEqual(
      ['.display-panel', '.display-section', '.display-title', '.display-title-screen'].sort(),
    );
    for (const role of roles) {
      expect(parseFloat(role.decls['font-size'] ?? '0'), role.prelude).toBeGreaterThanOrEqual(
        uiConfig['ui.theme.displayMinPx'],
      );
    }
  });
});
