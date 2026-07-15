import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoleRegistry, type RoleConfig } from './role-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('RoleRegistry', () => {
  let registry: RoleRegistry;

  beforeEach(() => {
    registry = new RoleRegistry();
  });

  it('loads developer role from role.yaml', async () => {
    await registry.load();
    const dev = registry.get('developer');
    expect(dev).toBeDefined();
    expect(dev!.id).toBe('developer');
    expect(dev!.name).toBe('全栈开发');
    expect(dev!.default_workflow).toBe('openspec');
    expect(dev!.default_topology).toBe('parallel');
  });

  it('getAll returns all roles', async () => {
    await registry.load();
    const roles = registry.getAll();
    expect(roles.length).toBeGreaterThanOrEqual(1);
    const ids = roles.map(r => r.id);
    expect(ids).toContain('developer');
  });

  it('getDefault returns developer', async () => {
    await registry.load();
    const dev = registry.getDefault();
    expect(dev.id).toBe('developer');
  });

  it('resolveImplementation maps capability to skill', async () => {
    await registry.load();
    const impl = registry.resolveImplementation('developer', 'coding');
    expect(impl).toBe('ivy-build');
  });

  it('resolveImplementation returns undefined for unknown capability', async () => {
    await registry.load();
    const impl = registry.resolveImplementation('developer', 'nonexistent');
    expect(impl).toBeUndefined();
  });

  it('get returns undefined for unknown role', () => {
    const role = registry.get('nonexistent');
    expect(role).toBeUndefined();
  });
});
