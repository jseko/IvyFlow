/**
 * `ivy status [--change <name>]` — print current workflow phase and (when
 * present) the latest adoption snapshot.
 */

import path from 'path';

import { readYaml } from '../utils/yaml.js';
import { fileExists } from '../utils/fs.js';
import { parsePhase } from '../core/phase-machine.js';
import { logger } from '../utils/logger.js';

interface AdoptionSnapshot {
  lines_added?: number;
  lines_removed?: number;
  confidence?: string;
  source?: string;
}

interface ChangeYaml {
  phase?: string;
  phase_history?: Array<{ from?: string; to?: string; at?: string }>;
  adoption?: AdoptionSnapshot;
}

export interface StatusOptions {
  change?: string;
  cwd?: string;
}

export async function runStatus(opts: StatusOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  // Project-level summary first.
  const projectYaml = await readYaml(path.join(cwd, '.ivy', 'project.yaml'));
  if (!projectYaml) {
    logger.error('No `.ivy/project.yaml` found. Run `ivy init` first.');
    return 1;
  }
  logger.info(`IvyFlow project (${projectYaml.platform ?? 'unknown'}/${projectYaml.scope ?? 'unknown'})`);

  if (!opts.change) {
    logger.dim('  Pass --change <name> to inspect a specific change.');
    return 0;
  }

  const yamlPath = path.join(cwd, 'openspec', 'changes', opts.change, '.ivy.yaml');
  if (!(await fileExists(yamlPath))) {
    logger.error(`No such change: openspec/changes/${opts.change}/.ivy.yaml not found.`);
    return 1;
  }
  const data = (await readYaml<ChangeYaml>(yamlPath)) ?? {};

  const phase = data.phase ? parsePhase(data.phase) : null;
  if (data.phase && !phase) {
    logger.error(`Change '${opts.change}' has unknown phase: '${data.phase}'`);
    return 1;
  }

  logger.info(`Change: ${opts.change}`);
  logger.info(`Phase:  ${phase ?? '(unset)'}`);

  if (data.adoption) {
    const a = data.adoption;
    const added = a.lines_added ?? 0;
    const conf = a.confidence ?? 'low';
    const src = a.source ?? 'commit-diff';
    logger.info(`Adoption: ~${added} lines (${conf} confidence, ${src})`);
  }

  return 0;
}
