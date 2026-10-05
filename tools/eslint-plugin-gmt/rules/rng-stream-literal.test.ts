import plugin from '../index.js';
import { tsRuleTester } from './lib/tester';

const rule = plugin.rules['rng-stream-literal'];
const streams = ['weather', 'fleet-fail', 'world'];

tsRuleTester().run('gmt/rng-stream-literal', rule, {
  valid: [
    // The §2.3 examples: a literal stream, then key parts of any form.
    "import { rng } from '../core/rng'; rng(state.meta.seed, 'weather', state.clock.turn, districtId);",
    "import { rng } from '../core/rng'; rng(seed, 'fleet-fail', turn, machineId).next();",
    // A namespace import is still a call to rng.
    "import * as core from '../core'; core.rng(seed, 'world', claimId);",
    // Aliased import: the alias is checked under the original name.
    "import { rng as draw } from '../core/rng'; draw(seed, 'world', claimId);",
    // Re-exports and type queries do not move the function anywhere.
    "export { rng } from './rng';",
    "import { rng } from './rng'; export { rng };",
    "import { rng } from './rng'; type Draw = typeof rng;",
    // Registered names pass the registration check.
    { code: "rng(seed, 'fleet-fail', turn, machineId);", options: [{ streams }] },
    // Without the option only literal-ness is checked.
    "rng(seed, 'anything-goes-here');",
    // Methods on an Rng object are not rng() calls.
    'function roll(rng: Rng) { return rng.next() + rng.int(0, 5); }',
    // Other functions taking a stream-like argument are out of scope unless configured.
    'streamState(seed, name, turn);',
    // Spreading the key parts after the stream is fine.
    "rng(seed, 'world', ...keys);",
  ],
  invalid: [
    {
      code: 'rng(seed, stream, turn);',
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' }, line: 1, column: 11 }],
    },
    {
      code: "const s = 'weather'; rng(seed, s, turn);",
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      // Computed names defeat the registry test.
      code: "rng(seed, 'fleet-' + kind, turn);",
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      code: "rng(seed, cond ? 'weather' : 'world', turn);",
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      code: "rng(seed, STREAM_NAMES['weather'], turn);",
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      // A cast hides the literal from a plain-literal scan; write the literal.
      code: "rng(seed, 'weather' as StreamName, turn);",
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      code: 'rng(seed, 42, turn);',
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      code: 'rng(seed, `fleet-${kind}`, turn);',
      errors: [{ messageId: 'template', data: { callee: 'rng' } }],
    },
    {
      // Even a template without substitutions: the registry scan reads plain literals only.
      code: 'rng(seed, `weather`, turn);',
      errors: [{ messageId: 'template', data: { callee: 'rng' } }],
    },
    {
      code: 'rng(seed);',
      errors: [{ messageId: 'missing', data: { callee: 'rng', position: 'second' } }],
    },
    {
      code: 'rng(...args);',
      errors: [{ messageId: 'spread', data: { callee: 'rng' } }],
    },
    {
      code: 'rng(seed, ...rest);',
      errors: [{ messageId: 'spread', data: { callee: 'rng' } }],
    },
    {
      code: 'core.rng(seed, name);',
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      code: "import { rng as draw } from '../core/rng'; draw(seed, name);",
      errors: [{ messageId: 'notLiteral', data: { callee: 'rng' } }],
    },
    {
      code: "rng(seed, 'nope', turn);",
      options: [{ streams }],
      errors: [{ messageId: 'unregistered', data: { value: 'nope' } }],
    },
    {
      // Passing rng around lets a caller pick the stream where no check can see it.
      code: "import { rng } from '../core/rng'; const draw = rng; draw(seed, 'weather');",
      errors: [{ messageId: 'indirect', data: { callee: 'rng' }, column: 49 }],
    },
    {
      code: "import { rng } from '../core/rng'; export const f = [1].map(() => apply(rng));",
      errors: [{ messageId: 'indirect', data: { callee: 'rng' } }],
    },
    {
      // The callee list is configurable.
      code: 'streamState(seed, name, turn);',
      options: [{ callees: ['rng', 'streamState'] }],
      errors: [{ messageId: 'notLiteral', data: { callee: 'streamState' } }],
    },
  ],
});
