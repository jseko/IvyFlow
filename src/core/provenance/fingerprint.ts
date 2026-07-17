import { createHash } from 'crypto';
import ts from 'typescript';

export interface LanguageProfile {
  language: string;
}

export interface CodeFingerprint {
  l0: string;
  l1a: string | null;
  l1b: string | null;
  l2: string | null;
  l3: string | null;
  language: LanguageProfile;
}

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
};

function isTSorJS(ext: string): boolean {
  return TS_EXTENSIONS.has(ext) || JS_EXTENSIONS.has(ext);
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filePath.slice(lastDot);
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function normalizeIdentifiers(sourceFile: ts.SourceFile): string {
  const replacements: { start: number; end: number; replacement: string }[] = [];
  let idCounter = 0;
  const idMap = new Map<string, string>();

  function visitor(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      if (node.text === 'undefined') {
        ts.forEachChild(node, visitor);
        return;
      }
      const parent = node.parent;
      if (parent && (ts.isPropertyAccessExpression(parent) || ts.isMethodSignature(parent) || ts.isPropertySignature(parent))) {
        if (parent.name === node) {
          ts.forEachChild(node, visitor);
          return;
        }
      }
      if (!idMap.has(node.text)) {
        idMap.set(node.text, `id_${idCounter++}`);
      }
      replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), replacement: idMap.get(node.text)! });
    }
    ts.forEachChild(node, visitor);
  }

  visitor(sourceFile);

  replacements.sort((a, b) => b.start - a.start);

  let text = sourceFile.getFullText();
  for (const { start, end, replacement } of replacements) {
    text = text.slice(0, start) + replacement + text.slice(end);
  }
  return text;
}

function extractSemanticTokens(sourceFile: ts.SourceFile): string {
  const parts: string[] = [];

  function visitor(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      parts.push(node.getText(sourceFile));
      ts.forEachChild(node, visitor);
      return;
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr)) {
        parts.push(expr.text);
      } else if (ts.isPropertyAccessExpression(expr)) {
        parts.push(expr.name.text);
      }
    }
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
      parts.push(node.text);
    }
    ts.forEachChild(node, visitor);
  }

  visitor(sourceFile);
  return parts.join('\n');
}

function parseSourceFile(code: string, filePath: string): ts.SourceFile | null {
  try {
    const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parseDiagnostics is an internal TS API
    const diagnostics = (sourceFile as any).parseDiagnostics;
    if (diagnostics && diagnostics.length > 0) {
      const hasSyntaxError = diagnostics.some(
        (d: ts.Diagnostic) => d.category === ts.DiagnosticCategory.Error,
      );
      if (hasSyntaxError) return null;
    }
    return sourceFile;
  } catch {
    return null;
  }
}

export function computeL0Fingerprint(content: string): string {
  return sha256(content);
}

export function computeL1aStructuralFingerprint(content: string, filePath: string): string | null {
  const ext = getExtension(filePath);
  if (!isTSorJS(ext)) return null;

  const sourceFile = parseSourceFile(content, filePath);
  if (!sourceFile) return null;

  const normalized = normalizeIdentifiers(sourceFile);
  return sha256(normalized);
}

export function computeL1bSemanticLiteFingerprint(content: string, filePath: string): string | null {
  const ext = getExtension(filePath);
  if (!isTSorJS(ext)) return null;

  const sourceFile = parseSourceFile(content, filePath);
  if (!sourceFile) return null;

  const tokens = extractSemanticTokens(sourceFile);
  return sha256(tokens);
}

export function computeSemanticFingerprint(_content: string, _filePath: string): null {
  return null;
}

export function computeLineageFingerprint(_content: string, _filePath: string): null {
  return null;
}

export function detectLanguage(filePath: string): LanguageProfile {
  const ext = getExtension(filePath);
  const language = EXTENSION_LANGUAGE_MAP[ext] ?? 'unknown';
  return { language };
}

export function computeCodeFingerprint(filePath: string, content: string): CodeFingerprint {
  return {
    l0: computeL0Fingerprint(content),
    l1a: computeL1aStructuralFingerprint(content, filePath),
    l1b: computeL1bSemanticLiteFingerprint(content, filePath),
    l2: computeSemanticFingerprint(content, filePath),
    l3: computeLineageFingerprint(content, filePath),
    language: detectLanguage(filePath),
  };
}
