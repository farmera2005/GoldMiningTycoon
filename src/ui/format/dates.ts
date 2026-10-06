// Dates (DESIGN §13.2 dates row, §1 1.3): game week first, calendar dates for orientation, ranges with an en dash.
// The calendar itself is the engine's: every label is built from `select.dateView`, never re-derived here.
import type { DateView } from '../../engine';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `Jan`…`Dec` for a 1-based month; never locale-dependent. */
export function monthAbbr(month: number): string {
  return MONTHS[month - 1] ?? '???';
}

/** `Jul 16–22` within a month, `Aug 27–Sep 2` across two. */
export function dayRange(view: Pick<DateView, 'start' | 'end'>): string {
  const { start, end } = view;
  const from = `${monthAbbr(start.month)} ${start.day}`;
  return start.month === end.month ? `${from}–${end.day}` : `${from}–${monthAbbr(end.month)} ${end.day}`;
}

/** `Y1 Wk 21`: a week without calendar dates (save summaries, explain notes). */
export function yearWeek(year: number, week: number): string {
  return `Y${year} Wk ${week}`;
}

/** The full 13.2 date: `Y1 Wk 29 · Jul 16–22, 2027`. */
export function gameDate(view: DateView): string {
  return `${yearWeek(view.year, view.week)} · ${dayRange(view)}, ${view.displayYear}`;
}

/**
 * The Advance tooltip's short form (13.1): `Wk 22 · May 28–Jun 3`. When the target week is in another game year than
 * `relativeTo`, the year is spelled out (`Y2 Wk 1 · Jan 1–7, 2028`) so the tooltip is never ambiguous.
 */
export function weekShort(view: DateView, relativeTo?: Pick<DateView, 'year'>): string {
  if (relativeTo !== undefined && relativeTo.year !== view.year) return gameDate(view);
  return `Wk ${view.week} · ${dayRange(view)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * A save's wall-clock time in the player's time zone, in the fixed en-US form `Oct 6, 2026, 3:04 PM`. Built from the
 * Date's local fields, not Intl, so the browser locale cannot change it. Unparseable text is shown as it is.
 */
export function wallClock(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${monthAbbr(d.getMonth() + 1)} ${d.getDate()}, ${d.getFullYear()}, ${h12}:${pad2(d.getMinutes())} ${ampm}`;
}
