// "Compare with last week" in the drawer (DESIGN §13.13): the report ref's node this week and last, child by child,
// with Δ and the largest changes highlighted. Values inside an explanation view are formatted text with tabular
// figures, not <Num>s (13.13). A delta's direction is shown by arrow and sign (13.2); the explanation tree carries no
// goodDirection, so deltas stay in the primary ink.
import type { ExplainRef } from '../../engine';
import { formatValue } from '../format';
import { compareWithLastWeek, type ChildChange } from './compare';
import { useExplainContext } from './useExplainContext';

function deltaText(change: Pick<ChildChange, 'delta' | 'unit'>, format: Parameters<typeof formatValue>[3]): string {
  if (change.delta === null) return '—';
  if (change.delta === 0) return 'no change';
  const arrow = change.delta > 0 ? '▲' : '▼';
  return `${arrow} ${formatValue(change.delta, change.unit, { delta: true }, format)}`;
}

export function CompareView({ explainRef }: { explainRef: ExplainRef }) {
  const ctx = useExplainContext();
  const cmp = compareWithLastWeek(explainRef, ctx.calcReports, { reveal: ctx.reveal });
  if (cmp === null) return null;
  const show = (v: number | null, unit: ChildChange['unit']): string =>
    v === null ? '—' : formatValue(v, unit, {}, ctx.format);
  if (cmp.before === null) {
    return (
      <p className="mt-3 text-13 text-ink-2" data-explain-compare="">
        Last week’s breakdown is not kept, so there is nothing to compare with.
      </p>
    );
  }
  return (
    <table className="mt-3 w-full border-collapse text-12" data-explain-compare="">
      <caption className="pb-1 text-left text-13 font-semibold text-ink-1">Compared with last week</caption>
      <thead>
        <tr className="border-b border-hairline text-ink-2">
          <th scope="col" className="py-1 text-left font-medium">
            Item
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            This week
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Last week
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Change
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-hairline font-semibold">
          <th scope="row" className="py-1 text-left">
            {cmp.now.label}
          </th>
          <td className="py-1 text-right">{show(cmp.now.value, cmp.now.unit)}</td>
          <td className="py-1 text-right">{show(cmp.before.value, cmp.before.unit)}</td>
          <td className="py-1 text-right">{deltaText({ delta: cmp.delta, unit: cmp.now.unit }, ctx.format)}</td>
        </tr>
        {cmp.children.map((c) => (
          <tr
            key={c.label}
            className={`border-b border-hairline ${c.highlight ? 'bg-surface-1 font-semibold' : ''}`}
            data-changed-most={c.highlight ? '' : undefined}
          >
            <th scope="row" className="py-1 text-left font-normal">
              {c.label}
              {c.highlight ? <span className="sr-only"> (changed most)</span> : null}
            </th>
            <td className="py-1 text-right">{show(c.now, c.unit)}</td>
            <td className="py-1 text-right">{show(c.before, c.unit)}</td>
            <td className="py-1 text-right">{deltaText(c, ctx.format)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
