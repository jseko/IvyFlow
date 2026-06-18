import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { writeL0Memory } from './memory-writer.js';
import type { ProjectKnowledge } from './types.js';

describe('writeL0Memory', () => {
  let tmpDir: string;
  let memoryDir: string;

  const sampleKnowledge: ProjectKnowledge = {
    decisions: [
      {
        id: 'DEC-001', title: 'Use TypeScript',
        description: 'TypeScript for type safety',
        date: '2026-06-18', source: 'design.md',
        status: 'accepted',
      },
    ],
    constraints: [
      {
        id: 'CON-001', description: 'Must support 10k concurrent users',
        source: 'design.md', severity: 'must',
      },
    ],
    risks: [
      {
        id: 'RSK-001', description: 'High latency under load',
        source: 'design.md', impact: 'high',
        mitigation: 'Add caching layer',
      },
    ],
    facts: [
      {
        id: 'FAC-001', description: 'Node.js 18+ is required',
        source: 'design.md', category: 'environment',
      },
    ],
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-mw-'));
    memoryDir = path.join(tmpDir, 'memory', 'my-change');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates the memory directory', async () => {
    const result = await writeL0Memory({
      memoryDir,
      knowledge: sampleKnowledge,
      changeName: 'my-change',
      extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
    });
    expect(result).toBe(memoryDir);
    const exists = await fs.stat(memoryDir).then(() => true, () => false);
    expect(exists).toBe(true);
  });

  it('writes per-type YAML files', async () => {
    await writeL0Memory({
      memoryDir,
      knowledge: sampleKnowledge,
      changeName: 'my-change',
      extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
    });

    const files = await fs.readdir(memoryDir);
    expect(files).toContain('decisions.yaml');
    expect(files).toContain('constraints.yaml');
    expect(files).toContain('risks.yaml');
    expect(files).toContain('facts.yaml');
  });

  it('writes knowledge-summary.yaml with correct counts', async () => {
    await writeL0Memory({
      memoryDir,
      knowledge: sampleKnowledge,
      changeName: 'my-change',
      extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
    });

    const summaryRaw = await fs.readFile(path.join(memoryDir, 'knowledge-summary.yaml'), 'utf-8');
    expect(summaryRaw).toContain('changeName: my-change');
    expect(summaryRaw).toContain('decision: 1');
    expect(summaryRaw).toContain('constraint: 1');
    expect(summaryRaw).toContain('risk: 1');
    expect(summaryRaw).toContain('fact: 1');
  });

  it('writes decisions.yaml with L0 entry format', async () => {
    await writeL0Memory({
      memoryDir,
      knowledge: sampleKnowledge,
      changeName: 'my-change',
      extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
    });

    const content = await fs.readFile(path.join(memoryDir, 'decisions.yaml'), 'utf-8');
    expect(content).toContain('type: decision');
    expect(content).toContain('confidence: 1');
    expect(content).toContain('source: design.md');
  });

  it('writes only summary file when knowledge is empty', async () => {
    const empty: ProjectKnowledge = { decisions: [], constraints: [], risks: [], facts: [] };
    await writeL0Memory({
      memoryDir,
      knowledge: empty,
      changeName: 'empty-change',
      extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
    });

    const files = await fs.readdir(memoryDir);
    expect(files).toEqual(['knowledge-summary.yaml']);
  });

  it('does not create per-type files for empty types', async () => {
    const partial: ProjectKnowledge = {
      decisions: sampleKnowledge.decisions,
      constraints: [],
      risks: [],
      facts: [],
    };
    await writeL0Memory({
      memoryDir,
      knowledge: partial,
      changeName: 'my-change',
      extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
    });

    const files = await fs.readdir(memoryDir);
    expect(files).toContain('decisions.yaml');
    expect(files).not.toContain('constraints.yaml');
    expect(files).not.toContain('risks.yaml');
    expect(files).not.toContain('facts.yaml');
  });

  it('generates kebab keys from text', async () => {
    await writeL0Memory({
      memoryDir,
      knowledge: sampleKnowledge,
      changeName: 'my-change',
      extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
    });

    const content = await fs.readFile(path.join(memoryDir, 'decisions.yaml'), 'utf-8');
    expect(content).toContain('key: use-typescript');
  });
});
