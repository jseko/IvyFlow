/**
 * `ivy council` — Council CLI commands (v0.29 + v0.32 cross-project).
 *
 * v0.29: Single-project council ask/list/register.
 * v0.32: Cross-project mode with --cross-project / --org flags.
 */

import fs from 'node:fs';

import { CrossProjectCouncilEngine, formatCrossProjectReport, toBasicYaml } from '../core/cross-project-council.js';
import { OrgIntelligenceEngine } from '../core/org-types.js';
import { CouncilEngine, listPerspectives } from '../core/council-engine.js';

export interface CouncilCliOptions {
  cwd?: string;
}

// ─── runCouncilAsk (Task 6.1-6.2) ───

export async function runCouncilAsk(
  question: string,
  options: {
    format?: string;
    perspectives?: string;
    output?: string;
    minConf?: string;
    crossProject?: boolean;
    org?: boolean;
    concurrency?: number;
  } = {},
  _opts: CouncilCliOptions = {},
): Promise<number> {
  if (!question) {
    console.error('Error: question is required');
    return 1;
  }

  // v0.32: Cross-project mode
  if (options.crossProject || options.org) {
    return runCouncilAskCrossProject(question, options);
  }

  // v0.29: Single-project mode (real engine, G2)
  return runCouncilAskSingleProject(question, options);
}

// ─── runCouncilAskSingleProject (G2: real CouncilEngine) ───

async function runCouncilAskSingleProject(
  question: string,
  options: { format?: string; perspectives?: string; output?: string },
): Promise<number> {
  const engine = new CouncilEngine(process.cwd());
  const report = await engine.ask(question, {
    perspectiveIds: options.perspectives?.split(',').map((s) => s.trim()).filter(Boolean),
  });

  const format = options.format ?? 'yaml';
  if (!['yaml', 'json', 'text'].includes(format)) {
    console.error(`Invalid format: ${format}. Valid: yaml, json, text`);
    return 1;
  }

  const output = formatCouncilReport(report, format);

  if (options.output) {
    try {
      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`✓ Council report written to ${options.output}`);
    } catch (writeErr) {
      console.error(`Warning: ${(writeErr as Error).message}`);
      console.log(output);
    }
  } else {
    console.log(output);
  }

  // Exit code 1 when every perspective is degraded
  const allDegraded = Object.values(report.perspectives).every(
    (p) => p.status === 'insufficient_memory',
  );
  return allDegraded ? 1 : 0;
}

// ─── formatCouncilReport (single-project) ───

function formatCouncilReport(
  report: { question: string; perspectivesUsed: number; memoryCount: number; perspectives: Record<string, { id: string; status: string; concerns?: Array<{ text: string; source: string }>; message?: string; recommendation?: string }> },
  format: string,
): string {
  if (format === 'json') return JSON.stringify(report, null, 2);
  if (format === 'yaml') return toBasicYaml(report);

  // text
  const lines: string[] = [];
  lines.push('═══ Council Report ═══');
  lines.push(`Q: ${report.question}`);
  lines.push(`${report.perspectivesUsed} perspectives, ${report.memoryCount} memories`);
  lines.push('');
  for (const [pid, section] of Object.entries(report.perspectives)) {
    // G6: use spec-required emoji status indicators (✅ sufficient / ⚠ degraded).
    const icon = section.status === 'sufficient' ? '✅' : '⚠';
    lines.push(`${icon} [${pid}] ${section.status}`);
    for (const c of section.concerns ?? []) {
      lines.push(`    - (${c.source}) ${c.text}`);
    }
    if (section.recommendation) lines.push(`    -> ${section.recommendation}`);
  }
  return lines.join('\n');
}

// ─── runCouncilAskCrossProject (Task 6.2-6.3) ───

async function runCouncilAskCrossProject(
  question: string,
  options: { format?: string; perspectives?: string; output?: string; concurrency?: number },
): Promise<number> {
  const cwd = process.cwd();

  // G1: project discovery is owned by the Org layer (aggregation substrate).
  const org = OrgIntelligenceEngine.discover(cwd);
  if (org.getProjectPaths().length === 0) {
    console.error('No projects found with .ivy/memory/ directories.');
    return 1;
  }

  const councilFactory = async (projectPath: string) => {
    return new CouncilEngine(projectPath);
  };

  const crossEngine = new CrossProjectCouncilEngine({
    projectPaths: [],
    councilFactory,
    discoverer: org,
  });

  const report = await crossEngine.ask(question, {
    perspectiveIds: options.perspectives?.split(',').map(s => s.trim()).filter(Boolean),
    concurrency: options.concurrency,
  });

  const format = options.format ?? 'text';
  if (!['yaml', 'json', 'text'].includes(format)) {
    console.error(`Invalid format: ${format}. Valid: yaml, json, text`);
    return 1;
  }

  const output = formatCrossProjectReport(report, format);

  if (options.output) {
    try {
      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`✓ Cross-project council report written to ${options.output}`);
    } catch (writeErr) {
      console.error(`Warning: ${(writeErr as Error).message}`);
      console.log(output);
    }
  } else {
    console.log(output);
  }

  // G3: exit code 1 when every perspective is degraded across all projects.
  // The engine sets `summary` only in that all-degraded case.
  return report.summary ? 1 : 0;
}

// ─── runCouncilList ───

export async function runCouncilList(
  options: { json?: boolean } = {},
  _opts: CouncilCliOptions = {},
): Promise<number> {
  const perspectives = listPerspectives();

  if (options.json) {
    console.log(JSON.stringify(perspectives, null, 2));
    return 0;
  }

  console.log('Registered Perspectives:\n');
  for (const p of perspectives) {
    console.log(`  ${p.id.padEnd(16)} ${p.description}`);
  }
  console.log('\nRun `ivy council ask "<question>"` to consult the council.');
  return 0;
}

// ─── runCouncilRegister ───

export async function runCouncilRegister(): Promise<number> {
  console.log('自定义视角注册是 v1.0 功能。MVP 使用 4 个预置视角。');
  return 0;
}

// ─── Project discovery ───
// Project discovery now lives in OrgIntelligenceEngine.discover() (see G1).
// The cross-project engine consumes it via the `discoverer` option.