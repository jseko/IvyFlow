import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { extractKnowledge } from './knowledge-extractor.js';

describe('extractKnowledge', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-ke-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('extracts decisions from ## Decision heading', async () => {
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Decision',
      '',
      '- Language: TypeScript was chosen for type safety',
      '- DB: PostgreSQL for relational data',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.decisions).toHaveLength(2);
    expect(result.decisions[0].title).toContain('Language');
    expect(result.decisions[0].source).toBe('design.md');
  });

  it('extracts ## Key Decision and ## ADR variants', async () => {
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Key Decision',
      '- Use React for frontend',
      '',
      '## ADR',
      '- ADR-001: microservices architecture',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.decisions).toHaveLength(2);
  });

  it('extracts constraints from ## Constraints heading', async () => {
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Constraints',
      '- Must support 10k concurrent users',
      '- Should use existing auth system',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].severity).toBe('must');
    expect(result.constraints[1].severity).toBe('should');
  });

  it('extracts risks from ## Risk heading with mitigation parsing', async () => {
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Risk',
      '- High latency under load — Mitigation: add caching layer',
      '- Low test coverage — Mitigation: enforce CI gate',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.risks).toHaveLength(2);
    expect(result.risks[0].mitigation).toContain('add caching');
    expect(result.risks[1].mitigation).toContain('CI gate');
  });

  it('extracts facts from ## Facts and ## Assumptions headings', async () => {
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Facts',
      '- Node.js 18+ is required',
      '- PostgreSQL is the primary database',
      '',
      '## Assumptions',
      '- Team is familiar with React',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.facts).toHaveLength(3);
  });

  it('skips forbidden sections (Summary, Recommendation, Analysis)', async () => {
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Summary',
      '- This is a summary that should not be extracted',
      '',
      '## Decision',
      '- Use Vitest for testing',
      '',
      '## Analysis',
      '- This analysis should be skipped',
      '',
      '## Recommendation',
      '- This recommendation should be skipped',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.decisions).toHaveLength(1);
    expect(result.facts).toHaveLength(0);
  });

  it('returns empty arrays for empty change directory', async () => {
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.decisions).toEqual([]);
    expect(result.constraints).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.facts).toEqual([]);
  });

  it('handles non-existent directory gracefully', async () => {
    const result = await extractKnowledge({ changeDir: path.join(tmpDir, 'nope') });
    expect(result.decisions).toEqual([]);
  });

  it('skips ## Trade-off sections (forbidden pattern)', async () => {
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Trade-off',
      '- Speed vs accuracy — trade-off analysis',
      '',
      '## Decision',
      '- Use monorepo',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.decisions).toHaveLength(1);
  });

  it('extracts from all 3 document types', async () => {
    await fs.writeFile(path.join(tmpDir, 'proposal.md'), [
      '## Decision',
      '- Scope: core features only',
      '',
    ].join('\n'));
    await fs.writeFile(path.join(tmpDir, 'design.md'), [
      '## Constraint',
      '- Must be backward compatible',
      '',
    ].join('\n'));
    await fs.writeFile(path.join(tmpDir, 'tasks.md'), [
      '## Risk',
      '- Timeline risk — Mitigation: buffer',
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.constraints.length).toBeGreaterThan(0);
    expect(result.risks.length).toBeGreaterThan(0);
  });

  it('extracts facts from completed tasks in tasks.md', async () => {
    await fs.writeFile(path.join(tmpDir, 'tasks.md'), [
      '## Step 1: Setup',
      '- [x] Initialize project structure',
      '- [x] Configure TypeScript',
      '- [ ] Add authentication',        // not completed
      '',
      '## Step 2: Core Features',
      '- [x] Implement user API',
      '- [X] Write unit tests',          // uppercase X
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    // Should have 4 completed task facts
    const completedTaskFacts = result.facts.filter((f) => f.category === 'convention' && f.source === 'tasks.md');
    expect(completedTaskFacts).toHaveLength(4);
    expect(completedTaskFacts.map((f) => f.description)).toContain('Initialize project structure');
    expect(completedTaskFacts.map((f) => f.description)).toContain('Write unit tests');
  });

  it('deduplicates completed task descriptions', async () => {
    await fs.writeFile(path.join(tmpDir, 'tasks.md'), [
      '## Tasks',
      '- [x] Set up CI',
      '- [x] Set up CI',  // duplicate
      '',
    ].join('\n'));
    const result = await extractKnowledge({ changeDir: tmpDir });
    const ciFacts = result.facts.filter((f) => f.description === 'Set up CI');
    expect(ciFacts).toHaveLength(1);
  });
});
