// A minimal CSS reader for the theme's own files (tokens.css, fonts.css, base.css), so tests can check tokens and
// font descriptors from the source CSS (DESIGN §13.27 T20 "computed from theme/tokens.css"). It understands rules,
// nested at-rules, quoted strings and comments; that is all these files use.

export interface CssBlock {
  /** The selector or at-rule prelude, whitespace-collapsed (e.g. `:root[data-theme='lamplight']`). */
  readonly prelude: string;
  /** Enclosing at-rule preludes, outermost first (e.g. `['@media (prefers-color-scheme: dark)']`). */
  readonly parents: readonly string[];
  /** Declarations in source order; a later duplicate overrides an earlier one. */
  readonly decls: Readonly<Record<string, string>>;
}

function stripComments(css: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < css.length) {
    const ch = css[i] ?? '';
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += css[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i++;
    } else if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Splits a declaration list on `;` outside strings and parentheses. */
export function parseDeclarations(body: string): Record<string, string> {
  const decls: Record<string, string> = {};
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  const flush = (end: number): void => {
    const text = body.slice(start, end);
    const colon = text.indexOf(':');
    if (colon > 0) decls[collapse(text.slice(0, colon))] = collapse(text.slice(colon + 1));
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) {
      flush(i);
      start = i + 1;
    }
  }
  flush(body.length);
  return decls;
}

/** Every innermost block (one with declarations and no nested blocks), with its at-rule ancestors. */
export function parseCss(source: string): CssBlock[] {
  const css = stripComments(source);
  const blocks: CssBlock[] = [];
  const stack: { prelude: string; bodyStart: number; nested: boolean }[] = [];
  let segmentStart = 0;
  let quote: string | null = null;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{') {
      const parent = stack[stack.length - 1];
      if (parent) parent.nested = true;
      stack.push({ prelude: collapse(css.slice(segmentStart, i)), bodyStart: i + 1, nested: false });
      segmentStart = i + 1;
    } else if (ch === '}') {
      const block = stack.pop();
      if (block && !block.nested) {
        blocks.push({
          prelude: block.prelude,
          parents: stack.map((s) => s.prelude),
          decls: parseDeclarations(css.slice(block.bodyStart, i)),
        });
      }
      segmentStart = i + 1;
    } else if (ch === ';' && stack.length === 0) {
      segmentStart = i + 1; // top-level statements such as @import
    }
  }
  return blocks;
}

/** The single block with this prelude and these parents; throws when absent or ambiguous. */
export function findBlock(blocks: readonly CssBlock[], prelude: string, parents: readonly string[] = []): CssBlock {
  const matches = blocks.filter(
    (b) => b.prelude === prelude && b.parents.length === parents.length && b.parents.every((p, i) => p === parents[i]),
  );
  if (matches.length !== 1)
    throw new Error(`Expected one block ${[...parents, prelude].join(' > ')}, found ${matches.length}`);
  const [match] = matches;
  if (!match) throw new Error('unreachable');
  return match;
}
