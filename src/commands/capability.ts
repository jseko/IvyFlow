/**
 * `ivy capability` — Capability Detection, Listing, Health, and Profile.
 *
 * v0.15: Capability Infrastructure.
 *
 * Commands:
 *   ivy capability detect          — detect project tech stack
 *   ivy capability list            — list detected capabilities
 *   ivy capability health          — capability health assessment (Sprint 15.5)
 *   ivy capability profile         — verify profile (Sprint 15.3)
 *   ivy capability list --recommended — list recommended skills (Sprint 15.3)
 */

import { logger } from '../utils/logger.js';
import { detectCapabilities, buildTechStack } from '../core/capability-detector.js';
import { fileExists, writeFile, ensureDir } from '../utils/fs.js';
import { unlink } from 'fs/promises';
import path from 'path';

export interface CapabilityOptions {
  subcommand?: 'detect' | 'list' | 'health' | 'profile';
  refresh?: boolean;
  recommended?: boolean;
  format?: string;
  gapsOnly?: boolean;
  recommendations?: boolean;
  cwd?: string;
}

export async function runCapability(opts: CapabilityOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  switch (opts.subcommand) {
    case 'detect':
      return await runDetect(cwd, !!opts.refresh, opts.format);
    case 'list':
      return await runList(cwd, !!opts.recommended);
    case 'health':
      return await runHealth(cwd, !!opts.gapsOnly, !!opts.recommendations, opts.format);
    case 'profile':
      return await runProfile(cwd, opts.format);
    default:
      return showHelp();
  }
}

// ─── Detect ───

async function runDetect(cwd: string, refresh: boolean, format?: string): Promise<number> {
  // --refresh: delete existing .ivy/capability.yaml before re-detecting
  if (refresh) {
    const capPath = path.join(cwd, '.ivy', 'capability.yaml');
    if (await fileExists(capPath).catch(() => false)) {
      await unlink(capPath);
    }
  }

  const result = await detectCapabilities(cwd);

  // Write detection results to .ivy/capability.yaml
  const ivyDir = path.join(cwd, '.ivy');
  await ensureDir(ivyDir);
  const capPath = path.join(ivyDir, 'capability.yaml');
  const yaml = serializeCapabilityYaml(result);
  await writeFile(capPath, yaml);

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  logger.header('IvyFlow Capability Detection');
  logger.divider();

  const sourceList = result.sources.length > 0 ? result.sources.join(', ') : 'none';
  logger.info(`  Detection Sources: ${sourceList}`);

  const ts = result.techStack;
  if (ts.frontend?.length) logger.info(`\n  Frontend:\n${ts.frontend.map(t => `    ✓ ${t}`).join('\n')}`);
  if (ts.backend?.length) logger.info(`\n  Backend:\n${ts.backend.map(t => `    ✓ ${t}`).join('\n')}`);
  if (ts.testFramework?.length) logger.info(`\n  Testing:\n${ts.testFramework.map(t => `    ✓ ${t}`).join('\n')}`);
  if (ts.language?.length) logger.info(`\n  Language:\n${ts.language.map(t => `    ✓ ${t}`).join('\n')}`);
  if (ts.buildTool?.length) logger.info(`\n  Build:\n${ts.buildTool.map(t => `    ✓ ${t}`).join('\n')}`);

  if (result.candidates.length === 0) {
    logger.info('\n  No capabilities detected.');
  }

  if (result.unresolved.length > 0) {
    logger.info('\n  ⚠ Unresolved:');
    for (const u of result.unresolved) {
      logger.info(`    ${u.itemId} (confidence: ${u.confidence}) — ${u.reason}`);
    }
  }

  logger.info(`\n  Intent: ${result.projectIntent}`);
  logger.info(`  Confidence: ${result.confidence}`);

  return 0;
}

function serializeCapabilityYaml(result: Awaited<ReturnType<typeof detectCapabilities>>): string {
  const lines: string[] = [];
  lines.push(`techStack:`);
  for (const [category, items] of Object.entries(result.techStack)) {
    if (items && items.length > 0) {
      lines.push(`  ${category}:`);
      for (const item of items) {
        lines.push(`    - ${item}`);
      }
    }
  }
  lines.push(`projectIntent: ${result.projectIntent}`);
  lines.push(`confidence: ${result.confidence}`);
  lines.push(`timestamp: ${result.timestamp}`);
  lines.push(`sources:`);
  for (const src of result.sources) {
    lines.push(`  - ${src}`);
  }
  return lines.join('\n') + '\n';
}

// ─── List ───

