// ESLint flat config. Engine purity and determinism rules follow DESIGN §2.1/§2.3 and CLAUDE.md.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import gmt from './tools/eslint-plugin-gmt/index.js';
import { loadRegistries } from './tools/eslint-plugin-gmt/registry.js';

// The live stream, id-prefix and hook registries (evaluated from their TypeScript sources) feed the gmt rule options.
const registries = await loadRegistries();

const TRANSCENDENTAL = ['exp', 'log', 'pow', 'sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'sinh', 'cosh', 'tanh',
  'asinh', 'acosh', 'atanh', 'log2', 'log10', 'log1p', 'expm1', 'cbrt', 'hypot', 'random'];

const engineBannedGlobals = ['window', 'document', 'indexedDB', 'fetch', 'Date', 'performance', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'process', 'Intl', 'localStorage', 'sessionStorage', 'navigator', 'crypto', 'require']
  .map((name) => ({ name, message: `Not allowed in the engine (DESIGN §2.1, §2.3): ${name}.` }));

export default tseslint.config(
  {
    ignores: ['.claude/**', 'dist/**', 'out/**', 'node_modules/**', 'docs/**', 'coverage/**', 'test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { gmt },
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Engine and data: pure, deterministic, no browser or Node APIs.
  {
    files: ['src/engine/**/*.ts', 'src/data/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.perf.test.ts'],
    rules: {
      'no-restricted-globals': ['error', ...engineBannedGlobals],
      'no-restricted-properties': ['error',
        ...TRANSCENDENTAL.map((property) => ({ object: 'Math', property,
          message: `Math.${property} is banned in the engine; use engine/core/dmath.ts (DESIGN §2.3).` })),
      ],
      'no-restricted-syntax': ['error',
        { selector: 'ForInStatement', message: 'for…in is banned in the engine; iterate Records with engine/core/iter.ts.' },
        { selector: "CallExpression[callee.property.name='localeCompare']", message: 'localeCompare is locale-dependent; use compareIds or code-unit order.' },
        { selector: "CallExpression[callee.property.name=/^toLocale/]", message: 'toLocale* is locale-dependent and banned in the engine.' },
        { selector: "NewExpression[callee.name=/^(Map|Set|WeakRef)$/]", message: 'Map/Set iteration order is insertion order; use Records and engine/core/iter.ts (memo.ts is exempt).' },
      ],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/ui/**', '**/persistence/**', '**/sim/**', '**/tests/**'], message: 'The engine may import only engine/ and data/ (DESIGN §2.1).' },
          { group: ['react', 'react-dom', 'react/*', 'zustand', 'recharts', 'idb-keyval', 'node:*', 'fs', 'path', 'os', 'worker_threads', 'crypto'], message: 'No UI, browser or Node dependencies in the engine (DESIGN §2.1).' },
        ],
      }],
    },
  },
  // Raw Object.keys/values/entries are banned in the engine outside the iteration helpers.
  {
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/core/iter.ts', '**/*.test.ts', '**/*.perf.test.ts'],
    rules: {
      'no-restricted-properties': ['error',
        ...TRANSCENDENTAL.map((property) => ({ object: 'Math', property,
          message: `Math.${property} is banned in the engine; use engine/core/dmath.ts (DESIGN §2.3).` })),
        ...['keys', 'values', 'entries'].map((property) => ({ object: 'Object', property,
          message: `Object.${property} iterates in insertion order; use sortedKeys/sortedValues/sortedEntries from engine/core/iter.ts.` })),
      ],
    },
  },
  // memo.ts may use Map/WeakMap for module-scope caches (DESIGN §2.3 item 6).
  {
    files: ['src/engine/core/memo.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // Registry contracts: stream names and id prefixes are registered literals (DESIGN §2.3, §2.4) and hook keys are read
  // only through effective() (§2.10). tests/architecture/registries.test.ts checks the owners.
  {
    files: ['src/engine/**/*.ts', 'src/data/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.perf.test.ts'],
    rules: {
      'gmt/rng-stream-literal': ['error', { streams: registries.streams }],
      'gmt/id-prefix-literal': ['error', { prefixes: registries.idPrefixes }],
      'gmt/no-raw-hook-read': ['error', { hookKeys: registries.hookKeys }],
    },
  },
  // These files name hook keys by design: the registry itself, event and preparation effects (§12 12.3), tuning and
  // difficulty tables, and scenario tuning overrides (§2.10 resolution order).
  {
    files: [
      'src/data/events/**/*.ts',
      'src/data/tuning/**/*.ts',
      'src/data/difficulty.ts',
      'src/data/scenarios/**/*.ts',
    ],
    rules: { 'gmt/no-raw-hook-read': 'off' },
  },
  // data/ may import only data/ and engine types.
  {
    files: ['src/data/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // UI: browser globals and React hooks rules.
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/persistence/**/*.{ts,tsx}', 'src/main.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/sim/**', '**/tests/**'], message: 'The UI must not import the simulator or tests.' }],
      }],
    },
  },
  // Node-side code: simulator, tests, tools, configs.
  {
    files: ['sim/**/*.ts', 'tests/**/*.ts', 'tools/**/*.{ts,js}', '*.config.{ts,js}', '**/*.test.{ts,tsx}', '**/*.perf.test.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
