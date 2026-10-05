// Exhaustiveness guard for discriminated unions (CLAUDE.md coding conventions).
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
