import { Command } from 'commander';
import { createRequire } from 'module';

import { runInit } from '../commands/init.js';
import { runStatus } from '../commands/status.js';
import { runValidate } from '../commands/validate.js';
import { runDoctor } from '../commands/doctor.js';
import { runUninstall } from '../commands/uninstall.js';
import { runUpdate } from '../commands/update.js';

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
  .option('--security [bool]', 'Run security checks (default: true)', true)
  .action(async (opts: { security?: string }) => {
    const security = opts.security !== 'false';
    const exitCode = await runValidate({ security });
    process.exit(exitCode);
  });

// v0.2: doctor — strict local invariant check (§9.4).
program
  .command('doctor')
  .description('Local invariant health check (§9.4: no telemetry / network / state inference)')
  .option('--fix', 'Re-create missing skills/rules/hooks (never rewrites existing files)', false)
  .action(async (opts: { fix?: boolean }) => {
    const exitCode = await runDoctor({ fix: opts.fix });
    process.exit(exitCode);
  });

// v0.3: uninstall — safe removal with dry-run + force.
program
  .command('uninstall')
  .description('Remove IvyFlow files from installed platforms')
  .option('--platforms <ids>', 'Comma-separated platform ids')
  .option('--dry-run', 'Print what would be removed without deleting', false)
  .option('--force', 'Skip confirmation prompt', false)
  .action(async (opts: { platforms?: string; dryRun?: boolean; force?: boolean }) => {
    const exitCode = await runUninstall({
      platforms: opts.platforms?.split(','),
      dryRun: opts.dryRun,
      force: opts.force,
    });
    process.exit(exitCode);
  });

// v0.3: update — check-only, prints command, does not auto-install.
program
  .command('update')
  .description('Check for updates (prints command, does not auto-install)')
  .option('--check', 'Check-only, return exit code', false)
  .action(async (opts: { check?: boolean }) => {
    const exitCode = await runUpdate({ check: opts.check });
    process.exit(exitCode);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
