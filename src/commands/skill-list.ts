import { logger } from '../utils/logger.js';
import { loadRegistry } from '../core/skill-registry-manager.js';

export interface SkillListOptions {
  detail?: string;
  cwd?: string;
}

export async function runSkillList(opts: SkillListOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const entries = await loadRegistry(cwd);

  if (opts.detail) {
    const entry = entries.find((e) => e.name === opts.detail);
    if (!entry) {
      logger.warn(`Skill "${opts.detail}" not found in registry.`);
      return 0;
    }
    logger.header(`Skill: ${entry.name}`);
    logger.divider();
    logger.info(`  Version:     ${entry.version}`);
    logger.info(`  Status:      ${entry.status}`);
    logger.info(`  Usage Count: ${entry.usageCount}`);
    logger.info(`  Last Used:   ${entry.lastUsed ?? 'never'}`);
    return 0;
  }

  logger.header('IvyFlow Skill Registry');
  logger.divider();

  if (entries.length === 0) {
    logger.info('  No skills tracked yet. Skills are tracked when loaded by the AI Agent.');
    return 0;
  }

  for (const entry of entries) {
    const statusIcon = entry.status === 'active' ? 'active' : 'deprecated';
    logger.info(`  ${entry.name} (${statusIcon}) — used ${entry.usageCount}x, last: ${entry.lastUsed?.split('T')[0] ?? 'never'}`);
  }

  return 0;
}
