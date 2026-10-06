// Settings (DESIGN §13.1 `#/settings`, 13.21 `ui/setPrefs`): Display (theme, density, header grain), Stop rules
// (read-only in P0, from the save's persisted rules), Accessibility (texture, reduced motion, font scale) and, in
// development builds only, the dev reveal. These choices change only comfort, never the game (13.21 trade-offs).
import { useId } from 'react';
import { DevRevealToggle } from '../../app/DevRevealToggle';
import { routeHref } from '../../app/router';
import { Panel, ScreenTitle } from '../../components/primitives';
import { Num } from '../../explain/Num';
import type { Density, FontScale, ReducedMotionPref, ThemePref } from '../../store/prefs';
import { useUi } from '../../store/store';
import { FIXED_STOPS, stopRuleRow, type StopRuleRow } from './stopRuleRows';

interface Option<T> {
  readonly value: T;
  readonly label: string;
  readonly hint: string;
}

const THEME_OPTIONS: readonly Option<ThemePref>[] = [
  {
    value: 'system',
    label: 'System',
    hint: 'Follows your operating system: Daylight when it is light, Lamplight when dark.',
  },
  { value: 'daylight', label: 'Daylight', hint: 'Parchment surfaces, lamp-black ink, slate chrome.' },
  { value: 'lamplight', label: 'Lamplight', hint: 'Warm umber surfaces, parchment ink, near-black chrome.' },
];

const DENSITY_OPTIONS: readonly Option<Density>[] = [
  { value: 'comfortable', label: 'Comfortable', hint: '32 px table rows.' },
  { value: 'compact', label: 'Compact', hint: '26 px table rows.' },
];

const FONT_SCALE_OPTIONS: readonly Option<FontScale>[] = [
  { value: 1, label: '100%', hint: 'The design size.' },
  { value: 1.125, label: '112.5%', hint: 'Larger text.' },
  { value: 1.25, label: '125%', hint: 'Largest text; every screen still fits.' },
];

const MOTION_OPTIONS: readonly Option<ReducedMotionPref>[] = [
  { value: 'system', label: 'Follow the system', hint: 'Uses your operating system’s reduced-motion setting.' },
  { value: 'on', label: 'Reduce motion', hint: 'No animations or transitions.' },
  { value: 'off', label: 'Allow motion', hint: 'Animations even when the system asks for less.' },
];

function RadioGroup<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  const baseId = useId();
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-14 font-semibold text-ink-1">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const id = `${baseId}-${String(opt.value).replace('.', '_')}`;
          return (
            <div key={String(opt.value)} className="flex items-start gap-2">
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

function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="mb-3 flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-accent"
        checked={checked}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <div>
        <label htmlFor={id} className="text-14 text-ink-1">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-13 text-ink-3">
          {hint}
        </p>
      </div>
    </div>
  );
}

function StopRuleTableRow({ row }: { row: StopRuleRow }) {
  return (
    <tr className="border-b border-hairline" style={{ height: 'var(--row-h)' }}>
      <th scope="row" className="px-2 text-left font-normal text-ink-1">
        {row.label}
        {row.param === undefined ? null : (
          <>
            {' '}
            <Num
              value={row.param.value}
              unit={row.param.unit}
              explain={{ kind: 'input', label: row.param.label, route: routeHref({ name: 'settings' }) }}
              label={row.param.label}
            />
          </>
        )}
      </th>
      <td className="px-2 text-ink-2">{row.state}</td>
    </tr>
  );
}

function StopRules() {
  const rules = useUi((s) => s.persisted.stopRules);
  const rows = [...FIXED_STOPS, ...rules.map(stopRuleRow)];
  return (
    <Panel title="Stop rules" id="stop-rules">
      <p className="mb-3 text-13 text-ink-2">
        When Run to Next Decision arrives, it stops on these. They are saved with each game; editing them arrives with
        Run.
      </p>
      <table className="w-full max-w-2xl border-collapse text-13">
        <caption className="sr-only">Stop rules</caption>
        <thead>
          <tr className="border-b border-hairline text-left text-12 text-ink-2">
            <th scope="col" className="px-2 py-1 font-semibold">
              Stop when
            </th>
            <th scope="col" className="px-2 py-1 font-semibold">
              Setting
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StopRuleTableRow key={row.label} row={row} />
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function SettingsScreen() {
  const prefs = useUi((s) => s.prefs);
  const persisted = useUi((s) => s.prefsPersisted);
  const setPrefs = useUi((s) => s.setPrefs);

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
        <Checkbox
          label="Header grain"
          hint="A faint paper grain on the navigation and screen titles, never behind data. Always off in high-contrast and forced-color modes and in print."
          checked={prefs.headerGrain}
          onChange={(headerGrain) => setPrefs({ headerGrain })}
        />
        {persisted ? null : (
          <p role="status" className="mt-4 text-13 text-ink-2">
            This browser blocked storage, so these settings last only until the tab is closed.
          </p>
        )}
      </Panel>
      <StopRules />
      <Panel title="Accessibility" id="accessibility">
        <Checkbox
          label="Texture patterns"
          hint="Adds line patterns to status chips, heat maps and stacked bars, so no state depends on color alone."
          checked={prefs.texture}
          onChange={(texture) => setPrefs({ texture })}
        />
        <RadioGroup
          legend="Motion"
          name="reducedMotion"
          value={prefs.reducedMotion}
          options={MOTION_OPTIONS}
          onChange={(reducedMotion) => setPrefs({ reducedMotion })}
        />
        <RadioGroup
          legend="Text size"
          name="fontScale"
          value={prefs.fontScale}
          options={FONT_SCALE_OPTIONS}
          onChange={(fontScale) => setPrefs({ fontScale })}
        />
      </Panel>
      {import.meta.env.DEV ? (
        <Panel title="Developer" id="developer">
          <DevRevealToggle />
        </Panel>
      ) : null}
    </div>
  );
}
