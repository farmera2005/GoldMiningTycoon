// Bundled fonts and metric-matched fallbacks (DESIGN §13.20 typography, D-13.59; T28's font budget and no network
// font request). The fallback descriptors in fonts.css are recomputed here from the bundled files.
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { uiConfig } from '../../data/tuning/ui';
import { parseCss, type CssBlock } from './cssParse';
import { LOCAL_FALLBACK_METRICS, fallbackOverrides, readFontMetrics, type FontMetrics } from './fontMetrics';

const root = process.cwd();
const require = createRequire(resolve(root, 'package.json'));
const fontsCss = readFileSync(resolve(root, 'src/ui/theme/fonts.css'), 'utf8');
const faces = parseCss(fontsCss).filter((b) => b.prelude === '@font-face');

const family = (face: CssBlock): string => (face.decls['font-family'] ?? '').replace(/['"]/g, '');
const urls = (face: CssBlock): string[] =>
  [...(face.decls['src'] ?? '').matchAll(/url\('([^']+)'\)/g)].map((m) => m[1] ?? '');
const webFaces = faces.filter((f) => !family(f).endsWith('Fallback'));
const fallbackFaces = faces.filter((f) => family(f).endsWith('Fallback'));

function metricsOf(specifier: string): FontMetrics {
  return readFontMetrics(new Uint8Array(readFileSync(require.resolve(specifier))));
}

describe('bundled faces', () => {
  it('reference only WOFF2 files inside the build (no network, no WOFF fallbacks)', () => {
    expect(fontsCss).not.toMatch(/https?:/);
    for (const face of webFaces) {
      const sources = urls(face);
      expect(sources).toHaveLength(1);
      expect(sources[0]).toMatch(/^@fontsource\/(besley|inter)\/files\/[a-z0-9-]+\.woff2$/);
      expect(face.decls['font-display']).toBe('swap');
      expect(face.decls['unicode-range']).toBeDefined();
    }
  });

  it('ship Besley 600/700 and Inter 400/500/600 upright plus 400 italic', () => {
    const set = (name: string): string[] =>
      [
        ...new Set(
          webFaces.filter((f) => family(f) === name).map((f) => `${f.decls['font-weight']} ${f.decls['font-style']}`),
        ),
      ].sort();
    expect(set('Besley')).toEqual(['600 normal', '700 normal']);
    expect(set('Inter')).toEqual(['400 italic', '400 normal', '500 normal', '600 normal']);
  });

  it('stay within ui.fonts.maxKb in total', () => {
    const files = [...new Set(webFaces.flatMap(urls))];
    const totalBytes = files.reduce((sum, f) => sum + statSync(require.resolve(f)).size, 0);
    expect(totalBytes).toBeLessThanOrEqual(uiConfig['ui.fonts.maxKb'] * 1000);
  });

  it('preload only faces that fonts.css declares', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const links = [...html.matchAll(/<link\s[^>]*>/g)].map((m) => m[0]).filter((l) => /rel="preload"/.test(l));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toMatch(/as="font"/);
    const preloads = links.map((l) => /href="\/node_modules\/([^"]+)"/.exec(l)?.[1]);
    const declared = new Set(webFaces.flatMap(urls));
    for (const p of preloads) expect(declared.has(p ?? ''), p).toBe(true);
  });
});

describe('fontMetrics', () => {
  it('reads Inter and Besley vertical metrics from the bundled files', () => {
    expect(metricsOf('@fontsource/inter/files/inter-latin-400-normal.woff')).toMatchObject({
      unitsPerEm: 2048,
      ascent: 1984,
      descent: -494,
      lineGap: 0,
    });
    expect(metricsOf('@fontsource/besley/files/besley-latin-700-normal.woff')).toMatchObject({
      unitsPerEm: 2000,
      ascent: 2500,
      descent: -850,
      lineGap: 0,
    });
  });

  it('computes fallback descriptors (hand-computed fixture)', () => {
    // Target average width 0.5 em, fallback 0.4 em → size-adjust 125%; the scaled em is 1,250 target units, so
    // ascent 900 → 72%, descent 300 → 24%, line gap 100 → 8%.
    const target: FontMetrics = { unitsPerEm: 1000, ascent: 900, descent: -300, lineGap: 100, xWidthAvg: 500 };
    const fallback: FontMetrics = { unitsPerEm: 2000, ascent: 1800, descent: -400, lineGap: 0, xWidthAvg: 800 };
    const o = fallbackOverrides(target, fallback);
    expect(o.sizeAdjustPct).toBeCloseTo(125, 10);
    expect(o.ascentOverridePct).toBeCloseTo(72, 10);
    expect(o.descentOverridePct).toBeCloseTo(24, 10);
    expect(o.lineGapOverridePct).toBeCloseTo(8, 10);
  });
});

describe('metric-matched fallback faces', () => {
  const PLAN: readonly {
    family: string;
    weight: string;
    target: string;
    fallback: keyof typeof LOCAL_FALLBACK_METRICS;
  }[] = [
    {
      family: 'Besley Fallback',
      weight: '600',
      target: '@fontsource/besley/files/besley-latin-600-normal.woff',
      fallback: 'timesBold',
    },
    {
      family: 'Besley Fallback',
      weight: '700',
      target: '@fontsource/besley/files/besley-latin-700-normal.woff',
      fallback: 'timesBold',
    },
    {
      family: 'Inter Fallback',
      weight: '400',
      target: '@fontsource/inter/files/inter-latin-400-normal.woff',
      fallback: 'arialRegular',
    },
    {
      family: 'Inter Fallback',
      weight: '500',
      target: '@fontsource/inter/files/inter-latin-500-normal.woff',
      fallback: 'arialRegular',
    },
    {
      family: 'Inter Fallback',
      weight: '600',
      target: '@fontsource/inter/files/inter-latin-600-normal.woff',
      fallback: 'arialBold',
    },
  ];

  it('declares exactly the planned fallback faces, all local()', () => {
    expect(fallbackFaces.map((f) => `${family(f)} ${f.decls['font-weight']}`).sort()).toEqual(
      PLAN.map((p) => `${p.family} ${p.weight}`).sort(),
    );
    for (const face of fallbackFaces) expect(face.decls['src']).toMatch(/^local\(/);
  });

  it.each(PLAN)('$family $weight matches the bundled face to 0.01%', (plan) => {
    const face = fallbackFaces.find((f) => family(f) === plan.family && f.decls['font-weight'] === plan.weight);
    expect(face).toBeDefined();
    const expected = fallbackOverrides(metricsOf(plan.target), LOCAL_FALLBACK_METRICS[plan.fallback]);
    const pct = (name: string): number => parseFloat(face?.decls[name] ?? 'NaN');
    expect(Math.abs(pct('size-adjust') - expected.sizeAdjustPct)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(pct('ascent-override') - expected.ascentOverridePct)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(pct('descent-override') - expected.descentOverridePct)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(pct('line-gap-override') - expected.lineGapOverridePct)).toBeLessThanOrEqual(0.01);
  });

  it('names the fallback faces in the Tailwind font stacks right after the web faces', () => {
    const indexCss = readFileSync(resolve(root, 'src/ui/theme/index.css'), 'utf8').replace(/\s+/g, ' ');
    expect(indexCss).toContain(`--font-display: 'Besley', 'Besley Fallback', Rockwell, 'Roboto Slab', Georgia, serif;`);
    expect(indexCss).toContain(
      `--font-sans: 'Inter', 'Inter Fallback', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;`,
    );
  });
});
