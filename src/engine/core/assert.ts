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
