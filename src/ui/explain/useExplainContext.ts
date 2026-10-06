// What every explain view resolves refs against: the loaded state, the retained calc weeks, and whether the dev
// reveal is on (only possible in development builds, D-13.41).
import { useMemo } from 'react';
import { select } from '../../engine';
import type { FormatContext } from '../format';
import { useUi } from '../store/store';
import type { ResolveContext } from './resolve';

export function useExplainContext(): ResolveContext & { readonly format: FormatContext } {
  const state = useUi((s) => s.game.state);
  const calcReports = useUi((s) => s.game.calcReports);
  const devReveal = useUi((s) => s.devReveal);
  return useMemo(
    () => ({
      state,
      calcReports,
      reveal: import.meta.env.DEV && devReveal,
      format: state === null ? {} : { dateView: (t: number) => select.dateView(state, t) },
    }),
    [state, calcReports, devReveal],
  );
}
