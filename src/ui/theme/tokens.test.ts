// T20 Tokens (DESIGN §13.27): computed from theme/tokens.css for both themes. Every figure in 13.20 is reproduced to
// 0.1 (two decimals where 13.20 quotes two), and every rule is checked as a floor.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { uiConfig } from '../../data/tuning/ui';
import { compositeOver, contrastRatio, cvdDeltaE, deltaE, oklch, parseHex, type Rgb } from './color';
import { findBlock, parseCss } from './cssParse';

// Vitest runs from the repository root; jsdom gives import.meta.url a non-file scheme.
const css = readFileSync(resolve(process.cwd(), 'src/ui/theme/tokens.css'), 'utf8');
const blocks = parseCss(css);
const daylightDecls = findBlock(blocks, ':root').decls;
const lamplightDecls = findBlock(blocks, ":root[data-theme='lamplight']").decls;
const systemDarkDecls = findBlock(blocks, ":root:not([data-theme='daylight'])", [
  '@media (prefers-color-scheme: dark)',
]).decls;

type ThemeName = 'daylight' | 'lamplight';
const THEMES: Readonly<Record<ThemeName, Readonly<Record<string, string>>>> = {
  daylight: daylightDecls,
  lamplight: lamplightDecls,
};
const GRAIN_ALPHA: Readonly<Record<ThemeName, number>> = {
  daylight: uiConfig['ui.theme.grainOpacityDaylight'],
  lamplight: uiConfig['ui.theme.grainOpacityLamplight'],
};

function color(theme: ThemeName, token: string): Rgb {
  const value = THEMES[theme][`--${token}`];
  if (value === undefined) throw new Error(`--${token} missing in ${theme}`);
  return parseHex(value);
}

const SURFACES = ['surface-0', 'surface-1', 'surface-2'] as const;
const STATUSES = ['good', 'warning', 'serious', 'critical'] as const;
const SERIES = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `series-${n}`);
const RAMP_STEPS = [100, 200, 300, 400, 500, 600, 700];

const round = (x: number, dp = 1): number => Math.round(x * 10 ** dp) / 10 ** dp;
/** "Reproduces 13.20's figure to 0.1" (D-13.70): figures are rounded to one decimal unless 13.20 quotes two. */
const expectFigure = (actual: number, figure: number): void => {
  expect(Math.abs(actual - figure), `${actual} vs 13.20's ${figure}`).toBeLessThan(0.1);
};
const contrastOn = (theme: ThemeName, fg: string, bg: string): number =>
  contrastRatio(color(theme, fg), color(theme, bg));
const worstOnSurfaces = (theme: ThemeName, token: string): number =>
  Math.min(...SURFACES.map((s) => contrastOn(theme, token, s)));

const COLOR_TOKENS = [
  ...SURFACES,
  'ink-1',
  'ink-2',
  'ink-3',
  'hairline',
  'axis',
  'border-control',
  'accent',
  'on-accent',
  'link',
  'chrome',
  'chrome-ink',
  'chrome-ink-2',
  'chrome-hairline',
  'brass',
  'brass-on-chrome',
  ...STATUSES.flatMap((s) => [`status-${s}`, `status-${s}-on`, `status-${s}-text`]),
  ...SERIES,
  ...RAMP_STEPS.flatMap((n) => [`seq-gold-${n}`, `seq-slate-${n}`]),
  'div-neg-1',
  'div-neg-2',
  'div-neg-3',
  'div-mid',
  'div-pos-1',
  'div-pos-2',
  'div-pos-3',
];

