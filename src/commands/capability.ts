/**
 * `ivy capability` — Capability Infrastructure commands (v0.14 Sprint 14.3).
 */

import { logger } from '../utils/logger.js';
import { getRecommendedSkills } from '../core/skill-registry.js';
import {
  generateVerifyProfile,
  writeVerifyProfile,
} from '../core/verify-profile.js';
import type { TechStack, MaturityLevel, ProjectIntent } from '../core/capability-model.js';

export interface CapabilityOptions {
  cwd?: string;
  command?: 'profile' | 'list';
  recommended?: boolean;
  format?: 'text' | 'json';
  maturity?: string;
}

async function tryDetect(cwd: string): Promise<{ techStack: TechStack; projectIntent: ProjectIntent } | null> {
  try {
    const mod = await import('../core/capability-detector.js');
    const result = await mod.detectTechStack(cwd);
    return { techStack: result.techStack, projectIntent: result.projectIntent };
  } catch { return null; }
}

export async function runCapability(opts: CapabilityOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const cmd = opts.command ?? 'list';
  try {
    switch (cmd) {
      case 'profile': return await runProfile(cwd, opts);
      case 'list': return await runList(cwd, opts);
      default: logger.error(`Unknown capability command: ${cmd}`); return 1;
    }
  } catch (err) {
    logger.error(`Capability command failed: ${(err as Error).message}`);
    return 1;
  }
}

async function getDetection(cwd: string): Promise<{ techStack: TechStack; projectIntent: ProjectIntent }> {
  return (await tryDetect(cwd)) ?? { techStack: {}, projectIntent: 'fullstack-app' };
}

async function runProfile(cwd: string, opts: CapabilityOptions): Promise<number> {
  const { techStack, projectIntent } = await getDetection(cwd);
  const maturity = (opts.maturity as MaturityLevel) ?? 'development';
  const profile = await generateVerifyProfile(techStack, maturity, projectIntent);
  await writeVerifyProfile(cwd, profile);
  if (opts.format === 'json') { console.log(JSON.stringify(profile, null, 2)); return 0; }
  logger.info('\nIvyFlow Verification Profile\n═══════════════════════════════════════════════════════\n');
  logger.info(`  Generated from: ${[...(techStack.language ?? []), ...(techStack.frontend ?? []), ...(techStack.backend ?? []), ...(techStack.testFramework ?? [])].join(' + ') || '(none)'}`);
  logger.info(`  Maturity:       ${profile.maturity}\n`);
  for (const g of ['compile', 'unitTest', 'lint', 'e2e', 'integrationTest', 'coverage'] as const) {
    const val = profile[g];
    logger.info(`  ${g.padEnd(18)} │ ${val.toString().padEnd(9)} │ ${val === 'required' ? '✓' : val === 'optional' ? '○' : '—'}`);
  }
  return 0;
}

async function runList(cwd: string, opts: CapabilityOptions): Promise<number> {
  if (opts.recommended) return await runRecommended(cwd);
  const { techStack: ts } = await getDetection(cwd);
  const caps: Array<{ id: string; category: string; source: string; status: string }> = [];
  for (const l of ts.language ?? []) caps.push({ id: l, category: 'language', source: 'config', status: 'active' });
  for (const f of ts.frontend ?? []) caps.push({ id: f, category: 'tech', source: 'config', status: 'active' });
  for (const b of ts.backend ?? []) caps.push({ id: b, category: 'tech', source: 'config', status: 'active' });
  for (const t of ts.testFramework ?? []) caps.push({ id: t, category: 'testing', source: 'config', status: 'active' });
  if (opts.format === 'json') { console.log(JSON.stringify(caps, null, 2)); return 0; }
  logger.info('\nActive Capabilities:\n  ID                    │ Category    │ Source  │ Status\n  ──────────────────────┼─────────────┼─────────┼────────');
  for (const c of caps) logger.info(`  ${c.id.padEnd(22)}│ ${c.category.padEnd(11)}│ ${c.source.padEnd(7)}│ ${c.status}`);
  return 0;
}

async function runRecommended(cwd: string): Promise<number> {
  const { techStack, projectIntent } = await getDetection(cwd);
  const recs = await getRecommendedSkills(techStack, projectIntent);
  logger.info('\nRecommended Skills:\n  ID                    │ Category      │ Determinism  │ Install   │ Reason\n  ──────────────────────┼───────────────┼──────────────┼───────────┼───────');
  for (const r of recs) logger.info(`  ${r.id.padEnd(22)}│ ${r.category.padEnd(13)}│ ${r.determinism.padEnd(12)}│ ${r.installMode.padEnd(9)}│ ${r.reason}`);
  return 0;
}
