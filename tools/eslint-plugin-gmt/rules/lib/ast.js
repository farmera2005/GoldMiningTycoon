// Small ESTree helpers shared by the gmt rules.

/** TypeScript wrappers that leave the runtime value unchanged (`x as T`, `x satisfies T`, `x!`, `<T>x`). */
const TRANSPARENT_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

/** The name a call goes through: `f(...)` gives 'f', `ns.f(...)` gives 'f'; anything else (computed, call result) null. */
export function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return null;
}

/** Climbs from `node` through value-preserving TypeScript wrappers and returns the outermost wrapper (or `node`). */
export function outermostWrapper(node) {
  let top = node;
  while (top.parent && TRANSPARENT_WRAPPERS.has(top.parent.type) && top.parent.expression === top) top = top.parent;
  return top;
}

/** The text of a string literal or of a template literal without substitutions; null for anything else. */
export function staticString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? null;
  }
  return null;
}

/** Ordinal for messages: 0 → 'first', 1 → 'second', … */
export function ordinal(index) {
  return ['first', 'second', 'third', 'fourth', 'fifth'][index] ?? `#${index + 1}`;
}
