import path from 'path';
import { logger } from '../utils/logger.js';
import { runAssess } from '../core/assess-engine.js';

export interface AssessOptions {
  output?: string;
  cwd?: string;
}

export async function runAssessCommand(opts: AssessOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  logger.header('IvyFlow Legacy Project Assessment');
  logger.divider();

  const result = await runAssess(cwd);

  logger.info(`  Documentation:     ${result.documentation}/100`);
  logger.info(`  Test Coverage:     ${result.testCoverage}/100`);
  logger.info(`  Comment Quality:   ${result.commentQuality}/100`);
  logger.info(`  Architecture:      ${result.architecture}/100`);
  logger.info(`  Dependency Health: ${result.dependencyHealth}/100`);
  logger.info(`  ─────────────────────────────`);
  logger.info(`  Overall Score:     ${result.overall}/100`);

  if (result.overall < 30) {
    logger.warn('  Status: CRITICAL — address tech debt before adding features');
  } else if (result.overall < 60) {
    logger.warn('  Status: NEEDS WORK — fix incrementally with each change');
  } else {
    logger.success('  Status: HEALTHY');
  }

  if (opts.output) {
    const { writeFile, ensureDir } = await import('../utils/fs.js');
    const outputPath = path.resolve(cwd, opts.output);
    await ensureDir(path.dirname(outputPath));
    const report = [
      '# IvyFlow Project Assessment',
      '',
      `Overall Score: ${result.overall}/100`,
      '',
      '| Dimension | Score |',
      '|-----------|-------|',
      `| Documentation | ${result.documentation}/100 |`,
      `| Test Coverage | ${result.testCoverage}/100 |`,
      `| Comment Quality | ${result.commentQuality}/100 |`,
      `| Architecture | ${result.architecture}/100 |`,
      `| Dependency Health | ${result.dependencyHealth}/100 |`,
      '',
      '## Details',
      ...result.details.map((d) => `- ${d}`),
      '',
      '## Recommendations',
    ];
    if (result.documentation < 60) report.push('- Create README.md, CONTRIBUTING.md, and docs/ directory');
    if (result.testCoverage < 40) report.push('- Add unit tests to increase test coverage');
    if (result.architecture < 60) report.push('- Create ARCHITECTURE.md documenting module structure');
    if (result.dependencyHealth < 60) report.push('- Audit and update outdated dependencies');
    await writeFile(outputPath, report.join('\n'));
    logger.success(`Report written to ${path.relative(cwd, outputPath)}`);
  }

  return 0;
}
