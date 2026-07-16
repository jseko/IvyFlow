/**
 * `ivy rules generate|analyze|validate` — Rule Generator CLI (v0.14).
 *
 * On first run, uses capability-detector.ts if available (after v0.14 merge).
 * Falls back to empty tech stack when the detector module isn't present yet.
 */

import path from 'path';

import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import {
  generateRules,
  analyzeRules,
  validateRules,
  writeRuleProfile,
} from '../core/rule-generator.js';
import type { TechStack, ProjectIntent } from '../core/capability-model.js';

export interface RulesGenOptions {
  cwd?: string;
  subcommand?: 'generate' | 'analyze' | 'validate';
  format?: 'text' | 'json';
}

async function tryDetect(cwd: string): Promise<{ techStack: TechStack; projectIntent: ProjectIntent } | null> {
  try {
    const mod = await import('../core/capability-detector.js');
    const result = await mod.detectCapabilities(cwd);
    return { techStack: result.techStack, projectIntent: result.projectIntent };
  } catch {
    return null;
  }
}

export async function runRulesGen(opts: RulesGenOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const cmd = opts.subcommand ?? 'generate';

  try {
    const detection = await tryDetect(cwd);
    const techStack: TechStack = detection?.techStack ?? {};
    const projectIntent: ProjectIntent = detection?.projectIntent ?? 'fullstack-app';

    switch (cmd) {
      case 'generate':
        return await runGenerate(cwd, techStack, projectIntent, opts);
      case 'analyze':
        return await runAnalyze(cwd, techStack, opts);
      case 'validate':
        return await runValidate(cwd, techStack, opts);
      default:
        logger.error(`Unknown rules subcommand: ${cmd}`);
        return 1;
    }
  } catch (err) {
    logger.error(`Rules command failed: ${(err as Error).message}`);
    return 1;
  }
}

async function runGenerate(cwd: string, techStack: TechStack, projectIntent: ProjectIntent, opts: RulesGenOptions): Promise<number> {
  const profile = await generateRules(techStack, projectIntent);

  const ivyDir = path.join(cwd, '.ivy');
  if (await fileExists(ivyDir).catch(() => false)) {
    await writeRuleProfile(cwd, profile);
  }

  if (opts.format === 'json') {
    console.log(JSON.stringify(profile, null, 2));
    return 0;
  }

  const techList = [...(techStack.language ?? []), ...(techStack.frontend ?? []), ...(techStack.backend ?? []), ...(techStack.testFramework ?? [])];

  logger.info('\nIvyFlow Rule Generator\n═══════════════════════════════════════════════════════\n');
  logger.info(`  Detected Tech: ${techList.join(', ') || '(none)'}`);
  logger.info(`  Project Intent: ${projectIntent}\n`);

  const byTier: Record<string, number> = { core: 0, context: 0, optional: 0 };
  for (const r of profile.rules) {
    const tier = r.tier ?? 'context';
    byTier[tier] = (byTier[tier] ?? 0) + 1;
    logger.info(`  ${tier === 'core' ? '●' : tier === 'context' ? '○' : '⋆'} ${r.id.padEnd(30)} (${r.severity}, ${tier})`);
  }

  logger.info(`\n  ${profile.rules.length} rules generated (${byTier.core} core + ${byTier.context} context + ${byTier.optional} optional)\n`);
  return 0;
}

async function runAnalyze(cwd: string, techStack: TechStack, opts: RulesGenOptions): Promise<number> {
  const profile = await generateRules(techStack, 'fullstack-app');
  const analysis = analyzeRules(profile, profile.rules.length + 1);

  if (opts.format === 'json') {
    console.log(JSON.stringify(analysis, null, 2));
    return 0;
  }

  logger.info('\nIvyFlow Rule Analysis\n═══════════════════════════════════════════════════════\n');
  logger.info(`  Active Rules:  ${analysis.totalRules}`);
  logger.info(`  Coverage:      ${analysis.coverage}% (${analysis.totalRules}/${analysis.expectedTotal} rules)\n`);

  if (analysis.missing.length > 0) {
    logger.info('  Missing:');
    for (const m of analysis.missing) logger.info(`    ─ ${m}`);
  }
  if (analysis.conflicts.length > 0) {
    logger.info('  Conflicts:');
    for (const c of analysis.conflicts) logger.info(`    [${c.type}] ${c.description}\n    → ${c.resolution}`);
  } else {
    logger.info('  Conflicts: None detected.');
  }
  return 0;
}

async function runValidate(cwd: string, techStack: TechStack, opts: RulesGenOptions): Promise<number> {
  const profile = await generateRules(techStack, 'fullstack-app');
  const validation = validateRules(profile, techStack);

  if (opts.format === 'json') {
    console.log(JSON.stringify(validation, null, 2));
    return 0;
  }

  logger.info('\nRule Validation\n═══════════════════════════════════════════════════════\n');
  for (const d of validation.details) {
    if (d.status === 'matches') logger.info(`  ✓ ${d.rule}: tech stack matches`);
    else logger.info(`  ✗ ${d.rule}: ${d.reason ?? 'no match'} (will not deploy)`);
  }
  logger.info(`\n  Result: ${validation.applicable}/${validation.total} rules applicable, ${validation.skipped} skipped\n`);
  return 0;
}
