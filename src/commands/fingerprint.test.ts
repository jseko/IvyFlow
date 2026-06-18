import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import { detectFingerprint } from './fingerprint.js';

describe('detectFingerprint', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-fp-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('detects TypeScript + React project from package.json', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^1.0.0' },
    }));

    const fp = await detectFingerprint(tmp);
    expect(fp.language.value).toContain('typescript');
    expect(fp.frontend?.value).toContain('react');
    expect(fp.testFramework.value).toContain('vitest');
    expect(fp.packageManager?.value).toBe('npm');
  });

  it('detects pnpm from pnpm-lock.yaml', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), '{}');
    await fs.writeFile(path.join(tmp, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0');

    const fp = await detectFingerprint(tmp);
    expect(fp.packageManager?.value).toBe('pnpm');
  });

  it('detects Java + Spring Boot from pom.xml', async () => {
    await fs.writeFile(path.join(tmp, 'pom.xml'), [
      '<project><dependencies>',
      '<dependency><groupId>org.springframework.boot</groupId>',
      '<artifactId>spring-boot-starter</artifactId></dependency>',
      '</dependencies></project>',
    ].join('\n'));

    const fp = await detectFingerprint(tmp);
    expect(fp.language.value).toContain('java');
    expect(fp.buildTool.value).toContain('maven');
    expect(fp.backend?.value).toContain('spring-boot');
  });

  it('detects Go from go.mod', async () => {
    await fs.writeFile(path.join(tmp, 'go.mod'), 'module example.com/app\ngo 1.21\n');

    const fp = await detectFingerprint(tmp);
    expect(fp.language.value).toContain('go');
    expect(fp.buildTool.value).toContain('go');
    expect(fp.backend?.value).toContain('go');
  });

  it('detects fullstack from React + Express', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0', express: '^4.0.0' },
    }));

    const fp = await detectFingerprint(tmp);
    expect(fp.projectType.value).toBe('fullstack');
    expect(fp.frontend?.value).toContain('react');
    expect(fp.backend?.value).toContain('express');
  });

  it('returns unknown for empty project', async () => {
    const fp = await detectFingerprint(tmp);
    expect(fp.projectType.value).toBe('unknown');
    expect(fp.language.value).toEqual([]);
  });

  it('returns CLI projectType when bin field in package.json', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({
      bin: { mycli: './bin/cli.js' },
    }));

    const fp = await detectFingerprint(tmp);
    expect(fp.projectType.value).toBe('cli');
  });

  it('confidence is 1.0 for build-tool-definitive detection', async () => {
    await fs.writeFile(path.join(tmp, 'Cargo.toml'), '[package]\nname = "app"\n');

    const fp = await detectFingerprint(tmp);
    expect(fp.language.value).toContain('rust');
    expect(fp.buildTool.confidence).toBe(1.0);
  });
});
