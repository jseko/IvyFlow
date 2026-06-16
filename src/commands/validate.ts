/**
 * `ivy validate` — walks every `openspec/changes/<name>/.ivy.yaml`, parses
 * `phase` against `IvyPhase`, and validates `phase_history` pair-wise via
 * `canTransition`. Exits non-zero if ANY change is invalid.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { canTransition, parsePhase, listPhases, IvyPhase } from '../core/phase-machine.js';
import { logger } from '../utils/logger.js';

interface PhaseHistoryEntry {
  from?: string;
  to?: string;
  at?: string;
}

interface ChangeYaml {
  phase?: string;
  phase_history?: PhaseHistoryEntry[];
}

export interface ValidateOptions {
  cwd?: string;
}

interface Issue {
  change: string;
  message: string;
}

async function listChanges(changesRoot: string): Promise<string[]> {
  if (!(await fileExists(changesRoot))) return [];
  const entries = await fs.readdir(changesRoot, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

function validateOne(name: string, data: ChangeYaml): Issue[] {
  const issues: Issue[] = [];
  const allowed = listPhases().join(', ');

  if (data.phase === undefined) {
    issues.push({ change: name, message: `missing 'phase' field` });
  } else {
    const parsed = parsePhase(data.phase);
    if (!parsed) {
      issues.push({
        change: name,
        message: `unknown phase '${data.phase}' (allowed: ${allowed})`,
      });
    }
  }

  const history = data.phase_history ?? [];
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    if (!entry.from || !entry.to) {
      issues.push({
        change: name,
        message: `phase_history[${i}] missing from/to`,
      });
      continue;
    }
    const from = parsePhase(entry.from);
    const to = parsePhase(entry.to);
    if (!from) {
      issues.push({
        change: name,
        message: `phase_history[${i}].from='${entry.from}' is not a valid phase`,
      });
      continue;
    }
    if (!to) {
      issues.push({
        change: name,
        message: `phase_history[${i}].to='${entry.to}' is not a valid phase`,
      });
      continue;
    }
    if (!canTransition(from as IvyPhase, to as IvyPhase)) {
      issues.push({
        change: name,
        message: `illegal transition phase_history[${i}]: ${from} -> ${to}`,
      });
    }
  }

  return issues;
}

export async function runValidate(opts: ValidateOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const changesRoot = path.join(cwd, 'openspec', 'changes');
  const changes = await listChanges(changesRoot);

  if (changes.length === 0) {
    logger.warn(`No changes found under ${path.relative(cwd, changesRoot) || changesRoot}`);
    return 0;
  }

  let totalIssues = 0;
  for (const name of changes) {
    const yamlPath = path.join(changesRoot, name, '.ivy.yaml');
    if (!(await fileExists(yamlPath))) {
      logger.dim(`  ${name}: no .ivy.yaml (skipped)`);
      continue;
    }
    const data = (await readYaml<ChangeYaml>(yamlPath)) ?? {};
    const issues = validateOne(name, data);
    if (issues.length === 0) {
      logger.success(`  ${name}: ok (phase=${data.phase})`);
    } else {
      totalIssues += issues.length;
      logger.error(`  ${name}: ${issues.length} issue(s)`);
      for (const issue of issues) {
        logger.error(`    • ${issue.message}`);
      }
    }
  }

  if (totalIssues > 0) {
    logger.error(`\n${totalIssues} validation issue(s) found.`);
    return 1;
  }
  logger.success(`\nAll ${changes.length} change(s) valid.`);
  return 0;
}
