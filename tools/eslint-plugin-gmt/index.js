// Local ESLint rules for the engine's determinism and registry contracts (DESIGN §2.3, §2.4, §2.10; CLAUDE.md).
// Rules live in tools/eslint-plugin-gmt/rules/ and are registered here; eslint.config.js enables them for the engine
// and data layers and fills their registry options from registry.js.
import idPrefixLiteral from './rules/id-prefix-literal.js';
import noRawHookRead from './rules/no-raw-hook-read.js';
import rngStreamLiteral from './rules/rng-stream-literal.js';

export default {
  meta: { name: 'eslint-plugin-gmt', version: '0.1.0' },
  rules: {
    'rng-stream-literal': rngStreamLiteral,
    'id-prefix-literal': idPrefixLiteral,
    'no-raw-hook-read': noRawHookRead,
  },
};
