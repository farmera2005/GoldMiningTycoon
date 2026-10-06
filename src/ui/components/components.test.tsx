// The shared components with their keyboard and focus rules (DESIGN §13.2 chips and ranges, §13.3 tiles, §13.19
// focus and keyboard, §13.20 grain): status and severity chips carry icon and label, tabs follow the ARIA pattern,
// dialogs trap focus and give it back, confirmations start on Cancel, the quick view closes on Esc, the stepper marks
// the current step, meters read their state as words, periods resolve on the engine's calendar.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { select } from '../../engine';
import { cashRef } from '../explain/refs';
import { freshState } from '../testing/harness';
import { renderWithStore } from '../testing/render';
import { EmptyState } from './EmptyState';
import { Meter, meterStatus } from './Meter';
import { ConfirmDialog, Modal } from './Modal';
import { PeriodPicker } from './PeriodPicker';
import { resolvePeriod, type PeriodContext, type PeriodSpec } from './periods';
import { Button } from './primitives';
import { QuickView } from './QuickView';
import { EstimateRange, RangeBar, scalePosition } from './RangeBar';
import { StatTile } from './StatTile';
import { SeverityChip, StatusChip, StatusText } from './StatusChip';
import { Stepper } from './Stepper';
import { RouteTabs, Tabs } from './Tabs';

afterEach(() => {
  cleanup();
});

describe('status and severity chips (13.2: icon + label, never color alone)', () => {
  it('fills status chips with their -on label and an icon', () => {
    render(
      <>
        <StatusChip status="warning" />
        <StatusChip status="critical" label="Overdrawn" />
        <StatusText status="good">on track</StatusText>
      </>,
    );
    const warning = screen.getByText('Warning').closest('[data-status-chip]') as HTMLElement;
    expect(warning.getAttribute('data-status-chip')).toBe('warning');
    expect(warning.className).toContain('text-status-warning-on');
    expect(warning.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Overdrawn').closest('[data-status-chip]')?.className).toContain('bg-status-critical');
    expect(screen.getByText('on track').closest('[data-status-text]')?.querySelector('svg')).not.toBeNull();
  });

  it('shows info as a neutral chip and blocking as critical with its own word', () => {
    render(
      <>
        <SeverityChip severity="info" />
        <SeverityChip severity="blocking" />
      </>,
    );
    const info = screen.getByText('Info').closest('[data-severity]') as HTMLElement;
    expect(info.hasAttribute('data-status-chip')).toBe(false);
    expect(info.className).not.toContain('bg-status');
    const blocking = screen.getByText('Blocking').closest('[data-severity]') as HTMLElement;
    expect(blocking.getAttribute('data-status-chip')).toBe('critical');
  });
});

function TabsDemo() {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  return (
    <Tabs<'a' | 'b' | 'c'>
      label="Demo"
      tabs={[
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'c', label: 'Gamma' },
      ]}
      selected={tab}
      onSelect={setTab}
    >
      <p>Panel {tab}</p>
    </Tabs>
  );
}

