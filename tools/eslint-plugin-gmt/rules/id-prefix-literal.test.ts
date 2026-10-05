import plugin from '../index.js';
import { tsRuleTester } from './lib/tester';

const rule = plugin.rules['id-prefix-literal'];
const prefixes = ['clm', 'lst', 'mch'];

tsRuleTester().run('gmt/id-prefix-literal', rule, {
  valid: [
    "import { nextId } from '../core/ids'; const id = nextId(draft.ids, 'clm');",
    "nextId(counters, 'lst') as ClaimListingId;",
    "import * as ids from '../core/ids'; ids.nextId(draft.ids, 'mch');",
    "import { nextId as mint } from '../core/ids'; mint(draft.ids, 'mch');",
    { code: "nextId(draft.ids, 'mch');", options: [{ prefixes }] },
    // Formatting or parsing an id is not minting one.
    'formatId(prefix, n); parseId(id);',
    "import { nextId } from './ids'; export { nextId };",
  ],
  invalid: [
    {
      code: 'nextId(draft.ids, prefix);',
      errors: [{ messageId: 'notLiteral', data: { callee: 'nextId' }, line: 1, column: 19 }],
    },
    {
      // A generic minting helper would hide which section mints which prefix.
      code: 'function mint<P extends IdPrefix>(c: Counters, p: P) { return nextId(c, p); }',
      errors: [{ messageId: 'notLiteral', data: { callee: 'nextId' } }],
    },
    {
      code: 'nextId(draft.ids, `clm`);',
      errors: [{ messageId: 'template', data: { callee: 'nextId' } }],
    },
    {
      code: 'nextId(draft.ids);',
      errors: [{ messageId: 'missing', data: { callee: 'nextId', position: 'second' } }],
    },
    {
      code: 'nextId(...args);',
      errors: [{ messageId: 'spread', data: { callee: 'nextId' } }],
    },
    {
      code: "nextId(draft.ids, 'inv');",
      options: [{ prefixes }],
      errors: [{ messageId: 'unregistered', data: { value: 'inv' } }],
    },
    {
      code: "import { nextId } from '../core/ids'; const mint = nextId;",
      errors: [{ messageId: 'indirect', data: { callee: 'nextId' } }],
    },
  ],
});
