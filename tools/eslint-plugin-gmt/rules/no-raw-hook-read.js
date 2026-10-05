// gmt/no-raw-hook-read: a value an event may change is a registered hook (src/data/events/hooks.ts) and must be read
// through effective(state, key, q), so active event modifiers apply (DESIGN §2.10, §12 12.3). A string literal equal to
// a hook key may therefore appear only as an argument of effective()/effectiveValue(); anywhere else (a raw
// tuning['ops.x'] read, a lookup table, an object key) it is reported. The registry, the event tables and the tuning
// data name hook keys by design; eslint.config.js turns the rule off for those files.
//
// The hook keys arrive as the `hookKeys` option, which eslint.config.js loads from the live registry
// (tools/eslint-plugin-gmt/registry.js). With an empty registry (P0) the rule reports nothing.
import { calleeName, outermostWrapper, staticString } from './lib/ast.js';

/** Type-level positions: naming a key in a type is not a read. */
const TYPE_PARENTS = new Set(['TSLiteralType', 'TSPropertySignature']);

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid reading an effect-hook key anywhere except through effective().' },
    schema: [
      {
        type: 'object',
        properties: {
          hookKeys: { type: 'array', items: { type: 'string' }, uniqueItems: true },
          callees: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawRead:
        "'{{key}}' is an effect hook: read it through effective(state, '{{key}}', q) so event modifiers apply (DESIGN §2.10).",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const hookKeys = new Set(options.hookKeys ?? []);
    const callees = new Set(options.callees ?? ['effective', 'effectiveValue']);
    if (hookKeys.size === 0) return {};

    function isEffectiveArgument(node) {
      const top = outermostWrapper(node);
      const parent = top.parent;
      if (parent?.type !== 'CallExpression' || !parent.arguments.includes(top)) return false;
      const name = calleeName(parent.callee);
      return name !== null && callees.has(name);
    }

    function check(node) {
      const key = staticString(node);
      if (key === null || !hookKeys.has(key)) return;
      if (node.parent && TYPE_PARENTS.has(node.parent.type)) return;
      if (isEffectiveArgument(node)) return;
      context.report({ node, messageId: 'rawRead', data: { key } });
    }

    return { Literal: check, TemplateLiteral: check };
  },
};
