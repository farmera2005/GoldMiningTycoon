// The minimal read-only Tuning viewer (DESIGN §13.13 tuning chips; Help > Tuning viewer in P1): a key, the value
// this game resolved (it keeps the tuning it was created with, §2.10) and the base default. Difficulty and scenario
// columns and the visible EffectModifiers join with P1's hooks and §12's events.
import type { TuningValue } from '../../data/tuning';
import { trimmed } from '../format';

function show(value: TuningValue | undefined): string {
  if (value === undefined) return 'not set';
  if (typeof value === 'number') return trimmed(value, 6);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}

export function TuningViewer({
  tuningKey,
  resolved,
  base,
}: {
  tuningKey: string;
  resolved: TuningValue | undefined;
  base: TuningValue | undefined;
}) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-13" data-tuning-viewer="">
      <dt className="text-ink-2">Key</dt>
      <dd className="break-all text-ink-1" data-code="">
        {tuningKey}
      </dd>
      <dt className="text-ink-2">This game</dt>
      <dd className="break-all font-semibold tabular-nums lining-nums text-ink-1">{show(resolved)}</dd>
      <dt className="text-ink-2">Base default</dt>
      <dd className="break-all tabular-nums lining-nums text-ink-1">{show(base)}</dd>
    </dl>
  );
}
