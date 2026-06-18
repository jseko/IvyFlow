import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';

import { runInit } from './init.js';
import { runStatus } from './status.js';
import { runValidate } from './validate.js';
import { runDashboard } from './dashboard.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-cmd-'));
}

function gitInit(cwd: string): void {
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd });
}

describe('runInit (quick mode, skipOpenSpec)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
    gitInit(tmp);
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('lays down skill, rule, hook, and project.yaml', async () => {
    const code = await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    expect(code).toBe(0);

    const skill = path.join(tmp, '.claude', 'skills', 'ivy', 'SKILL.md');
    const rule = path.join(tmp, '.claude', 'rules', 'ivy-phase-guard.md');
    const hook = path.join(tmp, '.git', 'hooks', 'pre-push');
    const projectYaml = path.join(tmp, '.ivy', 'project.yaml');

    for (const p of [skill, rule, hook, projectYaml]) {
      const stat = await fs.stat(p);
      expect(stat.isFile()).toBe(true);
    }
  });

  it('is idempotent with overwrite=false (skips on second run)', async () => {
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    const code = await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    expect(code).toBe(0);
  });
});

describe('runStatus', () => {
  let tmp: string;
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(async () => {
    tmp = await mkTmpDir();
    logSpy.mockClear();
    errSpy.mockClear();
    warnSpy.mockClear();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  function captured(): string {
    return [...logSpy.mock.calls, ...errSpy.mock.calls, ...warnSpy.mock.calls]
      .map((c) => c.map(String).join(' '))
      .join('\n');
  }

  it('exits 1 when no .ivy/project.yaml exists', async () => {
    const code = await runStatus({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('prints Phase + Adoption when --change yaml has both', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });

    const changeDir = path.join(tmp, 'openspec', 'changes', 'add-x');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, '.ivy.yaml'),
      [
        'phase: archive',
        'adoption:',
        '  lines_added: 420',
        '  lines_removed: 30',
        '  confidence: low',
        '  source: commit-diff',
        '',
      ].join('\n'),
    );

    const code = await runStatus({ change: 'add-x', cwd: tmp });
    expect(code).toBe(0);
    const written = captured();
    expect(written).toContain('Phase:');
    expect(written).toContain('archive');
    expect(written).toContain('~420 lines');
    expect(written).toContain('low confidence');
    expect(written).toContain('commit-diff');
  });

  it('omits Adoption line when no snapshot present', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });

    const changeDir = path.join(tmp, 'openspec', 'changes', 'add-y');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, '.ivy.yaml'), 'phase: build\n');

    const code = await runStatus({ change: 'add-y', cwd: tmp });
    expect(code).toBe(0);
    const written = captured();
    expect(written).toContain('Phase:');
    expect(written).toContain('build');
    expect(written).not.toContain('Adoption:');
  });

  it('exits 1 when --change phase is unknown', async () => {
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });

    const changeDir = path.join(tmp, 'openspec', 'changes', 'bad');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(changeDir, '.ivy.yaml'), 'phase: implementing\n');

    const code = await runStatus({ change: 'bad', cwd: tmp });
    expect(code).toBe(1);
  });
});

describe('runValidate', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  async function writeChange(name: string, body: string): Promise<void> {
    const dir = path.join(tmp, 'openspec', 'changes', name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, '.ivy.yaml'), body);
  }

  it('returns 0 when all changes have valid phase + history', async () => {
    await writeChange(
      'good',
      [
        'phase: build',
        'phase_history:',
        '  - { from: open, to: design }',
        '  - { from: design, to: build }',
        '',
      ].join('\n'),
    );
    const code = await runValidate({ cwd: tmp });
    expect(code).toBe(0);
  });

  it('returns 1 on unknown phase', async () => {
    await writeChange('bad', 'phase: implementing\n');
    const code = await runValidate({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('returns 1 on illegal transition (open -> build)', async () => {
    await writeChange(
      'illegal',
      [
        'phase: build',
        'phase_history:',
        '  - { from: open, to: build }',
        '',
      ].join('\n'),
    );
    const code = await runValidate({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('returns 1 on VERIFY -> DESIGN (explicitly disallowed)', async () => {
    await writeChange(
      'rollback-bad',
      [
        'phase: design',
        'phase_history:',
        '  - { from: open, to: design }',
        '  - { from: design, to: build }',
        '  - { from: build, to: verify }',
        '  - { from: verify, to: design }',
        '',
      ].join('\n'),
    );
    const code = await runValidate({ cwd: tmp });
    expect(code).toBe(1);
  });

  it('returns 0 with warning when no changes exist', async () => {
    const code = await runValidate({ cwd: tmp });
    expect(code).toBe(0);
  });
});

describe('runDashboard', () => {
  let tmp: string;
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(async () => {
    tmp = await mkTmpDir();
    logSpy.mockClear();
    gitInit(tmp);
    await runInit({ mode: 'quick', cwd: tmp, skipOpenSpec: true });
    // Enable analytics
    const yamlPath = path.join(tmp, '.ivy', 'project.yaml');
    const yaml = await fs.readFile(yamlPath, 'utf-8');
    await fs.writeFile(yamlPath, yaml.replace('analytics_enabled: false', 'analytics_enabled: true'));
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // TC-8: Dashboard trend chart rendering
  it('renders trend chart section in output', async () => {
    const code = await runDashboard({ cwd: tmp });
    expect(code).toBe(0);
    const output = logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(output).toContain('IvyFlow Dashboard');
    expect(output).toContain('Commit Trend');
    expect(output).toContain('Data Source Declaration');
    expect(output).toContain('Verified Metrics');
  });

  // TC-9: Dashboard HTML export
  it('exports HTML report with --html flag', async () => {
    const code = await runDashboard({ cwd: tmp, html: true });
    expect(code).toBe(0);
    // Should write to .ivy/reports/
    const reportDir = path.join(tmp, '.ivy', 'reports');
    const files = await fs.readdir(reportDir);
    const htmlFiles = files.filter((f) => f.endsWith('.html'));
    expect(htmlFiles.length).toBeGreaterThanOrEqual(1);
    const content = await fs.readFile(path.join(reportDir, htmlFiles[0]), 'utf-8');
    expect(content).toContain('IvyFlow Dashboard');
    expect(content).toContain('<!DOCTYPE html>');
  });
});
