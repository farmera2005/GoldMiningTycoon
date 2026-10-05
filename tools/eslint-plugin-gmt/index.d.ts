// Type declarations for the plain-JS plugin, so TypeScript tests can import it.
import type { ESLint, Rule } from 'eslint';

export type GmtRuleName = 'rng-stream-literal' | 'id-prefix-literal' | 'no-raw-hook-read';

declare const plugin: ESLint.Plugin & { rules: Record<GmtRuleName, Rule.RuleModule> };
export default plugin;