async function runList(cwd: string, recommended: boolean): Promise<number> {
  const result = await detectCapabilities(cwd);

  if (recommended) {
    logger.header('Recommended Skills');
    logger.divider();

    try {
      const { getRecommendedSkills, listSkills } = await import('../core/skill-registry.js');
      const allTechStacks = Object.values(result.techStack).flat().filter(Boolean) as string[];
      const skills = recommended ? getRecommendedSkills(allTechStacks) : listSkills();
      if (skills.length === 0) {
        logger.info('  No skills to recommend.');
        return 0;
      }
      logger.info('  ID                    │ Category      │ Install   │ Reason');
      logger.info('  ──────────────────────┼───────────────┼───────────┼───────────────');
      for (const s of skills) {
        const reason = s.techStackTrigger.includes('_always') ? 'General purpose' : `Detected ${s.techStackTrigger.join(', ')}`;
        logger.info(`  ${s.id.padEnd(21)} │ ${s.category.padEnd(13)} │ ${s.installMode.padEnd(9)} │ ${reason}`);
      }
    } catch {
      logger.info('  Skill registry not available.');
    }
    return 0;
  }

  logger.header('Active Capabilities');
  logger.divider();

  const ts = result.techStack;
  const allTech = Object.entries(ts).flatMap(([cat, items]) =>
    (items as string[]).map(item => ({ id: item, category: cat }))
  );

  logger.info('  ID                    │ Category      │ Source  │ Status');
  logger.info('  ──────────────────────┼───────────────┼─────────┼────────');

  if (allTech.length === 0) {
    logger.info('  (no capabilities detected)');
  }
  for (const t of allTech) {
    logger.info(`  ${t.id.padEnd(21)} │ ${t.category.padEnd(13)} │ package │ active`);
  }

  return 0;
}

// ─── Health ───

async function runHealth(cwd: string, gapsOnly: boolean, recommendations: boolean, format?: string): Promise<number> {
  const { assessHealth, generateHealthRecommendations, formatHealthReportWithRecommendations } = await import('../core/capability-health.js');
  const report = await assessHealth(cwd);

  if (format === 'json') {
    if (recommendations) {
      const recs = await generateHealthRecommendations(cwd);
      console.log(JSON.stringify({ report, recommendations: recs }, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
    }
    return 0;
  }

  if (recommendations) {
    const recs = await generateHealthRecommendations(cwd);
    logger.info(formatHealthReportWithRecommendations(report, recs));
  } else {
    logger.header('IvyFlow Capability Health');
    logger.divider();

    // Coverage
    logger.info('  ── Coverage ────────────────────────────────────────────');
    logger.info(`  Coverage: ${report.coverage.ratio.toFixed(2)} (${report.coverage.actual}/${report.coverage.expected})`);
    if (report.coverage.gaps.length > 0) {
      for (const gap of report.coverage.gaps) {
        const icon = gap.severity === 'high' ? '✗' : '⚠';
        logger.info(`  ${icon} [${gap.severity}] ${gap.expectedItem} (${gap.type})`);
        logger.info(`    → ${gap.description} [${gap.actionability}]`);
      }
    } else {
      logger.info('  No gaps detected ✓');
    }

    // Drift
    logger.info('');
    logger.info('  ── Drift ──────────────────────────────────────────────');
    logger.info(`  Rate: ${report.drift.rate.toFixed(2)}`);
    if (report.drift.changes.length > 0) {
      for (const change of report.drift.changes) {
        logger.info(`    ${change.type === 'added' ? '+' : '-'} ${change.item}`);
      }
    } else {
      logger.info('  No changes ✓');
    }

    // Risk
    logger.info('');
    logger.info('  ── Risk ───────────────────────────────────────────────');
    if (report.risk.flags.length > 0) {
      for (const flag of report.risk.flags) {
        logger.info(`  ⚠ [${flag.type}] ${flag.description}`);
      }
    } else {
      logger.info('  No risk flags ✓');
    }

    // Suggestions
    if (report.suggestions.length > 0) {
      logger.info('');
      logger.info('  Suggestions:');
      for (const s of report.suggestions) {
        logger.info(`    → ${s}`);
      }
    }

    logger.info('');
    logger.info('  Note: Health is dimensional (coverage + drift + risk), not scored.');
  }

  return 0;
}

// ─── Profile ───

async function runProfile(cwd: string, format?: string): Promise<number> {
  const { detectCapabilities } = await import('../core/capability-detector.js');
  const { generateProfile } = await import('../core/verify-profile.js');

  const detection = await detectCapabilities(cwd);
  const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];
  const profile = generateProfile('development', techStacks);

  if (format === 'json') {
    console.log(JSON.stringify(profile, null, 2));
    return 0;
  }

  logger.header('IvyFlow Verification Profile');
  logger.divider();
  logger.info(`  Generated from: ${techStacks.join(', ') || '(none)'}`);
  logger.info(`  Maturity:       development`);
  logger.info('');
  logger.info('  Gate              │ Requirement');
  logger.info('  ──────────────────┼──────────────');
  logger.info(`  compile           │ ${profile.compile}`);
  logger.info(`  unitTest          │ ${profile.unitTest}`);
  logger.info(`  integrationTest   │ ${profile.integrationTest}`);
  logger.info(`  e2e               │ ${profile.e2e}`);
  logger.info(`  lint              │ ${profile.lint}`);
  logger.info(`  coverage          │ ${profile.coverage}`);

  return 0;
}

// ─── Help ───

function showHelp(): number {
  logger.header('IvyFlow Capability Commands');
  logger.divider();
  logger.info('  detect          Detect project tech stack and capabilities');
  logger.info('  list            List detected capabilities');
  logger.info('  list --recommended  List recommended skills');
  logger.info('  health          Show capability health assessment (Sprint 15.5)');
  logger.info('  profile         Show verify profile (Sprint 15.3)');
  logger.info('');
  logger.info('  Options:');
  logger.info('    --format json     JSON output');
  logger.info('    --refresh         Force re-detection');
  logger.info('    --gaps-only       Health gaps only');
  return 0;
}
