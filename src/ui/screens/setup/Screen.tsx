// New-game wizard stub (DESIGN §13.24 P0: name + seed; §13.14 has the full eight steps for P1). Submitting calls the
// injected callback; the app owns what a new game is.
import { useId, useState, type FormEvent } from 'react';
import type { NewGameInput } from '../../app/shellModel';
import { CriticalIcon } from '../../components/icons';
import { Button, ScreenTitle } from '../../components/primitives';
import {
  COMPANY_NAME_MAX,
  fieldErrorText,
  randomSeed,
  validateNewGame,
  type NewGameDraft,
  type NewGameFieldError,
} from './newGameForm';

export function NewGameScreen({ onNewGame }: { onNewGame: (input: NewGameInput) => void }) {
  const [draft, setDraft] = useState<NewGameDraft>(() => ({ companyName: '', seed: String(randomSeed()) }));
  const [errors, setErrors] = useState<Partial<Record<keyof NewGameDraft, NewGameFieldError>>>({});
  const nameId = useId();
  const seedId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateNewGame(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onNewGame(result.input);
  };

  return (
    <div>
      <ScreenTitle
        title="New game"
        zone="wizard-header"
        subtitle="Name your company and pick a world seed. The full setup (region, entity, background and start) arrives with the core loop."
      />

      <form className="max-w-xl rounded-card border border-hairline bg-surface-1 p-4" onSubmit={submit} noValidate>
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor={nameId} className="text-14 font-semibold text-ink-1">
            Company name
          </label>
          <input
            id={nameId}
            className="h-9 rounded-control border border-border-control bg-surface-2 px-2 text-14 text-ink-1"
            value={draft.companyName}
            maxLength={COMPANY_NAME_MAX + 20}
            autoComplete="off"
            aria-invalid={errors.companyName !== undefined}
            aria-describedby={errors.companyName === undefined ? undefined : `${nameId}-error`}
            onChange={(e) => setDraft({ ...draft, companyName: e.currentTarget.value })}
          />
          {errors.companyName === undefined ? null : (
            <p id={`${nameId}-error`} className="flex items-center gap-1 text-13 text-status-critical-text">
              <CriticalIcon />
              {fieldErrorText(errors.companyName)}
            </p>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor={seedId} className="text-14 font-semibold text-ink-1">
            World seed
          </label>
          <div className="flex items-center gap-2">
            <input
              id={seedId}
              className="h-9 w-56 rounded-control border border-border-control bg-surface-2 px-2 text-14 text-ink-1"
              data-code=""
              inputMode="numeric"
              autoComplete="off"
              value={draft.seed}
              aria-invalid={errors.seed !== undefined}
              aria-describedby={`${seedId}-hint${errors.seed === undefined ? '' : ` ${seedId}-error`}`}
              onChange={(e) => setDraft({ ...draft, seed: e.currentTarget.value })}
            />
            <Button onClick={() => setDraft({ ...draft, seed: String(randomSeed()) })}>New seed</Button>
          </div>
          <p id={`${seedId}-hint`} className="text-13 text-ink-3">
            The same seed and the same decisions always play out the same way.
          </p>
          {errors.seed === undefined ? null : (
            <p id={`${seedId}-error`} className="flex items-center gap-1 text-13 text-status-critical-text">
              <CriticalIcon />
              {fieldErrorText(errors.seed)}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary">
          Start game
        </Button>
      </form>
    </div>
  );
}
