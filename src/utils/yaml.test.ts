import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { readYaml, writeYaml, patchYaml } from './yaml.js';

describe('yaml utils', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-yaml-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  describe('readYaml', () => {
    it('returns null when file is missing', async () => {
      const result = await readYaml(path.join(tmp, 'nope.yaml'));
      expect(result).toBeNull();
    });

    it('returns empty object for an empty file', async () => {
      const file = path.join(tmp, 'empty.yaml');
      await fs.writeFile(file, '');
      const result = await readYaml(file);
      expect(result).toEqual({});
    });

    it('parses a mapping document', async () => {
      const file = path.join(tmp, 'doc.yaml');
      await fs.writeFile(file, 'phase: archive\nbase_commit: abc123\n');
      const result = await readYaml<{ phase: string; base_commit: string }>(file);
      expect(result).toEqual({ phase: 'archive', base_commit: 'abc123' });
    });

    it('throws when document is not a mapping', async () => {
      const file = path.join(tmp, 'scalar.yaml');
      await fs.writeFile(file, '42\n');
      await expect(readYaml(file)).rejects.toThrow(/mapping/);
    });
  });

  describe('writeYaml', () => {
    it('creates parent directories and writes valid YAML', async () => {
      const file = path.join(tmp, 'nested', 'deep', 'doc.yaml');
      await writeYaml(file, { phase: 'build', count: 3 });
      const round = await readYaml<{ phase: string; count: number }>(file);
      expect(round).toEqual({ phase: 'build', count: 3 });
    });
  });

  describe('patchYaml', () => {
    it('preserves unrelated top-level keys', async () => {
      const file = path.join(tmp, 'merge.yaml');
      await writeYaml(file, { phase: 'archive', base_commit: 'sha1', other: 'keep' });
      await patchYaml(file, { adoption: { lines_added: 10 } });
      const round = await readYaml<{
        phase: string;
        base_commit: string;
        other: string;
        adoption: { lines_added: number };
      }>(file);
      expect(round?.phase).toBe('archive');
      expect(round?.base_commit).toBe('sha1');
      expect(round?.other).toBe('keep');
      expect(round?.adoption.lines_added).toBe(10);
    });

    it('creates the file when missing', async () => {
      const file = path.join(tmp, 'fresh.yaml');
      await patchYaml(file, { phase: 'open' });
      const round = await readYaml<{ phase: string }>(file);
      expect(round).toEqual({ phase: 'open' });
    });
  });
});
