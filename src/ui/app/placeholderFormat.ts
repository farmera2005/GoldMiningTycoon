// PLACEHOLDER display helpers for the P0 shell's own tables (Saves) until `ui/format` lands. DESIGN §13.2 owns the
// rules and ui/format will implement them with T1's tests; replace every import of this file with ui/format then.
// Locale is fixed to en-US (D-13.12) and negatives use a true minus sign, as 13.2 requires.

const usd = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const wallClock = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const placeholderFormat = {
  /** Whole dollars from cents: `$1,234,568`, `−$45,123`. */
  usdFromCents(cents: number): string {
    const dollars = Math.round(Math.abs(cents) / 100);
    return `${cents < 0 && dollars !== 0 ? '\u2212' : ''}$${usd.format(dollars)}`;
  },
  /** `Y1 Wk 21`. */
  gameWeek(year: number, week: number): string {
    return `Y${year} Wk ${week}`;
  },
  /** Storage size in kB, one decimal below 10 kB. */
  kilobytes(bytes: number): string {
    const kb = bytes / 1000;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb).toLocaleString('en-US')} kB`;
  },
  /** The local wall clock of an ISO timestamp, or the raw text if it does not parse. */
  wallClock(iso: string): string {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? iso : wallClock.format(new Date(t));
  },
};
