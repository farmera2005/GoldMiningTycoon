// Assertions shared by every engine module. An engine invariant failing is a bug, never a game outcome, so these
// throw instead of returning error codes (validators return typed codes; DESIGN §2.2 "Validation is total").

/** Thrown when an engine entry point is called in a state that forbids it (e.g. advanceWeek with canAdvance ≠ null). */
export class EngineGuardError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'EngineGuardError';
    this.code = code;
  }
}

/** Exhaustiveness check for discriminated unions: reaching it means a variant was not handled. */
export function assertNever(value: never, context = 'unexpected variant'): never {
  throw new Error(`${context}: ${JSON.stringify(value)}`);
}

/** Throws when `cond` is false. Use for internal invariants that indicate a bug, not for player-facing validation. */
export function invariant(cond: unknown, message: string | (() => string)): asserts cond {
  if (!cond) {
    throw new Error(`Invariant failed: ${typeof message === 'function' ? message() : message}`);
  }
}

/**
 * Thrown by a Wave-0 creation stub (P1 contract §0.2): a function whose contract returns a new id or a generated record
 * cannot have a neutral body, so until its owning package lands it fails loudly. `id` names the stub
 * (`<folder>.<function>`), which the stub allowlist lists.
 */
export class ContractStubError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`${id} is a contract stub: its owning package has not implemented it yet`);
    this.name = 'ContractStubError';
    this.id = id;
  }
}
