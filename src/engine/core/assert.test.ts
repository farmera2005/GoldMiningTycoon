import { describe, expect, it } from 'vitest';
import { EngineGuardError, assertNever, invariant } from './assert';

describe('assert helpers', () => {
  it('invariant throws with the message, lazily built', () => {
    expect(() => invariant(true, 'never')).not.toThrow();
    expect(() => invariant(0, 'cash went negative')).toThrow('Invariant failed: cash went negative');
    let built = 0;
    invariant(1, () => `${++built}`);
    expect(built).toBe(0);
    expect(() => invariant(null, () => 'lazy')).toThrow('lazy');
  });

  it('assertNever reports the unhandled variant', () => {
    const v = { type: 'mystery' } as never;
    expect(() => assertNever(v)).toThrow(/unexpected variant: \{"type":"mystery"\}/);
  });

  it('EngineGuardError carries a code', () => {
    const e = new EngineGuardError('BLOCKING_DECISION_OPEN');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('BLOCKING_DECISION_OPEN');
    expect(e.message).toBe('BLOCKING_DECISION_OPEN');
    expect(e.name).toBe('EngineGuardError');
    expect(new EngineGuardError('GAME_OVER', 'run ended').message).toBe('run ended');
  });
});
