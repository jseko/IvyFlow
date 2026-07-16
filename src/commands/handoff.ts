import path from 'path';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { readState } from '../core/lifecycle-projection.js';
import { generateHandoff, computeHandoffHashOnly } from '../core/handoff-generator.js';

export interface HandoffOptions {
  changeName: string;
  phase: string;
  write?: boolean;
  full?: boolean;
  hashOnly?: boolean;
  cwd?: string;
}

export async function runHandoff(opts: HandoffOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const changeDir = path.join(cwd, 'openspec', 'changes', opts.changeName);

  if (!(await fileExists(changeDir))) {
    logger.error(`Change "${opts.changeName}" not found at ${changeDir}`);
    return 1;
  }

  if (opts.hashOnly) {
    const hash = await computeHandoffHashOnly(cwd, opts.changeName);
    logger.info(hash);
    return 0;
  }

  if (!opts.write) {
    logger.error('Use --write to generate handoff files, or --hash-only for integrity check.');
    return 1;
  }

  const state = await readState(cwd);
  logger.step(`Generating ${opts.phase} handoff for "${opts.changeName}"...`);

  const result = await generateHandoff(cwd, opts.changeName, opts.phase, { full: opts.full });

  logger.success(`Handoff generated:`);
  logger.info(`  JSON: ${result.jsonPath}`);
  logger.info(`  MD:   ${result.mdPath}`);
  logger.info(`  Hash: ${result.contextHash}`);

  if (state) {
    const { writeState, applyTransition } = await import('../core/lifecycle-projection.js');
    const ext = state as Record<string, unknown>;
    ext.handoff_context = result.jsonPath;
    ext.handoff_hash = result.contextHash;
    await writeState(cwd, state);
    logger.success('handoff_context and handoff_hash recorded in state.');
  }

  return 0;
}
