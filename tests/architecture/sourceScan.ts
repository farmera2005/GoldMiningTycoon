// Source scanning for the architecture tests: file listing, TypeScript parsing, import extraction and resolution, and
// call-site discovery. Everything works on repository-relative POSIX paths so failures read like the source tree.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'coverage', '.git', '.claude', '.vite']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx'];

/** Repository-relative POSIX path. */
export function toRel(abs: string): string {
  return path.relative(REPO_ROOT, abs).split(path.sep).join('/');
}

export function toAbs(rel: string): string {
  return path.join(REPO_ROOT, ...rel.split('/'));
}

/** Source files (TS and JS, including .d.ts) under the given repository-relative directories, sorted; a missing
 * directory (sim/ before the simulator lands) contributes nothing. */
export function listSourceFiles(...dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (absDir: string): void => {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(absDir, entry.name));
      } else if (entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
        out.push(toRel(path.join(absDir, entry.name)));
      }
    }
  };
  for (const dir of dirs) if (existsSync(toAbs(dir))) walk(toAbs(dir));
  return out.sort();
}

/** Immediate subdirectories of a repository-relative directory, sorted. */
export function listSubdirs(dir: string): string[] {
  return readdirSync(toAbs(dir), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** A unit or perf test (colocated `*.test.ts(x)`) or anything under tests/. */
export function isTestFile(rel: string): boolean {
  return rel.startsWith('tests/') || /\.test\.(ts|tsx|js|mjs)$/.test(rel);
}

function scriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function parseText(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName));
}

const parsed = new Map<string, ts.SourceFile>();

/** Parses a repository file (cached for the test run). */
export function parseFile(rel: string): ts.SourceFile {
  let sf = parsed.get(rel);
  if (sf === undefined) {
    sf = parseText(toAbs(rel), readFileSync(toAbs(rel), 'utf8'));
    parsed.set(rel, sf);
  }
  return sf;
}

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------------------------------------------------

export interface ImportRef {
  readonly specifier: string;
  /**
   * True only when the whole statement is erased at compile time (`import type`, `export type … from`, `import('x').T`
   * in a type). Under verbatimModuleSyntax `import { type A } from 'x'` still loads 'x', so it counts as a value import.
   */
  readonly typeOnly: boolean;
  readonly line: number;
}

/** Every module reference in a file: static imports and re-exports, import-equals, dynamic import(), require(). */
export function importsOf(sf: ts.SourceFile): ImportRef[] {
  const out: ImportRef[] = [];
  const add = (specNode: ts.Node | undefined, typeOnly: boolean, at: ts.Node): void => {
    if (specNode !== undefined && ts.isStringLiteralLike(specNode)) {
      out.push({ specifier: specNode.text, typeOnly, line: lineOf(sf, at) });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      add(node.moduleSpecifier, node.importClause?.isTypeOnly === true, node);
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, node.isTypeOnly, node);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression, node.isTypeOnly, node);
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      if (ts.isLiteralTypeNode(arg)) add(arg.literal, true, node);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (isDynamicImport || isRequire) add(node.arguments[0], false, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export type ImportTarget =
  | { readonly kind: 'file'; readonly rel: string }
  | { readonly kind: 'node'; readonly name: string }
  | { readonly kind: 'package'; readonly name: string };

const RESOLVE_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
  resolveJsonModule: true,
  allowImportingTsExtensions: true,
  jsx: ts.JsxEmit.ReactJSX,
};

/** The npm package a bare specifier names: `@scope/pkg/sub` → `@scope/pkg`, `pkg/sub` → `pkg`. */
export function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/** Resolves a specifier from a repository file the way the TypeScript toolchain does (bundler resolution). */
export function resolveImport(fromRel: string, specifier: string): ImportTarget {
  const isPath = specifier.startsWith('.') || specifier.startsWith('/');
  if (!isPath) {
    return isBuiltin(specifier) ? { kind: 'node', name: specifier } : { kind: 'package', name: packageName(specifier) };
  }
  const resolved = ts.resolveModuleName(specifier, toAbs(fromRel), RESOLVE_OPTIONS, ts.sys).resolvedModule;
  if (resolved !== undefined && !resolved.isExternalLibraryImport) {
    return { kind: 'file', rel: toRel(resolved.resolvedFileName) };
  }
  // Assets (CSS, `?url` imports) and missing files: the directory is all the layering rules need.
  const bare = specifier.replace(/[?#].*$/, '');
  return { kind: 'file', rel: toRel(path.resolve(path.dirname(toAbs(fromRel)), bare)) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Call sites
// ---------------------------------------------------------------------------------------------------------------------

export interface CallSite {
  readonly file: string;
  readonly line: number;
  /** The function's original (imported) name, even when called through an alias. */
  readonly callee: string;
  /** The argument at the requested index when it is a plain string literal; null otherwise (or when missing). */
  readonly literal: string | null;
  /** Source text of the argument (or '' when missing), for messages. */
  readonly argText: string;
}

/**
 * Calls to any of `names` in a file: `f(…)`, `ns.f(…)`, and calls through `import { f as g }` aliases. Reports the
 * argument at `argIndex`.
 */
export function callSites(file: string, sf: ts.SourceFile, names: ReadonlySet<string>, argIndex: number): CallSite[] {
  const aliases = new Map<string, string>();
  for (const stmt of sf.statements) {
    const bindings = ts.isImportDeclaration(stmt) ? stmt.importClause?.namedBindings : undefined;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      const imported = (el.propertyName ?? el.name).text;
      if (names.has(imported)) aliases.set(el.name.text, imported);
    }
  }
  const out: CallSite[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      let callee: string | undefined;
      const expr = node.expression;
      if (ts.isIdentifier(expr)) callee = aliases.get(expr.text) ?? (names.has(expr.text) ? expr.text : undefined);
      else if (ts.isPropertyAccessExpression(expr) && names.has(expr.name.text)) callee = expr.name.text;
      if (callee !== undefined) {
        const arg = node.arguments[argIndex];
        out.push({
          file,
          line: lineOf(sf, node),
          callee,
          literal: arg !== undefined && ts.isStringLiteral(arg) ? arg.text : null,
          argText: arg === undefined ? '' : arg.getText(sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Property names of the object literal assigned to `export const <name> = { … }` (through `as`/`satisfies`). */
export function objectLiteralKeys(sf: ts.SourceFile, constName: string): string[] | null {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== constName || decl.initializer === undefined) continue;
      let init: ts.Expression = decl.initializer;
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init)) {
        init = init.expression;
      }
      if (!ts.isObjectLiteralExpression(init)) return null;
      return init.properties.map((p) => {
        const name = p.name;
        if (name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))) {
          return name.text;
        }
        return `<${ts.SyntaxKind[p.kind]}>`;
      });
    }
  }
  return null;
}
