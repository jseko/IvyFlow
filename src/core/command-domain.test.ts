import { describe, it, expect } from 'vitest';
import { COMMAND_DOMAIN_REGISTRY, getCommandsByDomain, getDomainForCommand } from './command-domain.js';

describe('command-domain', () => {
  it('should have all registered commands with domains', () => {
    expect(COMMAND_DOMAIN_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of COMMAND_DOMAIN_REGISTRY) {
      expect(['platform', 'system', 'workflow', 'inspect', 'lifecycle']).toContain(entry.domain);
    }
  });

  it('should group commands by domain', () => {
    const groups = getCommandsByDomain();
    const domains = Object.keys(groups);
    expect(domains).toEqual(['platform', 'system', 'workflow', 'inspect', 'lifecycle']);
    const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(COMMAND_DOMAIN_REGISTRY.length);
  });

  it('should look up domain for a command', () => {
    expect(getDomainForCommand('init')).toBe('lifecycle');
    expect(getDomainForCommand('doctor')).toBe('system');
  });
});
