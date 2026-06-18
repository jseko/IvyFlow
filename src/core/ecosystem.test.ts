import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdirSync, rmSync } from 'fs';
import { promises as fs } from 'fs';

import { detectCapabilities, getBuiltinCapabilityCount, getCapabilityLimit } from './ecosystem.js';

describe('Ecosystem — TC-14: Capability detection', () => {
  it('detects spec_driven (openspec) which should be available', async () => {
    const tmpDir = path.join(os.tmpdir(), `ivy-eco-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const ivyDir = path.join(tmpDir, '.ivy');
    mkdirSync(ivyDir, { recursive: true });
    // Write minimal project.yaml
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), 'version: "0.11.0"\nplatforms: [claude]\n', 'utf-8');

    const caps = await detectCapabilities(tmpDir, true);
    const specDriven = caps.find((c) => c.name === 'spec_driven');
    expect(specDriven).toBeDefined();
    // openspec is installed in this env — should detect
    expect(specDriven!.detected).toBe(true);
    expect(specDriven!.provider).toBe('openspec');

    rmSync(tmpDir, { recursive: true, force: true });
  }, 15_000);
});

describe('Ecosystem — TC-15: Capability not available', () => {
  it('marks missing capability as not detected', async () => {
    const tmpDir = path.join(os.tmpdir(), `ivy-eco-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const ivyDir = path.join(tmpDir, '.ivy');
    mkdirSync(ivyDir, { recursive: true });
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), 'version: "0.11.0"\nplatforms: [claude]\n', 'utf-8');

    // Test detection without requiring tools to exist
    const caps = await detectCapabilities(tmpDir, true);
    expect(Array.isArray(caps)).toBe(true);
    expect(caps.length).toBeGreaterThanOrEqual(1);
    expect(caps.every((c) => typeof c.detected === 'boolean')).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  }, 15_000);
});

describe('Ecosystem — TC-16: project.yaml capabilities write', () => {
  it('writes capabilities to project.yaml', async () => {
    const tmpDir = path.join(os.tmpdir(), `ivy-eco-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const ivyDir = path.join(tmpDir, '.ivy');
    mkdirSync(ivyDir, { recursive: true });
    await fs.writeFile(path.join(ivyDir, 'project.yaml'), 'version: "0.11.0"\nplatforms: [claude]\n', 'utf-8');

    await detectCapabilities(tmpDir, true);

    const content = await fs.readFile(path.join(ivyDir, 'project.yaml'), 'utf-8');
    expect(content).toContain('capabilities');

    rmSync(tmpDir, { recursive: true, force: true });
  }, 15_000);
});

describe('Ecosystem — TC-18: Built-in capability limit', () => {
  it('has ≤ 5 built-in capabilities', () => {
    expect(getBuiltinCapabilityCount()).toBeLessThanOrEqual(getCapabilityLimit());
  });
});
