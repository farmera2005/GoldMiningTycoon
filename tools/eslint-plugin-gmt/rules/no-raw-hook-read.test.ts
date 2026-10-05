import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import plugin from '../index.js';
import { tsRuleTester } from './lib/tester';

const rule = plugin.rules['no-raw-hook-read'];
const hookKeys = ['ops.fuelPriceUsdPerGal', 'fleet.partsLeadWeeks'];
const opts = [{ hookKeys }];

tsRuleTester().run('gmt/no-raw-hook-read', rule, {
  valid: [
    // The sanctioned read (DESIGN §2.10).
    { code: "const fuel = effective(state, 'ops.fuelPriceUsdPerGal', { claimId });", options: opts },
    { code: "const fuel = core.effective(state, 'ops.fuelPriceUsdPerGal' as HookKey, q);", options: opts },
    {
      code: "effectiveValue(base, hookFor('fleet.partsLeadWeeks'), mods, turn, q);",
      options: [{ hookKeys, callees: ['effectiveValue', 'hookFor'] }],
    },
    // Non-hook tuning keys may be read from TuningResolved directly.
    { code: "const keep = tuning['game.history.weeklyKeep'];", options: opts },
    // Naming a key in a type is not a read.
    { code: "type FuelKey = 'ops.fuelPriceUsdPerGal';", options: opts },
    { code: "interface Reads { 'ops.fuelPriceUsdPerGal': number }", options: opts },
    // Strings that merely contain a key are different strings.
    { code: "const label = 'ops.fuelPriceUsdPerGal (per gal)';", options: opts },
    // With no registered hooks (P0) nothing is reported.
    "const fuel = tuning['ops.fuelPriceUsdPerGal'];",
    { code: "const fuel = tuning['ops.fuelPriceUsdPerGal'];", options: [{ hookKeys: [] }] },
  ],
  invalid: [
    {
      code: "const fuel = tuning['ops.fuelPriceUsdPerGal'];",
      options: opts,
      errors: [{ messageId: 'rawRead', data: { key: 'ops.fuelPriceUsdPerGal' }, line: 1, column: 21 }],
    },
    {
      code: "const fuel = ctx.tuning['ops.fuelPriceUsdPerGal'] as number;",
      options: opts,
      errors: [{ messageId: 'rawRead', data: { key: 'ops.fuelPriceUsdPerGal' } }],
    },
    {
      code: 'const weeks = tuning[`fleet.partsLeadWeeks`];',
      options: opts,
      errors: [{ messageId: 'rawRead', data: { key: 'fleet.partsLeadWeeks' } }],
    },
    {
      // Hiding the key in a constant still bypasses effective() where the constant is used.
      code: "const FUEL = 'ops.fuelPriceUsdPerGal'; const fuel = tuning[FUEL];",
      options: opts,
      errors: [{ messageId: 'rawRead', data: { key: 'ops.fuelPriceUsdPerGal' } }],
    },
    {
      code: "const overrides = { 'fleet.partsLeadWeeks': 2 };",
      options: opts,
      errors: [{ messageId: 'rawRead', data: { key: 'fleet.partsLeadWeeks' } }],
    },
    {
      // Only direct arguments of effective() count, not values nested inside them.
      code: "effective(state, key, { modelId: 'fleet.partsLeadWeeks' });",
      options: opts,
      errors: [{ messageId: 'rawRead', data: { key: 'fleet.partsLeadWeeks' } }],
    },
    {
      code: "readTuning(state, 'ops.fuelPriceUsdPerGal');",
      options: opts,
      errors: [{ messageId: 'rawRead', data: { key: 'ops.fuelPriceUsdPerGal' } }],
    },
    {
      // effectiveValue is not in the callee list once the option replaces the default.
      code: "effectiveValue(base, hookFor('fleet.partsLeadWeeks'), mods, turn, q);",
      options: [{ hookKeys, callees: ['effective'] }],
      errors: [{ messageId: 'rawRead', data: { key: 'fleet.partsLeadWeeks' } }],
    },
  ],
});

describe('gmt/no-raw-hook-read through the Linter', () => {
  it('reports every raw occurrence in a file', () => {
    const linter = new Linter({ configType: 'flat' });
    const messages = linter.verify(
      [
        "const a = tuning['ops.fuelPriceUsdPerGal'];",
        "const b = effective(state, 'ops.fuelPriceUsdPerGal', q);",
        "const c = tuning['fleet.partsLeadWeeks'];",
      ].join('\n'),
      [
        {
          files: ['**/*.ts'],
          plugins: { gmt: plugin },
          languageOptions: { parser: tseslint.parser },
          rules: { 'gmt/no-raw-hook-read': ['error', { hookKeys }] },
        },
      ],
      'src/engine/systems/ops/x.ts',
    );
    expect(messages.map((m) => [m.ruleId, m.line])).toEqual([
      ['gmt/no-raw-hook-read', 1],
      ['gmt/no-raw-hook-read', 3],
    ]);
  });
});
