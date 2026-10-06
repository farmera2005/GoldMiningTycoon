// New-game wizard stub (`#/new`, DESIGN §13.24 P0: company name + seed; §13.14 has the full eight steps for P1).
// Start builds the P0 setup, calls the engine's newGame through the client, writes the first autosave and goes to
// the dashboard.
import { useId, useState, type FormEvent } from 'react';
import { NAME_MAX_LENGTH } from '../../../engine';
import { navigate } from '../../app/router';
import { useServices } from '../../app/services';
import { CriticalIcon } from '../../components/icons';
import { Button, ScreenTitle } from '../../components/primitives';
import {
  SEED_MAX_LENGTH,
  fieldErrorText,
  randomSeed,
  validateNewGame,
  type NewGameDraft,
  type NewGameErrors,
} from './newGameForm';

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="flex items-center gap-1 text-13 text-status-critical-text">
      <CriticalIcon />
      {text}
    </p>
  );
}

export function NewGameScreen() {
  const { client } = useServices();
  const [draft, setDraft] = useState<NewGameDraft>(() => ({ companyName: '', seed: randomSeed() }));
  const [errors, setErrors] = useState<NewGameErrors>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const seedId = useId();

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const result = validateNewGame(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    setStatus('Generating the world…');
    // Yield once so the busy state paints before world generation runs on this thread.
    setTimeout(() => {
      let started: ReturnType<typeof client.newGame>;
      try {
        started = client.newGame(result.input);
      } catch (err) {
        setBusy(false);
        setStatus(`The world could not be generated: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      setBusy(false);
      if (started.ok) {
        setStatus('');
        navigate({ name: 'dashboard' });
      } else {
        const issue = started.issues.find((i) => i.field === 'companyName') ?? started.issues[0];
        setStatus(issue === undefined ? '' : fieldErrorText(issue.code));
      }
    }, 0);
  };

  const copySeed = (): void => {
    const seed = draft.seed;
    const done = (ok: boolean): void => setStatus(ok ? 'Seed copied.' : 'This browser blocked the clipboard.');
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      done(false);
      return;
    }
    navigator.clipboard.writeText(seed).then(
      () => done(true),
      () => done(false),
    );
  };

  const nameError = errors.companyName === undefined ? null : fieldErrorText(errors.companyName);
  const seedError = errors.seed === undefined ? null : fieldErrorText(errors.seed);

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
            maxLength={NAME_MAX_LENGTH + 20}
            autoComplete="off"
            aria-invalid={nameError !== null}
            aria-describedby={`${nameId}-hint${nameError === null ? '' : ` ${nameId}-error`}`}
            onChange={(e) => setDraft({ ...draft, companyName: e.currentTarget.value })}
          />
          <p id={`${nameId}-hint`} className="text-13 text-ink-3">
            1 to {NAME_MAX_LENGTH} characters.
          </p>
          {nameError === null ? null : <FieldError id={`${nameId}-error`} text={nameError} />}
        </div>

        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor={seedId} className="text-14 font-semibold text-ink-1">
            World seed
          </label>
          <div className="flex items-center gap-2">
            <input
              id={seedId}
              className="h-9 w-80 rounded-control border border-border-control bg-surface-2 px-2 text-14 text-ink-1"
              data-code=""
              autoComplete="off"
              spellCheck={false}
              maxLength={SEED_MAX_LENGTH + 20}
              value={draft.seed}
              aria-invalid={seedError !== null}
              aria-describedby={`${seedId}-hint${seedError === null ? '' : ` ${seedId}-error`}`}
              onChange={(e) => setDraft({ ...draft, seed: e.currentTarget.value })}
            />
            <Button onClick={copySeed}>Copy</Button>
            <Button onClick={() => setDraft({ ...draft, seed: randomSeed() })}>New seed</Button>
          </div>
          <p id={`${seedId}-hint`} className="text-13 text-ink-3">
            The same seed and the same decisions always play out the same way.
          </p>
          {seedError === null ? null : <FieldError id={`${seedId}-error`} text={seedError} />}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            Start game
          </Button>
          <p role="status" className="text-13 text-ink-2">
            {status}
          </p>
        </div>
      </form>
    </div>
  );
}
