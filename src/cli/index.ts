import { Command } from 'commander';
import { createRequire } from 'module';

import { runInit } from '../commands/init.js';
import { runStatus } from '../commands/status.js';
import { runValidate } from '../commands/validate.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const program = new Command();

program
  .name('ivy')
  .description('A Workflow Enforcer for AI Coding Agents')
  .version(version);

program
  .command('init')
  .description('Bootstrap IvyFlow in the current project')
  .option('--quick', 'Quick mode (default): no prompts, sensible defaults')
  .option('--standard', 'Standard mode: interactive wizard')
  .option('--enterprise', 'Enterprise mode: standard + plugin prompts (no plugins in v0.1)')
  .option('--overwrite', 'Overwrite existing IvyFlow files', false)
  .option('--skip-openspec', 'Skip OpenSpec installation step (offline)', false)
  .action(async (opts: { quick?: boolean; standard?: boolean; enterprise?: boolean; overwrite?: boolean; skipOpenspec?: boolean }) => {
    const mode = opts.enterprise ? 'enterprise' : opts.standard ? 'standard' : 'quick';
    const exitCode = await runInit({
      mode,
      overwrite: opts.overwrite,
      skipOpenSpec: opts.skipOpenspec,
    });
    process.exit(exitCode);
  });

program
  .command('status')
  .description('Show current workflow phase + adoption snapshot')
  .option('--change <name>', 'Inspect a specific change')
  .action(async (opts: { change?: string }) => {
    const exitCode = await runStatus({ change: opts.change });
    process.exit(exitCode);
  });

program
  .command('validate')
  .description('Validate phase + phase_history against the phase machine')
  .action(async () => {
    const exitCode = await runValidate({});
    process.exit(exitCode);
  });

// v0.2: doctor / uninstall / update — explicitly NOT registered in v0.1.

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