describe('T20 token file structure', () => {
  it('defines every 13.20 color token as #rrggbb in both themes', () => {
    for (const theme of ['daylight', 'lamplight'] as const) {
      for (const token of COLOR_TOKENS) {
        expect(THEMES[theme][`--${token}`], `${theme} --${token}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('keeps the explicit Lamplight block and the system-dark block identical', () => {
    expect(systemDarkDecls).toEqual(lamplightDecls);
  });

  it('declares the matching color-scheme for each theme', () => {
    expect(daylightDecls['color-scheme']).toBe('light');
    expect(lamplightDecls['color-scheme']).toBe('dark');
  });

  it('keeps accent equal to series-1 (slate is also the interactive color, D-13.57)', () => {
    for (const theme of ['daylight', 'lamplight'] as const) {
      expect(THEMES[theme]['--accent']).toBe(THEMES[theme]['--series-1']);
    }
  });

  it('shares status fills, chip labels and the sequential ramps between themes (13.20)', () => {
    for (const token of [
      ...STATUSES.flatMap((s) => [`status-${s}`, `status-${s}-on`]),
      ...RAMP_STEPS.flatMap((n) => [`seq-gold-${n}`, `seq-slate-${n}`]),
    ]) {
      expect(lamplightDecls[`--${token}`], token).toBe(daylightDecls[`--${token}`]);
    }
  });
});

describe('T20 text contrast (WCAG 2.2, >= 4.5:1 on every surface of its theme)', () => {
  const textTokens = ['ink-1', 'ink-2', 'ink-3', 'link', ...STATUSES.map((s) => `status-${s}-text`)];

  it('passes every text token on all three surfaces', () => {
    for (const theme of ['daylight', 'lamplight'] as const) {
      for (const token of textTokens) {
        expect(worstOnSurfaces(theme, token), `${theme} ${token}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('reproduces the ink and link figures (Daylight / Lamplight, worst surface)', () => {
    expect([round(worstOnSurfaces('daylight', 'ink-1')), round(worstOnSurfaces('lamplight', 'ink-1'))]).toEqual([
      14.9, 13.4,
    ]);
    expect([round(worstOnSurfaces('daylight', 'ink-2')), round(worstOnSurfaces('lamplight', 'ink-2'))]).toEqual([
      8.4, 9.0,
    ]);
    expect([round(worstOnSurfaces('daylight', 'ink-3')), round(worstOnSurfaces('lamplight', 'ink-3'))]).toEqual([
      5.6, 5.6,
    ]);
    expect([round(worstOnSurfaces('daylight', 'link')), round(worstOnSurfaces('lamplight', 'link'))]).toEqual([
      6.0, 7.3,
    ]);
  });

  it('keeps bare status text at or above 5.2 (Daylight) and 5.9 (Lamplight)', () => {
    const worst = (theme: ThemeName): number =>
      Math.min(...STATUSES.map((s) => worstOnSurfaces(theme, `status-${s}-text`)));
    expect(worst('daylight')).toBeGreaterThanOrEqual(5.2);
    expect(worst('lamplight')).toBeGreaterThanOrEqual(5.9);
  });

  it('passes chrome ink on flat chrome and reproduces 10.5 / 16.5 and 7.4 / 9.1', () => {
    for (const theme of ['daylight', 'lamplight'] as const) {
      expect(contrastOn(theme, 'chrome-ink', 'chrome')).toBeGreaterThanOrEqual(4.5);
      expect(contrastOn(theme, 'chrome-ink-2', 'chrome')).toBeGreaterThanOrEqual(4.5);
    }
    expect([
      round(contrastOn('daylight', 'chrome-ink', 'chrome')),
      round(contrastOn('lamplight', 'chrome-ink', 'chrome')),
    ]).toEqual([10.5, 16.5]);
    expect([
      round(contrastOn('daylight', 'chrome-ink-2', 'chrome')),
      round(contrastOn('lamplight', 'chrome-ink-2', 'chrome')),
    ]).toEqual([7.4, 9.1]);
  });

  it('passes the primary button label: on-accent on accent >= 4.5 (6.0 / 4.8)', () => {
    expect(contrastOn('daylight', 'on-accent', 'accent')).toBeGreaterThanOrEqual(4.5);
    expect(contrastOn('lamplight', 'on-accent', 'accent')).toBeGreaterThanOrEqual(4.5);
    expect([
      round(contrastOn('daylight', 'on-accent', 'accent')),
      round(contrastOn('lamplight', 'on-accent', 'accent')),
    ]).toEqual([6.0, 4.8]);
  });
});

describe('T20 component and graphic contrast (>= 3:1 where used)', () => {
  it('accent on surfaces (focus ring, primary buttons, "yours"): 5.05 / 4.0', () => {
    expect(worstOnSurfaces('daylight', 'accent')).toBeGreaterThanOrEqual(3);
    expect(worstOnSurfaces('lamplight', 'accent')).toBeGreaterThanOrEqual(3);
    expectFigure(worstOnSurfaces('daylight', 'accent'), 5.05);
    expectFigure(worstOnSurfaces('lamplight', 'accent'), 4.0);
  });

  it('border-control on surfaces (WCAG 1.4.11): 3.3 / 3.2', () => {
    expect(worstOnSurfaces('daylight', 'border-control')).toBeGreaterThanOrEqual(3);
    expect(worstOnSurfaces('lamplight', 'border-control')).toBeGreaterThanOrEqual(3);
    expect([
      round(worstOnSurfaces('daylight', 'border-control')),
      round(worstOnSurfaces('lamplight', 'border-control')),
    ]).toEqual([3.3, 3.2]);
  });

  it('brass on surfaces (title rule) 3.35 / 7.7; brass-on-chrome on chrome (marker, wordmark, focus) 6.2 / 9.5', () => {
    expect(round(worstOnSurfaces('daylight', 'brass'), 2)).toBe(3.35);
    expect(round(worstOnSurfaces('lamplight', 'brass'))).toBe(7.7);
    expect(round(contrastOn('daylight', 'brass-on-chrome', 'chrome'))).toBe(6.2);
    expect(round(contrastOn('lamplight', 'brass-on-chrome', 'chrome'))).toBe(9.5);
    for (const theme of ['daylight', 'lamplight'] as const) {
      expect(worstOnSurfaces(theme, 'brass')).toBeGreaterThanOrEqual(3);
      expect(contrastOn(theme, 'brass-on-chrome', 'chrome')).toBeGreaterThanOrEqual(3);
    }
  });

  it('Lamplight status fills >= 3 on every surface (critical 3.09 on raised)', () => {
    for (const s of STATUSES) expect(worstOnSurfaces('lamplight', `status-${s}`), s).toBeGreaterThanOrEqual(3);
    expect(round(contrastOn('lamplight', 'status-critical', 'surface-2'), 2)).toBe(3.09);
  });

  it('Daylight status fills match 13.20: critical 4.30, good 3.2 on cards and 2.9 on the page, warning 1.6, serious 2.6', () => {
    // Critical is the one Daylight fill drawn as a bare graphic, so it alone must clear 3:1 (13.19).
    expect(worstOnSurfaces('daylight', 'status-critical')).toBeGreaterThanOrEqual(3);
    expectFigure(worstOnSurfaces('daylight', 'status-critical'), 4.3);
    expect(round(contrastOn('daylight', 'status-good', 'surface-1'))).toBe(3.2);
    expect(round(contrastOn('daylight', 'status-good', 'surface-0'))).toBe(2.9);
    expect(round(worstOnSurfaces('daylight', 'status-warning'))).toBe(1.6);
    expect(round(worstOnSurfaces('daylight', 'status-serious'))).toBe(2.6);
  });

  it('status chip labels on their fills >= 4.5 in both themes: 5.2 / 9.4 / 5.7 / 5.1', () => {
    for (const theme of ['daylight', 'lamplight'] as const) {
      const figures = STATUSES.map((s) => contrastOn(theme, `status-${s}-on`, `status-${s}`));
      for (const f of figures) expect(f).toBeGreaterThanOrEqual(4.5);
      expect(figures.map((f) => round(f))).toEqual([5.2, 9.4, 5.7, 5.1]);
    }
  });
});

describe('T20 text on grain (worst pixel at ui.theme.grainOpacity*)', () => {
  // The worst pixel is the band fully covered by speckle at the maximum alpha; the speckle is the band's ink
  // (ink-1 on content bands, chrome-ink on chrome; grain.ts).
  const onGrain = (theme: ThemeName, text: string, band: string, speckle: string): number =>
    contrastRatio(color(theme, text), compositeOver(color(theme, band), color(theme, speckle), GRAIN_ALPHA[theme]));

  it('keeps every text token >= 4.5 on every grained band', () => {
    for (const theme of ['daylight', 'lamplight'] as const) {
      for (const band of SURFACES) {
        for (const text of ['ink-1', 'ink-2', 'ink-3']) {
          expect(onGrain(theme, text, band, 'ink-1'), `${theme} ${text} on grained ${band}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      }
      for (const text of ['chrome-ink', 'chrome-ink-2']) {
        expect(
          onGrain(theme, text, 'chrome', 'chrome-ink'),
          `${theme} ${text} on grained chrome`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('reproduces 13.20: Daylight ink-3 5.0 on the page band, chrome-ink 9.1; Lamplight 5.7 and 14.3', () => {
    expect(round(onGrain('daylight', 'ink-3', 'surface-0', 'ink-1'))).toBe(5.0);
    expect(round(onGrain('daylight', 'chrome-ink', 'chrome', 'chrome-ink'))).toBe(9.1);
    expect(round(onGrain('lamplight', 'ink-3', 'surface-0', 'ink-1'))).toBe(5.7);
    expect(round(onGrain('lamplight', 'chrome-ink', 'chrome', 'chrome-ink'))).toBe(14.3);
  });
});

describe('T20 categorical palette (data-viz checks, D-13.57)', () => {
  const series = (theme: ThemeName): Rgb[] => SERIES.map((t) => color(theme, t));
  const BAND: Readonly<Record<ThemeName, readonly [number, number]>> = {
    daylight: [0.43, 0.77],
    lamplight: [0.48, 0.67],
  };
  const adjacent = (n: number): [number, number][] => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
  const firstThreePairs: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  const worstPair = (cols: Rgb[], pairs: [number, number][], measure: (a: Rgb, b: Rgb) => number) => {
    let worst = { value: Infinity, pair: [0, 0] as [number, number] };
    for (const [i, j] of pairs) {
      const v = measure(cols[i] ?? [0, 0, 0], cols[j] ?? [0, 0, 0]);
      if (v < worst.value) worst = { value: v, pair: [i + 1, j + 1] };
    }
    return worst;
  };

  it('keeps every slot inside the OKLCH lightness band with chroma >= 0.10', () => {
    for (const theme of ['daylight', 'lamplight'] as const) {
      const [lo, hi] = BAND[theme];
      for (const [i, c] of series(theme).entries()) {
        const { l, c: chroma } = oklch(c);
        expect(l, `${theme} slot ${i + 1} L`).toBeGreaterThanOrEqual(lo);
        expect(l, `${theme} slot ${i + 1} L`).toBeLessThanOrEqual(hi);
        expect(chroma, `${theme} slot ${i + 1} C`).toBeGreaterThanOrEqual(0.1);
      }
    }
  });

  it('separates adjacent slots under protan/deutan (>= 8): 11.4 plum–spruce / 11.3 spruce–ochre', () => {
    const d = worstPair(series('daylight'), adjacent(8), cvdDeltaE);
    const l = worstPair(series('lamplight'), adjacent(8), cvdDeltaE);
    expect(d.value).toBeGreaterThanOrEqual(8);
    expect(l.value).toBeGreaterThanOrEqual(8);
    expect([round(d.value), d.pair]).toEqual([11.4, [3, 4]]);
    expect([round(l.value), l.pair]).toEqual([11.3, [2, 3]]);
  });

  it('separates adjacent slots under normal vision (>= 15): 24.4 spruce–ochre / 16.9 indigo–fireweed', () => {
    const d = worstPair(series('daylight'), adjacent(8), (a, b) => deltaE(a, b));
    const l = worstPair(series('lamplight'), adjacent(8), (a, b) => deltaE(a, b));
    expect(d.value).toBeGreaterThanOrEqual(15);
    expect(l.value).toBeGreaterThanOrEqual(15);
    expect([round(d.value), d.pair]).toEqual([24.4, [2, 3]]);
    expect([round(l.value), l.pair]).toEqual([16.9, [7, 8]]);
  });

  it('passes slots 1–3 all-pairs at the same floors: 12.3 / 16.4 Daylight, 11.3 / 16.2 Lamplight', () => {
    const figures = (theme: ThemeName) => [
      round(worstPair(series(theme), firstThreePairs, cvdDeltaE).value),
      round(worstPair(series(theme), firstThreePairs, (a, b) => deltaE(a, b)).value),
    ];
    expect(figures('daylight')).toEqual([12.3, 16.4]);
    expect(figures('lamplight')).toEqual([11.3, 16.2]);
    expect(round(cvdDeltaE(color('daylight', 'series-1'), color('daylight', 'series-2')))).toBe(27.3);
    expect(round(cvdDeltaE(color('lamplight', 'series-1'), color('lamplight', 'series-2')))).toBe(22.7);
  });

  it('lists exactly the sub-3:1 slots of 13.20 (relief: direct labels or the table view)', () => {
    const below = (theme: ThemeName, surface: string): Record<number, number> => {
      const out: Record<number, number> = {};
      for (const [i, token] of SERIES.entries()) {
        const c = contrastOn(theme, token, surface);
        if (c < 3) out[i + 1] = round(c);
      }
      return out;
    };
    // Daylight on cards: ochre 2.4, glacier 2.8; fireweed also drops below on the page (2.8).
    expect(below('daylight', 'surface-1')).toEqual({ 2: 2.4, 5: 2.8 });
    expect(below('daylight', 'surface-0')[8]).toBe(2.8);
    // Lamplight on cards: plum 2.9, and 2.6 on raised.
    expect(below('lamplight', 'surface-1')).toEqual({ 4: 2.9 });
    expect(below('lamplight', 'surface-2')).toEqual({ 4: 2.6 });
  });

  it('reproduces status against the nearest series hue (normal-vision ΔE)', () => {
    const pairs: [string, string][] = [
      ['status-good', 'series-3'],
      ['status-warning', 'series-2'],
      ['status-serious', 'series-2'],
      ['status-critical', 'series-6'],
    ];
    const figures = (theme: ThemeName) => pairs.map(([a, b]) => round(deltaE(color(theme, a), color(theme, b))));
    expect(figures('daylight')).toEqual([9.5, 8.7, 8.5, 6.6]);
    expect(figures('lamplight')).toEqual([8.1, 16.0, 7.8, 7.0]);
  });
});

describe('T20 sequential and diverging ramps (D-13.58)', () => {
  const ramp = (name: 'gold' | 'slate'): Rgb[] => RAMP_STEPS.map((n) => color('daylight', `seq-${name}-${n}`));
  const TARGET_L = [0.95, 0.88, 0.79, 0.7, 0.6, 0.5, 0.4];

  it('holds one hue per ramp (spread <= 40°) with OKLCH L at 0.95 … 0.40, monotone', () => {
    for (const name of ['gold', 'slate'] as const) {
      const lch = ramp(name).map(oklch);
      for (const [i, step] of lch.entries())
        expect(step.l, `${name} ${RAMP_STEPS[i]}`).toBeCloseTo(TARGET_L[i] ?? 0, 2);
      for (let i = 1; i < lch.length; i++) expect(lch[i]?.l ?? 1).toBeLessThan(lch[i - 1]?.l ?? 0);
      const hues = lch.map((s) => s.h);
      expect(Math.max(...hues) - Math.min(...hues), `${name} hue spread`).toBeLessThanOrEqual(40);
    }
    // Gold runs from hue 86° at the pale end to 60° at the dark end; slate stays within 245°–253°.
    expect(round(oklch(ramp('gold')[0] ?? [0, 0, 0]).h, 0)).toBe(86);
    expect(round(oklch(ramp('gold')[6] ?? [0, 0, 0]).h, 0)).toBe(60);
  });

  it('builds the diverging scale from the ramps, each arm moving away from the surface bin by bin', () => {
    const expected: Readonly<Record<ThemeName, { neg: number[]; pos: number[]; mid: string }>> = {
      daylight: { neg: [300, 500, 700], pos: [300, 500, 700], mid: '#e9e3d8' },
      lamplight: { neg: [500, 300, 200], pos: [500, 300, 200], mid: '#3b352d' },
    };
    for (const theme of ['daylight', 'lamplight'] as const) {
      const e = expected[theme];
      expect(THEMES[theme]['--div-mid']).toBe(e.mid);
      for (const [i, step] of e.neg.entries()) {
        expect(THEMES[theme][`--div-neg-${i + 1}`]).toBe(THEMES[theme][`--seq-slate-${step}`]);
      }
      for (const [i, step] of e.pos.entries()) {
        expect(THEMES[theme][`--div-pos-${i + 1}`]).toBe(THEMES[theme][`--seq-gold-${step}`]);
      }
      for (const arm of ['neg', 'pos']) {
        const c = [1, 2, 3].map((b) => contrastOn(theme, `div-${arm}-${b}`, 'surface-1'));
        expect(c[1] ?? 0, `${theme} ${arm}`).toBeGreaterThan(c[0] ?? 0);
        expect(c[2] ?? 0, `${theme} ${arm}`).toBeGreaterThan(c[1] ?? 0);
      }
    }
  });
});
