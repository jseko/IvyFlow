import { describe, it, expect } from 'vitest';
import { SKILLS_AGENT_MAP, getAgentName } from './agent-map.js';
import { PLATFORMS } from './platforms.js';

describe('agent-map', () => {
  // TC-3: SKILLS_AGENT_MAP covers all skill-enabled platforms
  it('should cover all platforms with skills (TC-3)', () => {
    const platformsWithSkills = PLATFORMS.filter(p => p.skillsDir);
    for (const platform of platformsWithSkills) {
      // Platform must exist in agent map (value can be null)
      expect(SKILLS_AGENT_MAP).toHaveProperty(platform.id);
    }
  });

  // TC-10a: No orphan mappings
  it('should have no orphan mappings (TC-10a)', () => {
    for (const platformId of Object.keys(SKILLS_AGENT_MAP)) {
      const exists = PLATFORMS.some(p => p.id === platformId);
      expect(exists).toBe(true);
    }
  });

  it('should return agent name for claude', () => {
    expect(getAgentName('claude')).toBe('claude-code');
  });

  it('should return null for lingma', () => {
    expect(getAgentName('lingma')).toBeNull();
  });

  it('should return null for unknown platform', () => {
    expect(getAgentName('unknown')).toBeNull();
  });
});
