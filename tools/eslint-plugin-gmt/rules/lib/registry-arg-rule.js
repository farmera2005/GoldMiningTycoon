// Factory for rules that require a registry name (an RNG stream, an id prefix) to be passed to a function as a plain
// string literal. A literal is what lets tests/architecture/registries.test.ts check, without running the engine, that
// every name is registered and used only by its owning section (DESIGN §2.3 item 1, §2.4 "IDs", §2.14 "registries").
import { calleeName, ordinal } from './ast.js';

/**
 * @param {object} spec
 * @param {string} spec.what              noun for messages, e.g. 'stream name'
 * @param {string[]} spec.defaultCallees  function names checked when the `callees` option is absent
 * @param {number} spec.argIndex          zero-based position of the registry argument
 * @param {string} spec.registryOption    option holding the registered names, e.g. 'streams'
 * @param {string} spec.registryFile      where the registry lives, for messages
 * @param {string} spec.designRef         DESIGN reference for messages
 * @param {string} spec.description       rule description
 */
export function createRegistryArgRule(spec) {
  const { what, defaultCallees, argIndex, registryOption, registryFile, designRef, description } = spec;
  return {
    meta: {
      type: 'problem',
      docs: { description },
      schema: [
        {
          type: 'object',
          properties: {
            callees: { type: 'array', items: { type: 'string' }, uniqueItems: true },
            [registryOption]: { type: 'array', items: { type: 'string' }, uniqueItems: true },
          },
          additionalProperties: false,
        },
      ],
      messages: {
        missing: `{{callee}}() needs the ${what} as its {{position}} argument (${designRef}).`,
        notLiteral: `The ${what} passed to {{callee}}() must be a plain string literal so the registry test can check it (${designRef}).`,
        template: `Use a plain string literal for the ${what} in {{callee}}(), not a template literal (${designRef}).`,
        spread: `Do not spread arguments into {{callee}}(): the ${what} must be a visible string literal (${designRef}).`,
        unregistered: `'{{value}}' is not a registered ${what}; register it in ${registryFile} with its owning section (${designRef}).`,
        indirect: `Call {{callee}}() directly: passing or aliasing it hides the ${what} from the registry check (${designRef}).`,
      },
    },
    create(context) {
      const options = context.options[0] ?? {};
      const callees = new Set(options.callees ?? defaultCallees);
      const registered = options[registryOption] ? new Set(options[registryOption]) : null;
      /** Local names bound to an imported callee (`import { rng as draw }` binds 'draw' to 'rng'). */
      const aliases = new Map();
      const sourceCode = context.sourceCode;

      function checkCall(node, callee) {
        const args = node.arguments;
        for (let i = 0; i <= argIndex && i < args.length; i++) {
          if (args[i].type === 'SpreadElement') {
            context.report({ node: args[i], messageId: 'spread', data: { callee } });
            return;
          }
        }
        const arg = args[argIndex];
        if (arg === undefined) {
          context.report({ node, messageId: 'missing', data: { callee, position: ordinal(argIndex) } });
          return;
        }
        if (arg.type === 'TemplateLiteral') {
          context.report({ node: arg, messageId: 'template', data: { callee } });
          return;
        }
        if (arg.type !== 'Literal' || typeof arg.value !== 'string') {
          context.report({ node: arg, messageId: 'notLiteral', data: { callee } });
          return;
        }
        if (registered !== null && !registered.has(arg.value)) {
          context.report({ node: arg, messageId: 'unregistered', data: { value: arg.value } });
        }
      }

      return {
        ImportSpecifier(node) {
          const imported = node.imported.type === 'Identifier' ? node.imported.name : node.imported.value;
          if (!callees.has(imported)) return;
          aliases.set(node.local.name, imported);
          // A reference that is not the callee of a call lets the function travel under another name, where neither
          // this rule nor the registry test can see the name it is given.
          for (const variable of sourceCode.getDeclaredVariables(node)) {
            for (const ref of variable.references) {
              const id = ref.identifier;
              const parent = id.parent;
              if (parent.type === 'CallExpression' && parent.callee === id) continue;
              if (parent.type === 'ExportSpecifier' || parent.type === 'TSTypeQuery') continue;
              context.report({ node: id, messageId: 'indirect', data: { callee: imported } });
            }
          }
        },
        CallExpression(node) {
          const name = calleeName(node.callee);
          if (name === null) return;
          if (node.callee.type === 'Identifier' && aliases.has(name)) {
            checkCall(node, aliases.get(name));
            return;
          }
          if (callees.has(name)) checkCall(node, name);
        },
      };
    },
  };
}
