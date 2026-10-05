// Settings (DESIGN §13.1 `#/settings`, 13.21 `ui/setPrefs`). P0 has the Display tab: theme (System / Daylight /
// Lamplight), density and header grain. Stop rules, alerts, tutorial and accessibility tabs arrive with their systems.
// These choices change only comfort, never the game (13.21 trade-offs).
import { useId } from 'react';
import { DevRevealToggle } from '../../app/DevRevealToggle';
import { Panel, ScreenTitle } from '../../components/primitives';
import type { Density, ThemePref } from '../../store/prefs';
import { useUi } from '../../store/store';

const THEME_OPTIONS: readonly { value: ThemePref; label: string; hint: string }[] = [
  {
    value: 'system',
    label: 'System',
    hint: 'Follows your operating system: Daylight when it is light, Lamplight when dark.',
  },
  { value: 'daylight', label: 'Daylight', hint: 'Parchment surfaces, lamp-black ink, slate chrome.' },
  { value: 'lamplight', label: 'Lamplight', hint: 'Warm umber surfaces, parchment ink, near-black chrome.' },
];

const DENSITY_OPTIONS: readonly { value: Density; label: string; hint: string }[] = [
  { value: 'comfortable', label: 'Comfortable', hint: '32 px table rows.' },
  { value: 'compact', label: 'Compact', hint: '26 px table rows.' },
];

function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string; hint: string }[];
  onChange: (value: T) => void;
}) {
  const baseId = useId();
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-14 font-semibold text-ink-1">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const id = `${baseId}-${opt.value}`;
          return (
            <div key={opt.value} className="flex items-start gap-2">
              <input
                id={id}
                type="radio"
                name={name}
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={value === opt.value}
                aria-describedby={`${id}-hint`}
                onChange={() => onChange(opt.value)}
              />
              <div>
                <label htmlFor={id} className="text-14 text-ink-1">
                  {opt.label}
                </label>
                <p id={`${id}-hint`} className="text-13 text-ink-3">
                  {opt.hint}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SettingsScreen() {
  const prefs = useUi((s) => s.prefs);
  const persisted = useUi((s) => s.prefsPersisted);
  const setPrefs = useUi((s) => s.setPrefs);
  const grainId = useId();

  return (
    <div>
      <ScreenTitle title="Settings" />
      <Panel title="Display" id="display">
        <RadioGroup
          legend="Theme"
          name="theme"
          value={prefs.theme}
          options={THEME_OPTIONS}
          onChange={(theme) => setPrefs({ theme })}
        />
        <RadioGroup
          legend="Density"
          name="density"
          value={prefs.density}
          options={DENSITY_OPTIONS}
          onChange={(density) => setPrefs({ density })}
        />
        <div className="flex items-start gap-2">
          <input
            id={grainId}
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-accent"
            checked={prefs.headerGrain}
            aria-describedby={`${grainId}-hint`}
            onChange={(e) => setPrefs({ headerGrain: e.currentTarget.checked })}
          />
          <div>
            <label htmlFor={grainId} className="text-14 text-ink-1">
              Header grain
            </label>
            <p id={`${grainId}-hint`} className="text-13 text-ink-3">
              A faint paper grain on the navigation and screen titles, never behind data. Always off in high-contrast
              and forced-color modes and in print.
            </p>
          </div>
        </div>
        {persisted ? null : (
          <p role="status" className="mt-4 text-13 text-ink-2">
            This browser blocked storage, so these settings last only until the tab is closed.
          </p>
        )}
      </Panel>
      {import.meta.env.DEV ? (
        <Panel title="Developer" id="developer">
          <DevRevealToggle />
        </Panel>
      ) : null}
    </div>
  );
}
