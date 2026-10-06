// Charts (DESIGN §13.18 "Recharts usage", §13.20 chart palette, §13.19 table twins; T15's production-vs-plan
// thresholds): every chart is a <figure> with a caption summary and a Table view whose values are <Num>s; colors are
// token references; series slots wrap at eight and claims keep theirs; animation follows reduced motion and the
// 500-point rule; the data shaping of each chart is pure and tested.
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cashRef, netWorthRef } from '../explain/refs';
import { freshState } from '../testing/harness';
import { renderWithStore } from '../testing/render';
import { Bullet, planStatus } from './Bullet';
import { CashForecast, cashRows, firstNegativeWeek } from './CashForecast';
import { FanChart, fanRows } from './FanChart';
import { SeasonStrip, weekX } from './SeasonStrip';
import { Sparkline, sparkRows } from './Sparkline';
import { StackedCost, foldCategories, OTHER_KEY } from './StackedCost';
import { StageBars, idleCauseOrder, type StageRowView } from './StageBars';
import { claimSlot, rampColor, seriesColor, shouldAnimate, tickText } from './theme';
import { Tornado, tornadoData } from './Tornado';

afterEach(() => {
  cleanup();
});

const state = freshState();

function openTable(figure: HTMLElement): HTMLElement {
  fireEvent.click(within(figure).getByRole('button', { name: 'Table view' }));
  return within(figure).getByRole('table');
}

describe('chart theme (13.20)', () => {
  it('maps series slots to tokens in fixed order, wrapping at eight; a claim keeps its acquisition slot', () => {
    expect(seriesColor(0)).toBe('var(--series-1)');
    expect(seriesColor(7)).toBe('var(--series-8)');
    expect(seriesColor(8)).toBe('var(--series-1)');
    expect(seriesColor(-1)).toBe('var(--series-8)');
    expect(claimSlot(10)).toBe(2);
    expect(rampColor('gold', 3)).toBe('var(--seq-gold-300)');
  });

  it('animates only with reduced motion off and fewer than 500 points; money ticks are compact', () => {
    expect(shouldAnimate(false, 499)).toBe(true);
    expect(shouldAnimate(false, 500)).toBe(false);
    expect(shouldAnimate(true, 10)).toBe(false);
    expect(tickText(41_230_000, 'cents')).toBe('$412k');
    expect(tickText(99_999, 'usd')).toBe('$99,999');
    expect(tickText(0.784, 'pct')).toBe('78.4%');
  });
});

