// Source chips on explanation rows (DESIGN §13.13). tuning opens the read-only Tuning viewer; a ledger transaction
// opens the minimal ledger view of its week; entity and rng chips render but link nowhere in P0 (their screens
// arrive with their systems). RNG percentiles appear only for `publicParams` draws (D-13.37), and P0 has none.
import type { TuningKey } from '../../data/tuning';
import { useUi, useUiStore } from '../store/store';
import { findTxn } from './ledger';
import type { CalcSource } from './redact';
import { ledgerRef } from './refs';
import { sourceText } from './textTree';

const CHIP =
  'inline-flex max-w-full items-center truncate rounded-control border border-border-control bg-surface-1 px-1.5 text-12 text-ink-2';

export function SourceChip({ source }: { source: CalcSource }) {
  const store = useUiStore();
  const state = useUi((s) => s.game.state);
  const text = sourceText(source);

  if (source.kind === 'tuning') {
    return (
      <button
        type="button"
        data-chip=""
        className={`${CHIP} cursor-pointer text-link underline`}
        onClick={() => store.getState().pushExplain({ kind: 'tuning', key: source.key as TuningKey })}
      >
        {text}
      </button>
    );
  }
  if (source.kind === 'entity' && source.ref.kind === 'ledgerTxn' && state !== null) {
    const found = findTxn(state, source.ref.id);
    if (found !== null) {
      const { book, txn } = found;
      return (
        <button
          type="button"
          data-chip=""
          className={`${CHIP} cursor-pointer text-link underline`}
          onClick={() => store.getState().pushExplain(ledgerRef({ book, fromTurn: txn.date, toTurn: txn.date }))}
        >
          {text}
        </button>
      );
    }
  }
  return (
    <span data-chip="" className={CHIP} title={text}>
      {text}
    </span>
  );
}
