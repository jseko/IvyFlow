import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger.js';
import { fileExists, readFile, readDir, ensureDir } from '../utils/fs.js';
import { getConvertersForPlatforms } from '../core/format-converter.js';

export interface SyncOptions {
  platforms?: string;
  apply?: boolean;
  cwd?: string;
}

export async function runSync(opts: SyncOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const rulesDir = path.join(cwd, '.ai-rules');

  if (!(await fileExists(rulesDir))) {
    logger.warn('No .ai-rules/ directory found. Create one with your shared rules, then run ivy sync.');
    logger.info('');
    logger.info('Example structure:');
    logger.info('  .ai-rules/');
    logger.info('    coding-standards.md');
    logger.info('    security-policies.md');
    return 0;
  }

  const entries = await readDir(rulesDir);
  const ruleFiles = entries.filter((e) => e.endsWith('.md'));
  if (ruleFiles.length === 0) {
    logger.info('No .md rule files found in .ai-rules/');
    return 0;
  }

  const rules: Array<{ path: string; content: string }> = [];
  for (const file of ruleFiles) {
    const content = await readFile(path.join(rulesDir, file));
    rules.push({ path: file, content });
  }

  const platformIds = opts.platforms?.split(',').map((s) => s.trim()).filter(Boolean);
  const converters = getConvertersForPlatforms(platformIds ?? []);

  logger.header(`ivy sync — ${ruleFiles.length} rule(s) → ${converters.length} platform(s)`);
  logger.divider();

  for (const converter of converters) {
    const output = converter.convert(rules);
    const targetPath = path.join(cwd, converter.targetPath({} as Parameters<typeof converter.targetPath>[0]));

    if (opts.apply) {
      await ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, output, 'utf-8');
      logger.success(`  ${converter.name}: written to ${path.relative(cwd, targetPath)}`);
    } else {
      logger.info(`  ${converter.name}: would write to ${path.relative(cwd, targetPath)} (${output.length} bytes)`);
    }
  }

  if (!opts.apply) {
    logger.info('');
    logger.info('  Run `ivy sync --apply` to write changes.');
  }

  return 0;
}