describe('data shaping', () => {
  it('joins actual and forecast lines at the last actual week', () => {
    const rows = sparkRows([
      { turn: 1, value: 10, explain: cashRef },
      { turn: 2, value: 12, explain: cashRef },
      { turn: 3, value: 9, explain: cashRef, forecast: true },
    ]);
    expect(rows.map((r) => [r.actual, r.forecast])).toEqual([
      [10, undefined],
      [12, 12],
      [undefined, 9],
    ]);
    const cash = cashRows(
      [{ turn: 5, cents: 100, explain: cashRef }],
      [
        { turn: 6, cents: 50, explain: cashRef },
        { turn: 7, cents: -20, explain: cashRef },
      ],
    );
    expect(cash.map((r) => [r.turn, r.actual, r.forecast, r.isForecast])).toEqual([
      [5, 100, 100, false],
      [6, undefined, 50, true],
      [7, undefined, -20, true],
    ]);
    expect(firstNegativeWeek([{ turn: 7, cents: -1, explain: cashRef }])).toBe(7);
    expect(firstNegativeWeek([])).toBeNull();
  });

  it('stacks a fan as a transparent P10 base plus the P90 − P10 band', () => {
    expect(fanRows([{ turn: 1, p10: 2, p50: 3, p90: 7, explain: cashRef }])[0]).toMatchObject({
      base: 2,
      band: 5,
      p50: 3,
    });
  });

  it('folds categories past eight into Other', () => {
    const cats = Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, label: `C${i}` }));
    const { kept, folded } = foldCategories(cats);
    expect(kept).toHaveLength(8);
    expect(kept[7]?.key).toBe(OTHER_KEY);
    expect(folded.map((c) => c.key)).toEqual(['c7', 'c8', 'c9']);
    expect(foldCategories(cats.slice(0, 8)).folded).toEqual([]);
  });

  it('reads plan status at the 13.3 thresholds (T15: −9.9% on track, −10.1% behind, −25.1% well behind)', () => {
    expect(planStatus(90.1, 100).status).toBe('good');
    expect(planStatus(89.9, 100).status).toBe('warning');
    expect(planStatus(74.9, 100).status).toBe('critical');
    expect(planStatus(0.909, 1)).toMatchObject({ status: 'good' });
    expect(planStatus(5, 0)).toEqual({ variance: null, status: 'good' });
  });

  it('sorts a tornado by swing and keeps idle causes in first-seen order', () => {
    const data = tornadoData(
      [
        { key: 'a', label: 'A', low: 90, high: 110, explainLow: cashRef, explainHigh: cashRef },
        { key: 'b', label: 'B', low: 50, high: 150, explainLow: cashRef, explainHigh: cashRef },
      ],
      100,
    );
    expect(data.map((d) => [d.key, d.lowDelta, d.highDelta])).toEqual([
      ['b', -50, 50],
      ['a', -10, 10],
    ]);
    expect(
      idleCauseOrder([
        { idle: [{ cause: 'starved' }, { cause: 'servicing' }] },
        { idle: [{ cause: 'servicing' }, { cause: 'weather' }] },
      ] as unknown as StageRowView[]),
    ).toEqual(['starved', 'servicing', 'weather']);
    expect(weekX(1, 520)).toBe(0);
    expect(weekX(27, 520)).toBe(260);
    expect(weekX(53, 520)).toBe(520);
  });
});