describe('tabs (13.1, 13.19)', () => {
  it('route tabs mark the current page', () => {
    render(
      <RouteTabs
        label="Bank tabs"
        tabs={[
          { label: 'Accounts', href: '#/bank/accounts', current: true },
          { label: 'Ledger', href: '#/bank/ledger', current: false },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Bank tabs' });
    expect(within(nav).getByRole('link', { name: 'Accounts' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Ledger' }).hasAttribute('aria-current')).toBe(false);
  });

  it('panel tabs keep one tab stop and move with arrows, Home and End', () => {
    render(<TabsDemo />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    act(() => tabs[0]?.focus());
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel b');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(screen.getByRole('tabpanel', { name: 'Gamma' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Gamma' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('empty state (13.20 grain rules)', () => {
  it('grains only the title band; actions sit on the flat card', () => {
    render(
      <EmptyState title="No claims yet" actions={<Button>Browse the market</Button>}>
        Lease or buy ground to start.
      </EmptyState>,
    );
    const band = document.querySelector('.grain') as HTMLElement;
    expect(band.querySelector('h2')?.textContent).toBe('No claims yet');
    expect(band.querySelector('button, [data-num], table, input')).toBeNull();
    expect(screen.getByRole('button', { name: 'Browse the market' }).closest('.grain')).toBeNull();
  });
});

function ModalDemo({ confirm = false }: { confirm?: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <p data-testid="result">{result}</p>
      {open && !confirm ? (
        <Modal title="Edit" onClose={() => setOpen(false)}>
          <input aria-label="First" />
          <Button>Second</Button>
        </Modal>
      ) : null}
      {open && confirm ? (
        <ConfirmDialog
          title="Delete slot?"
          confirmLabel="Delete"
          onConfirm={() => {
            setResult('deleted');
            setOpen(false);
          }}
          onCancel={() => {
            setResult('cancelled');
            setOpen(false);
          }}
        >
          The slot and its save are removed.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

describe('dialogs (13.19 focus rules, D-13.84)', () => {
  it('moves focus in, keeps Tab inside, closes on Esc and returns focus to the trigger', () => {
    render(<ModalDemo />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Edit' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const first = within(dialog).getByRole('textbox', { name: 'First' });
    expect(document.activeElement).toBe(first);
    const second = within(dialog).getByRole('button', { name: 'Second' });
    act(() => second.focus());
    fireEvent.keyDown(second, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('starts a confirmation on Cancel, the safe choice; Esc cancels', () => {
    render(<ModalDemo confirm />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete slot?' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.getByTestId('result').textContent).toBe('cancelled');
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByTestId('result').textContent).toBe('deleted');
  });
});

describe('quick view (13.2)', () => {
  it('takes focus on its heading, offers the full page and closes on Esc', () => {
    const onClose = vi.fn();
    render(
      <QuickView title="Excavator 30t" onClose={onClose} openHref="#/equipment/fleet/mch_000001">
        <p>Grade B</p>
      </QuickView>,
    );
    const view = screen.getByRole('dialog', { name: 'Excavator 30t' });
    expect(document.activeElement).toBe(within(view).getByRole('heading', { name: 'Excavator 30t' }));
    expect(within(view).getByRole('link', { name: 'Open full page' }).getAttribute('href')).toBe(
      '#/equipment/fleet/mch_000001',
    );
    fireEvent.keyDown(view, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('stepper (13.5 offer stepper, 13.14 wizard)', () => {
  it('marks the current step and lets the player go back to a done one', () => {
    const onSelect = vi.fn();
    render(
      <Stepper
        label="Offer steps"
        current={2}
        onSelect={onSelect}
        steps={[
          { id: 'structure', label: 'Structure' },
          { id: 'terms', label: 'Terms' },
          { id: 'afford', label: 'Affordability', invalid: true },
          { id: 'review', label: 'Review' },
        ]}
      />,
    );
    const items = within(screen.getByRole('navigation', { name: 'Offer steps' })).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('aria-current'))).toEqual([null, null, 'step', null]);
    expect(items[2]?.textContent).toContain('needs attention');
    fireEvent.click(within(items[0] as HTMLElement).getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(within(items[3] as HTMLElement).queryByRole('button')).toBeNull();
  });
});

describe('meters, ranges and tiles (13.2, 13.3, 13.18)', () => {
  it('reads meter status from thresholds, either way round', () => {
    expect(meterStatus(50, 100)).toBeNull();
    expect(meterStatus(90, 100)).toBe('warning');
    expect(meterStatus(100, 100)).toBe('critical');
    expect(meterStatus(1.2, 1, { higherIsBetter: true })).toBeNull();
    expect(meterStatus(0.95, 1, { higherIsBetter: true })).toBe('warning');
    expect(meterStatus(0.5, 1, { higherIsBetter: true })).toBe('critical');
    expect(meterStatus(1, 0)).toBeNull();
  });

  it('renders a meter with role, explained numbers and its state as words', () => {
    renderWithStore(<Meter label="Camp beds" value={9} max={10} unit="count" explain={cashRef} />, {
      state: freshState(),
    });
    const meter = screen.getByRole('meter', { name: 'Camp beds' });
    expect(meter.getAttribute('aria-valuenow')).toBe('9');
    expect(screen.getAllByRole('button').filter((b) => b.hasAttribute('data-num'))).toHaveLength(2);
    expect(screen.getByText('near limit')).toBeTruthy();
  });

  it('shows an estimate as bold P50 with a muted P10–P90, three explainable numbers (13.2)', () => {
    renderWithStore(
      <EstimateRange p10={0.005} p50={0.009} p90={0.016} unit="ozPerBcy" explain={cashRef} label="Grade" />,
      {
        state: freshState(),
      },
    );
    const range = document.querySelector('[data-estimate-range]') as HTMLElement;
    expect(range.textContent).toBe('0.0090 oz/bcy(0.0050 oz/bcy–0.0160 oz/bcy)');
    expect(range.querySelectorAll('[data-num]')).toHaveLength(3);
    expect(scalePosition(5, 0, 10)).toBe(0.5);
    expect(scalePosition(-1, 0, 10)).toBe(0);
    expect(scalePosition(3, 2, 2)).toBe(0.5);
    render(<RangeBar p10={1} p50={2} p90={4} reference={3} />);
    expect(document.querySelector('[data-range-bar]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels a KPI tile as a region with an explainable value and a delta with arrow and sign', () => {
    renderWithStore(
      <StatTile
        label="Cash"
        value={{ value: 41_230_000, unit: 'cents', fmt: { money: 'compact' }, explain: cashRef }}
        delta={{ value: -1_250_000, unit: 'cents', goodDirection: 'up', explain: cashRef }}
      >
        runway ≈ 9 weeks
      </StatTile>,
      { state: freshState() },
    );
    const tile = screen.getByRole('region', { name: 'Cash' });
    const nums = tile.querySelectorAll('[data-num]');
    expect(nums[0]?.textContent).toBe('$412k');
    expect(nums[1]?.textContent).toBe('▼−$12,500');
    expect(nums[1]?.className).toContain('text-status-critical-text');
    expect(tile.textContent).toContain('runway ≈ 9 weeks');
  });
});

describe('report periods (13.11, D-13.18)', () => {
  const state = freshState();
  const ctx = (now: number, seasonStartTurn?: number): PeriodContext => ({
    now,
    dateView: (t) => select.dateView(state, t),
    ...(seasonStartTurn === undefined ? {} : { seasonStartTurn }),
  });

  it('resolves every P1 period on the reporting calendar', () => {
    // Turn 6 is Y1 Wk 7 (Feb 12–18); February's reporting weeks start at Wk 6 (Feb 5–11).
    expect(resolvePeriod({ kind: 'week' }, ctx(6))).toEqual({ fromTurn: 6, toTurn: 6, label: 'Y1 Wk 7' });
    expect(resolvePeriod({ kind: 'last4' }, ctx(6))).toMatchObject({ fromTurn: 3, toTurn: 6 });
    expect(resolvePeriod({ kind: 'last4' }, ctx(1))).toMatchObject({ fromTurn: 0, toTurn: 1 });
    expect(resolvePeriod({ kind: 'mtd' }, ctx(6))).toMatchObject({ fromTurn: 5, toTurn: 6, label: 'Y1 Wk 6–Y1 Wk 7' });
    expect(resolvePeriod({ kind: 'mtd' }, ctx(4))).toMatchObject({ fromTurn: 0, toTurn: 4 });
    expect(resolvePeriod({ kind: 'quarter' }, ctx(30))).toMatchObject({ fromTurn: 26, toTurn: 30 });
    expect(resolvePeriod({ kind: 'ytd' }, ctx(60))).toMatchObject({ fromTurn: 52, toTurn: 60 });
    expect(resolvePeriod({ kind: 'lastYear' }, ctx(60))).toMatchObject({ fromTurn: 0, toTurn: 51 });
    expect(resolvePeriod({ kind: 'lastYear' }, ctx(10))).toBeNull();
    expect(resolvePeriod({ kind: 'season' }, ctx(30))).toBeNull();
    expect(resolvePeriod({ kind: 'season' }, ctx(30, 19))).toMatchObject({ fromTurn: 19, toTurn: 30 });
    expect(resolvePeriod({ kind: 'custom', fromTurn: 2, toTurn: 5 }, ctx(10))).toMatchObject({
      fromTurn: 2,
      toTurn: 5,
    });
    expect(resolvePeriod({ kind: 'custom', fromTurn: 5, toTurn: 2 }, ctx(10))).toBeNull();
    expect(resolvePeriod({ kind: 'custom', fromTurn: 2, toTurn: 11 }, ctx(10))).toBeNull();
  });

  it('picks a period, disables those that do not exist yet, and offers week pickers for Custom', () => {
    function Demo() {
      const [spec, setSpec] = useState<PeriodSpec>({ kind: 'last4' });
      return <PeriodPicker value={spec} onChange={setSpec} ctx={ctx(6)} />;
    }
    render(<Demo />);
    const picker = screen.getByRole('combobox', { name: 'Period' });
    expect((within(picker).getByRole('option', { name: 'Last year' }) as HTMLOptionElement).disabled).toBe(true);
    expect(document.querySelector('[data-period-range]')?.textContent).toBe('Y1 Wk 4–Y1 Wk 7');
    fireEvent.change(picker, { target: { value: 'custom' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'From week' }), { target: { value: '1' } });
    expect(document.querySelector('[data-period-range]')?.textContent).toBe('Y1 Wk 2–Y1 Wk 7');
  });
});
