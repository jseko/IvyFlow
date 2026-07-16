import path from 'path';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';
import { readState } from '../core/lifecycle-projection.js';
import { resolveNextSkill, formatNextResult } from '../core/skill-router.js';

export interface NextOptions {
  changeName: string;
  cwd?: string;
}

export async function runNext(opts: NextOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  const state = await readState(cwd);
  if (!state) {
    logger.error('No lifecycle state found. Run ivy state init first.');
    return 1;
  }

  const result = resolveNextSkill(state);
  logger.info(formatNextResult(result));
  return 0;
}
