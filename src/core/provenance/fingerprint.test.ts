import { describe, it, expect } from 'vitest';
import {
  computeL0Fingerprint,
  computeL1aStructuralFingerprint,
  computeL1bSemanticLiteFingerprint,
  computeSemanticFingerprint,
  computeLineageFingerprint,
  detectLanguage,
  computeCodeFingerprint,
} from './fingerprint.js';

describe('Code Fingerprint', () => {
  describe('L0 File Hash', () => {
    it('same content produces same hash', () => {
      const h1 = computeL0Fingerprint('hello world');
      const h2 = computeL0Fingerprint('hello world');
      expect(h1).toBe(h2);
    });

    it('different content produces different hash', () => {
      const h1 = computeL0Fingerprint('hello');
      const h2 = computeL0Fingerprint('world');
      expect(h1).not.toBe(h2);
    });

    it('returns 64-char hex string', () => {
      const hash = computeL0Fingerprint('test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('L1a Structural Hash', () => {
    it('same logic different variable names produce same hash', () => {
      const code1 = 'function add(a, b) { return a + b; }';
      const code2 = 'function sum(x, y) { return x + y; }';
      const h1 = computeL1aStructuralFingerprint(code1, 'test.ts');
      const h2 = computeL1aStructuralFingerprint(code2, 'test.ts');
      expect(h1).toBe(h2);
    });

    it('different control flow produces different hash', () => {
      const code1 = 'function f() { if (true) { return 1; } return 2; }';
      const code2 = 'function f() { return 1; }';
      const h1 = computeL1aStructuralFingerprint(code1, 'test.ts');
      const h2 = computeL1aStructuralFingerprint(code2, 'test.ts');
      expect(h1).not.toBe(h2);
    });

    it('returns null for non-TS/JS files', () => {
      expect(computeL1aStructuralFingerprint('print("hello")', 'test.py')).toBeNull();
      expect(computeL1aStructuralFingerprint('hello', 'test.txt')).toBeNull();
    });

    it('returns null for invalid TS syntax', () => {
      expect(computeL1aStructuralFingerprint('this is not valid typescript {{{', 'test.ts')).toBeNull();
    });
  });

  describe('L1b Semantic-lite Hash', () => {
    it('different API calls produce different hash', () => {
      const code1 = 'import { fetch } from "node"; fetch("/api");';
      const code2 = 'import axios from "axios"; axios.get("/api");';
      const h1 = computeL1bSemanticLiteFingerprint(code1, 'test.ts');
      const h2 = computeL1bSemanticLiteFingerprint(code2, 'test.ts');
      expect(h1).not.toBe(h2);
    });

    it('same API calls same hash even if variable names differ', () => {
      const code1 = 'import { fetch } from "node"; const data = await fetch("/api");';
      const code2 = 'import { fetch } from "node"; const result = await fetch("/api");';
      const h1 = computeL1bSemanticLiteFingerprint(code1, 'test.ts');
      const h2 = computeL1bSemanticLiteFingerprint(code2, 'test.ts');
      expect(h1).toBe(h2);
    });

    it('returns null for non-TS/JS files', () => {
      expect(computeL1bSemanticLiteFingerprint('print("hello")', 'test.py')).toBeNull();
    });

    it('returns null for invalid TS syntax', () => {
      expect(computeL1bSemanticLiteFingerprint('not valid {{{', 'test.ts')).toBeNull();
    });
  });

  describe('L2 Semantic (reserved)', () => {
    it('returns null', () => {
      expect(computeSemanticFingerprint('code', 'test.ts')).toBeNull();
    });
  });

  describe('L3 Lineage (reserved)', () => {
    it('returns null', () => {
      expect(computeLineageFingerprint('code', 'test.ts')).toBeNull();
    });
  });

  describe('LanguageProfile', () => {
    it('detects TypeScript', () => {
      expect(detectLanguage('file.ts')).toEqual({ language: 'typescript' });
      expect(detectLanguage('file.tsx')).toEqual({ language: 'typescript' });
    });

    it('detects JavaScript', () => {
      expect(detectLanguage('file.js')).toEqual({ language: 'javascript' });
      expect(detectLanguage('file.jsx')).toEqual({ language: 'javascript' });
    });

    it('detects Python', () => {
      expect(detectLanguage('file.py')).toEqual({ language: 'python' });
    });

    it('returns unknown for unsupported extensions', () => {
      expect(detectLanguage('file.txt')).toEqual({ language: 'unknown' });
      expect(detectLanguage('Makefile')).toEqual({ language: 'unknown' });
    });
  });

  describe('computeCodeFingerprint', () => {
    it('returns full fingerprint for TS file', () => {
      const result = computeCodeFingerprint('src/test.ts', 'const x = 1;');
      expect(result.l0).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l1a).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l1b).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l2).toBeNull();
      expect(result.l3).toBeNull();
      expect(result.language.language).toBe('typescript');
    });

    it('returns minimal fingerprint for unknown file type', () => {
      const result = computeCodeFingerprint('README.md', '# Hello');
      expect(result.l0).toMatch(/^[0-9a-f]{64}$/);
      expect(result.l1a).toBeNull();
      expect(result.l1b).toBeNull();
      expect(result.l2).toBeNull();
      expect(result.l3).toBeNull();
      expect(result.language.language).toBe('unknown');
    });
  });
});
