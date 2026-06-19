/**
 * `ivy capability` — Capability Infrastructure commands (v0.14).
 *
 * Subcommands:
 *   ivy capability detect [--refresh] [--format json]
 *   ivy capability list [--recommended]
 *   ivy capability profile [--maturity <level>]
 */

import path from 'path';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import {
  detectTechStack,
  restackDetection,
} from '../core/capability-detector.js';
import { getRecommendedSkills } from '../core/skill-registry.js';
import { generateVerifyProfile, writeVerifyProfile } from '../core/verify-profile.js';
import type { MaturityLevel } from '../core/capability-model.js';

export interface CapabilityOptions {
  cwd?: string;
  command?: 'detect' | 'list' | 'profile';
  refresh?: boolean;
  recommended?: boolean;
  format?: 'text' | 'json';
  maturity?: string;
}

export async function runCapability(opts: CapabilityOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const cmd = opts.command ?? 'detect';

  try {
    switch (cmd) {
      case 'detect': return await runDetect(cwd, opts);
      case 'list': return await runList(cwd, opts);
      case 'profile': return await runProfile(cwd, opts);
      default:
        logger.error(`Unknown capability command: ${cmd}`);
        return 1;
    }
  } catch (err) {
    logger.error(`Capability command failed: ${(err as Error).message}`);
    return 1;
  }
}

async function runDetect(cwd: string, opts: CapabilityOptions): Promise<number> {
  const force = opts.refresh ?? false;
  const cachedPath = path.join(cwd, '.ivy', 'capability.yaml');

  if (!force && await fileExists(cachedPath)) {
    const cached = await readYaml<Record<string, unknown>>(cachedPath).catch(() => null);
    if (cached) {
      if (opts.format === 'json') {
        console.log(JSON.stringify(cached, null, 2));
        return 0;
      }
      logger.info('\nIvyFlow Capability Detection (cached)\n═══════════════════════════════════════════════════════\n');
      logger.info(`  Detection Sources: ${(cached.sources as string[] ?? []).join(', ') || '—'}`);
      logger.info(`  Confidence: ${String(cached.confidence)}`);
      logger.info(`  Project Intent: ${String(cached.project_intent)}`);
      logger.info('  (Run with --refresh to force re-detection)\n');
      return 0;
    }
  }

  const result = await detectTechStack(cwd);
  await restackDetection(cwd);

  if (opts.format === 'json') {
    console.log(JSON.stringify({ techStack: result.techStack, projectIntent: result.projectIntent, sources: result.sources, confidence: result.confidence, timestamp: result.timestamp }, null, 2));
    return 0;
  }

  const ts = result.techStack;
  logger.info('\nIvyFlow Capability Detection\n═══════════════════════════════════════════════════════\n');
  logger.info(`  Detection Sources: ${result.sources.join(', ')}\n`);
  if (ts.frontend) logger.info(`  Frontend:  ${ts.frontend.map((f) => `✓ ${f}`).join('\n             ')}`);
  if (ts.backend) logger.info(`  Backend:   ${ts.backend.map((b) => `✓ ${b}`).join('\n             ')}`);
  if (ts.testFramework) logger.info(`  Testing:   ${ts.testFramework.map((t) => `✓ ${t}`).join('\n             ')}`);
  if (ts.language) logger.info(`  Language:  ${ts.language.join(', ')}`);
  if (ts.buildTool) logger.info(`  Build:     ${ts.buildTool.join(', ')}`);
  if (ts.database) logger.info(`  Database:  ${ts.database.join(', ')}`);
  logger.info(`\n  Project Intent: ${result.projectIntent}`);
  logger.info(`  Confidence: ${result.confidence.toFixed(2)}\n`);
  return 0;
}

async function runList(cwd: string, opts: CapabilityOptions): Promise<number> {
  if (opts.recommended) {
    const detection = await detectTechStack(cwd);
    const recs = await getRecommendedSkills(detection.techStack, detection.projectIntent as string);
    logger.info('\nRecommended Skills (based on detected tech stack):\n  ID                    │ Category      │ Determinism  │ Install   │ Reason\n  ──────────────────────┼───────────────┼──────────────┼───────────┼───────');
    for (const r of recs) logger.info(`  ${r.id.padEnd(22)}│ ${r.category.padEnd(13)}│ ${r.determinism.padEnd(12)}│ ${r.installMode.padEnd(9)}│ ${r.reason}`);
    return 0;
  }

  const result = await detectTechStack(cwd);
  const caps: Array<{ id: string; category: string; source: string; status: string }> = [];
  for (const lang of result.techStack.language ?? []) caps.push({ id: lang, category: 'language', source: 'config', status: 'active' });
  for (const fe of result.techStack.frontend ?? []) caps.push({ id: fe, category: 'tech', source: 'config', status: 'active' });
  for (const be of result.techStack.backend ?? []) caps.push({ id: be, category: 'tech', source: 'config', status: 'active' });
  for (const tf of result.techStack.testFramework ?? []) caps.push({ id: tf, category: 'testing', source: 'config', status: 'active' });

  if (opts.format === 'json') { console.log(JSON.stringify(caps, null, 2)); return 0; }
  logger.info('\nActive Capabilities:\n  ID                    │ Category    │ Source  │ Status\n  ──────────────────────┼─────────────┼─────────┼────────');
  for (const cap of caps) logger.info(`  ${cap.id.padEnd(22)}│ ${cap.category.padEnd(11)}│ ${cap.source.padEnd(7)}│ ${cap.status}`);
  return 0;
}

async function runProfile(cwd: string, opts: CapabilityOptions): Promise<number> {
  const detection = await detectTechStack(cwd);
  const maturity = (opts.maturity as MaturityLevel) ?? 'development';
  const profile = await generateVerifyProfile(detection.techStack, maturity, detection.projectIntent as string);
  await writeVerifyProfile(cwd, profile);
  if (opts.format === 'json') { console.log(JSON.stringify(profile, null, 2)); return 0; }
  logger.info(`\nIvyFlow Verification Profile\n═══════════════════════════════════════════════════════\n`);
  const techList = [...(detection.techStack.language ?? []), ...(detection.techStack.frontend ?? []), ...(detection.techStack.backend ?? []), ...(detection.techStack.testFramework ?? [])];
  logger.info(`  Generated from: ${techList.join(' + ') || '(none)'}`);
  logger.info(`  Maturity:       ${profile.maturity}\n`);
  for (const g of ['compile', 'unitTest', 'lint', 'e2e', 'integrationTest', 'coverage'] as const) {
    const val = profile[g];
    logger.info(`  ${g.padEnd(18)} │ ${val.toString().padEnd(9)} │ ${val === 'required' ? '✓' : val === 'optional' ? '○' : '—'}`);
  }
  return 0;
}
