// RuleTester wired to Vitest and the TypeScript parser, so rule tests cover the syntax the engine is written in
// (`as const`, `satisfies`, type-only positions).
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export function tsRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: 'module' },
  });
}
