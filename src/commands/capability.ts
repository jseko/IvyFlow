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

import path from 'path';

import { logger } from '../utils/logger.js';
import { detectCapabilities, buildTechStack } from '../core/capability-detector.js';
import { readFile } from '../utils/fs.js';

export interface CapabilityOptions {
  subcommand?: 'detect' | 'list' | 'health' | 'profile';
  refresh?: boolean;
  recommended?: boolean;
  format?: string;
  gapsOnly?: boolean;
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
      return await runHealth(cwd, !!opts.gapsOnly, opts.format);
    default:
      return showHelp();
  }
}

// ─── Detect ───

async function runDetect(cwd: string, _refresh: boolean, format?: string): Promise<number> {
  const result = await detectCapabilities(cwd);

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

async function runHealth(cwd: string, gapsOnly: boolean, format?: string): Promise<number> {
  const { detectCapabilities, buildTechStack } = await import('../core/capability-detector.js');
  const { generateHealthReport } = await import('../core/capability-health.js');

  const detection = await detectCapabilities(cwd);
  const allTechStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];
  const expectedCapabilities = detection.candidates.map(c => c.id);
  const actualCapabilities = allTechStacks;

  // For drift, compare against previous detection if available
  const previousPath = path.join(cwd, '.ivy', 'capability-cache.json');
  let previousTechStack: string[] = [];
  try {
    const prevData = await readFile(previousPath);
    const parsed = JSON.parse(prevData);
    previousTechStack = parsed.techStack ?? [];
  } catch {
    // No previous detection, drift will be 0
  }

  const report = generateHealthReport(
    expectedCapabilities,
    actualCapabilities,
    previousTechStack,
    allTechStacks,
    []
  );

  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  if (gapsOnly) {
    logger.header('IvyFlow Capability Health — Gaps Only');
    logger.divider();
    if (report.coverage.gaps.length === 0) {
      logger.info('  No gaps detected.');
      return 0;
    }
    logger.info('  Gap Type  │ Severity  │ Actionability  │ Item');
    logger.info('  ──────────┼───────────┼────────────────┼──────────────────');
    for (const gap of report.coverage.gaps) {
      logger.info(
        `  ${gap.type.padEnd(8)} │ ${gap.severity.padEnd(9)} │ ${gap.actionability.padEnd(14)} │ ${gap.expectedItem}`
      );
    }
    return 0;
  }

  logger.header('IvyFlow Capability Health — 3D Report');
  logger.divider();

  // Coverage
  logger.info('  Coverage');
  logger.info(`    Ratio: ${Math.round(report.coverage.ratio * 100)}% (${report.coverage.actual}/${report.coverage.expected})`);
  if (report.coverage.gaps.length > 0) {
    logger.info(`    Gaps: ${report.coverage.gaps.length}`);
    for (const gap of report.coverage.gaps) {
      logger.info(`      ⚠ ${gap.expectedItem} (${gap.type}, ${gap.severity})`);
    }
  } else {
    logger.info('    Gaps: 0 ✓');
  }

  // Drift
  logger.info('');
  logger.info('  Drift');
  logger.info(`    Rate: ${Math.round(report.drift.rate * 100)}%`);
  if (report.drift.changes.length > 0) {
    for (const change of report.drift.changes) {
      logger.info(`      ${change.type === 'added' ? '+' : '-'} ${change.item}`);
    }
  } else {
    logger.info('    No changes ✓');
  }

  // Risk
  logger.info('');
  logger.info('  Risk');
  if (report.risk.flags.length > 0) {
    for (const flag of report.risk.flags) {
      logger.info(`    ⚠ ${flag.type}: ${flag.description}`);
    }
  } else {
    logger.info('    No risk flags ✓');
  }

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
