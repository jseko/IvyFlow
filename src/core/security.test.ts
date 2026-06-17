import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { runSecurityCheck } from './security.js';
import { PLATFORMS } from './platforms.js';

describe('runSecurityCheck', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-security-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('warns when security rule is missing', async () => {
    const result = await runSecurityCheck({
      cwd: tmpDir,
      platforms: [PLATFORMS[0]], // claude
      scope: 'project',
    });
    expect(result.warnings.some((w) => w.type === 'missing-rule')).toBe(true);
  });

  it('passes when security rule is present', async () => {
    const rulesDir = path.join(tmpDir, '.claude', 'rules');
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(path.join(rulesDir, 'ivy-security.md'), '# security');
    const result = await runSecurityCheck({
      cwd: tmpDir,
      platforms: [PLATFORMS[0]],
      scope: 'project',
    });
    expect(result.warnings.some((w) => w.type === 'missing-rule')).toBe(false);
  });

  it('warns about sensitive filenames', async () => {
    await fs.writeFile(path.join(tmpDir, '.env'), 'SECRET=1');
    const result = await runSecurityCheck({
      cwd: tmpDir,
      platforms: [],
      scope: 'project',
    });
    expect(result.warnings.some((w) => w.type === 'sensitive-file' && w.message.includes('.env'))).toBe(true);
  });

  it('ignores node_modules and .git', async () => {
    await fs.mkdir(path.join(tmpDir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'node_modules', '.env'), 'SECRET=1');
    const result = await runSecurityCheck({
      cwd: tmpDir,
      platforms: [],
      scope: 'project',
    });
    expect(result.warnings.some((w) => w.message.includes('node_modules'))).toBe(false);
  });
});
