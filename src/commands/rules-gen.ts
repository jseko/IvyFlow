/**
 * `ivy rules generate|analyze|validate` — Sprint 15.2 Rule Generator CLI.
 */

import path from 'path';

import { logger } from '../utils/logger.js';
import { detectCapabilities, buildTechStack } from '../core/capability-detector.js';
import {
  generateRules,
  analyzeRules,
  validateRules,
} from '../core/rule-generator.js';
import type { RuleDefinition } from '../core/rule-generator.js';

export interface RulesGenOptions {
  subcommand: 'generate' | 'analyze' | 'validate';
  cwd?: string;
  format?: string;
}

export async function runRulesGen(opts: RulesGenOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  switch (opts.subcommand) {
    case 'generate':
      return await runGenerate(cwd, opts.format);
    case 'analyze':
      return await runAnalyze(cwd, opts.format);
    case 'validate':
      return await runValidate(cwd, opts.format);
    default:
      return showHelp();
  }
}

// ─── Generate ───

async function runGenerate(cwd: string, format?: string): Promise<number> {
  const detection = await detectCapabilities(cwd);
  const profile = await generateRules(detection, cwd);

  if (format === 'json') {
    console.log(JSON.stringify(profile, null, 2));
    return 0;
  }

  logger.header('IvyFlow Rules — Generated');
  logger.divider();

  if (profile.rules.length === 0) {
    logger.info('  No rules generated (empty tech stack)');
    return 0;
  }

  logger.info('  ID                          │ Severity  │ Tier      │ Triggers');
  logger.info('  ────────────────────────────┼───────────┼───────────┼────────────────');
  for (const rule of profile.rules) {
    const id = rule.id.padEnd(27);
    const sev = (rule.severity ?? 'medium').padEnd(9);
    const tier = (rule.tier ?? 'core').padEnd(9);
    const triggers = rule.techStackTrigger?.join(', ') ?? '';
    logger.info(`  ${id} │ ${sev} │ ${tier} │ ${triggers}`);
  }

  logger.info('');
  logger.info(`  Total: ${profile.rules.length} rule(s)  Source: ${profile.source}`);

  const unresolvedCount = profile.unresolved?.length ?? 0;
  if (unresolvedCount > 0) {
    logger.info('');
    logger.warn(`  ⚠ ${unresolvedCount} unresolved rule(s):`);
    for (const u of profile.unresolved!) {
      logger.info(`    ${u.ruleId} — ${u.reason}`);
    }
  }

  return 0;
}

// ─── Analyze ───

async function runAnalyze(cwd: string, format?: string): Promise<number> {
  const detection = await detectCapabilities(cwd);
  const profile = await generateRules(detection, cwd);
  const analysis = analyzeRules(profile.rules);

  if (format === 'json') {
    console.log(JSON.stringify(analysis, null, 2));
    return 0;
  }

  logger.header('IvyFlow Rules — Analysis');
  logger.divider();
  logger.info(`  Active rules:   ${analysis.activeCount}`);
  logger.info(`  Coverage:       ${Math.round(analysis.coverage * 100)}%`);
  logger.info(`  Conflicts:      ${analysis.conflicts}`);

  return 0;
}

// ─── Validate ───

async function runValidate(cwd: string, format?: string): Promise<number> {
  const detection = await detectCapabilities(cwd);
  const profile = await generateRules(detection, cwd);
  const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];
  const results = validateRules(profile.rules, techStacks);

  if (format === 'json') {
    console.log(JSON.stringify({ rules: results, timestamp: new Date().toISOString() }, null, 2));
    return 0;
  }

  logger.header('IvyFlow Rules — Validation');
  logger.divider();

  const applicable = results.filter(r => r.applicable);
  const notApplicable = results.filter(r => !r.applicable);

  logger.info(`  Applicable:     ${applicable.length}`);
  logger.info(`  Not applicable: ${notApplicable.length}`);
  logger.info('');

  for (const r of results) {
    const icon = r.applicable ? '✓' : '✗';
    const reason = r.reason ? ` (${r.reason})` : '';
    logger.info(`  ${icon} ${r.rule}${reason}`);
  }

  return 0;
}

// ─── Help ───

function showHelp(): number {
  logger.header('IvyFlow Rules Generator Commands');
  logger.divider();
  logger.info('  generate        Generate rules from detected tech stack');
  logger.info('  analyze         Analyze generated rules (count, coverage, conflicts)');
  logger.info('  validate        Validate rules against current tech stack');
  logger.info('');
  logger.info('  Options:');
  logger.info('    --format json     JSON output');
  return 0;
}