describe('figures and table twins (13.18, 13.19)', () => {
  it('a fan chart captions its last estimate and twins every quantile as a <Num>', () => {
    renderWithStore(
      <FanChart
        title="Contained gold estimate"
        unit="rawOz"
        ramp="gold"
        points={[
          { turn: 3, p10: 120, p50: 300, p90: 800, explain: cashRef },
          { turn: 8, p10: 210, p50: 330, p90: 520, explain: cashRef },
        ]}
        reference={{ value: 900, label: 'Seller-implied' }}
      />,
      { state },
    );
    const figure = screen.getByRole('figure');
    expect(within(figure).getByText(/At Y1 Wk 9 the P50 is 330\.00 raw oz/, { selector: 'span' })).toBeTruthy();
    const table = openTable(figure);
    expect(table.querySelectorAll('[data-num]')).toHaveLength(6);
    expect(within(table).getByRole('rowheader', { name: 'Y1 Wk 4' })).toBeTruthy();
    expect(within(figure).getByRole('button', { name: 'Table view' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a cash chart says when it goes below zero and twins actual, forecast and chips', () => {
    renderWithStore(
      <CashForecast
        title="13-week cash"
        legend="incl. planned cleanups (P50)"
        actual={[{ turn: 0, cents: 11_720_000, explain: cashRef }]}
        forecast={[
          { turn: 1, cents: 7_090_000, explain: cashRef },
          { turn: 2, cents: -300_000, explain: cashRef },
        ]}
        chips={[{ turn: 2, label: 'Cleanup', kind: 'cleanup' }]}
      />,
      { state },
    );
    const figure = screen.getByRole('figure');
    expect(figure.textContent).toContain('incl. planned cleanups (P50)');
    expect(figure.textContent).toContain('it goes below zero in Y1 Wk 3');
    const table = openTable(figure);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      'Y1 Wk 1$117,200Actual—',
      'Y1 Wk 2$70,900Forecast—',
      'Y1 Wk 3−$3,000ForecastCleanup',
    ]);
  });

  it('stacked costs, bullets, tornado and stage bars all twin their numbers', () => {
    renderWithStore(
      <>
        <StackedCost
          title="Cash out by category"
          summary="Labor is the largest cost."
          unit="cents"
          categories={[
            { key: 'labor', label: 'Labor' },
            { key: 'fuel', label: 'Fuel' },
          ]}
          columns={[
            { key: 'w1', label: 'Wk 1', values: { labor: 100, fuel: 50 }, explain: { labor: cashRef, fuel: cashRef } },
          ]}
        />
        <Bullet
          title="Production vs plan"
          unit="bcy"
          rows={[
            {
              key: 'c1',
              label: 'Caribou Fork',
              actual: 909,
              target: 1000,
              explainActual: cashRef,
              explainTarget: netWorthRef,
              slot: 0,
            },
          ]}
        />
        <Tornado
          title="Value sensitivity"
          base={100_000}
          baseLabel="P50 value"
          baseExplain={cashRef}
          unit="usd"
          rows={[{ key: 'g', label: 'Grade', low: 40_000, high: 180_000, explainLow: cashRef, explainHigh: cashRef }]}
        />
        <StageBars
          title="Stages"
          summary="Haul limits the plant."
          rows={[
            {
              stage: 'haul',
              label: 'Haul',
              capacity: 3000,
              throughput: 2800,
              utilization: 0.93,
              scheduledHours: 66,
              idle: [{ cause: 'starved', label: 'Starved', hours: 12.7 }],
              bottleneck: true,
              explain: cashRef,
            },
          ]}
        />
      </>,
      { state },
    );
    const figures = screen.getAllByRole('figure');
    expect(figures).toHaveLength(4);
    const counts = figures.map((f) => openTable(f).querySelectorAll('[data-num]').length);
    expect(counts).toEqual([2, 3, 3, 3]);
    expect(within(figures[1] as HTMLElement).getByRole('table').textContent).toContain('on track');
    expect(within(figures[3] as HTMLElement).getByRole('table').textContent).toContain('Starved 12.7 h');
    expect(within(figures[3] as HTMLElement).getByRole('table').textContent).toContain('Bottleneck');
  });

  it('the season strip shows revealed ticks, hatched likely ranges and today, named by its sentence', () => {
    renderWithStore(
      <SeasonStrip
        district="Caribou Fork"
        summary="Operating · wk 6 of ~22 · freeze-up likely wk 42 (40–44) · ~16 wks left (14–18)"
        nowWeek={25}
        segments={[
          { fromWeek: 1, toWeek: 18, phase: 'winter' },
          { fromWeek: 19, toWeek: 19, phase: 'breakup' },
          { fromWeek: 20, toWeek: 41, phase: 'operating' },
        ]}
        boundaries={[
          { kind: 'revealed', week: 20, label: 'Operating start' },
          { kind: 'range', p10Week: 40, p50Week: 42, p90Week: 44, label: 'Freeze-up' },
        ]}
      />,
      { state },
    );
    const img = screen.getByRole('img', { name: /Caribou Fork: Operating · wk 6 of ~22/ });
    expect(img.querySelectorAll('[data-boundary="revealed"]')).toHaveLength(1);
    expect(img.querySelectorAll('[data-boundary="range"]')).toHaveLength(1);
    expect(img.querySelector('[data-now-week="25"]')).not.toBeNull();
    expect(screen.getByText(/Hatched: likely range/)).toBeTruthy();
    // Custom SVG paints only with tokens (13.20).
    for (const el of img.querySelectorAll('[fill], [stroke]')) {
      for (const attr of ['fill', 'stroke']) {
        const v = el.getAttribute(attr);
        if (v !== null)
          expect(v, `${el.tagName} ${attr}`).toMatch(/^(var\(--[a-z0-9-]+\)|url\(#.+\)|none|transparent)$/);
      }
    }
  });

  it('a sparkline is a figure captioned with its range', () => {
    act(() => undefined);
    renderWithStore(
      <Sparkline
        label="Cash"
        unit="cents"
        points={[
          { turn: 0, value: 40_000_000, explain: cashRef },
          { turn: 1, value: 38_000_000, explain: cashRef, forecast: true },
        ]}
      />,
      { state },
    );
    expect(screen.getByRole('figure').textContent).toContain('Cash, Y1 Wk 1 to Y1 Wk 2: from $400,000 to $380,000');
  });
});
