import { Command } from 'commander';
import { createRequire } from 'module';

import { runInit } from '../commands/init.js';
import { runStatus } from '../commands/status.js';
import { runValidate } from '../commands/validate.js';
import { runDoctor } from '../commands/doctor.js';
import { runUninstall } from '../commands/uninstall.js';
import { runUpdate } from '../commands/update.js';
import { runAnalytics } from '../commands/analytics.js';
import { runDashboard } from '../commands/dashboard.js';
import { runSuggest } from '../commands/suggest.js';
import { runReview, type ReviewOptions } from '../commands/review.js';
import { runCheck, type CheckOptions } from '../commands/check.js';
import { runExplain, type ExplainOptions } from '../commands/explain.js';
import { runRules, type RulesOptions } from '../commands/rules.js';
import { runArchive } from '../commands/archive.js';
import { runVerify } from '../commands/verify.js';
import { runFingerprint } from '../commands/fingerprint.js';
import { runRelease } from '../commands/release.js';
import { runExport } from '../commands/export.js';

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

// v0.2: doctor — strict local invariant health check (§9.4).
// v0.8: --platforms — platform certification report.
program
  .command('doctor')
  .description('Local invariant health check (§9.4: no telemetry / network / state inference)')
  .option('--fix', 'Re-create missing skills/rules/hooks (never rewrites existing files)', false)
  .option('--platforms', 'Show platform health certification report', false)
  .action(async (opts: { fix?: boolean; platforms?: boolean }) => {
    const exitCode = await runDoctor({ fix: opts.fix, platforms: opts.platforms });
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

// v0.7: analytics — adoption metrics with confidence transparency (rewritten).
program
  .command('analytics')
  .description('Show adoption metrics with data-source transparency (§9.13)')
  .option('--change <name>', 'Filter to a specific change')
  .option('--project', 'Aggregate across all changes')
  .option('--period <days>', 'Time window: 7d, 30d, 90d', '7d')
  .option('--enable', 'Enable analytics tracking', false)
  .option('--disable', 'Disable analytics tracking', false)
  .option('--json', 'Output as JSON', false)
  .option('--confidence', 'Show detailed confidence disclosure', false)
  .action(async (opts: { change?: string; project?: boolean; period?: string; enable?: boolean; disable?: boolean; json?: boolean; confidence?: boolean }) => {
    const period = opts.period === '90d' ? '90d' : opts.period === '30d' ? '30d' : '7d';
    const exitCode = await runAnalytics({
      change: opts.change,
      project: opts.project,
      period,
      enable: opts.enable,
      disable: opts.disable,
      json: opts.json,
      confidence: opts.confidence,
    });
    process.exit(exitCode);
  });

// v0.4: dashboard — ASCII dashboard with data-source declaration.
program
  .command('dashboard')
  .description('Interactive ASCII dashboard for workflow insights')
  .option('--change <name>', 'Filter to a specific change')
  .option('--watch', 'Auto-refresh every 30 seconds', false)
  .option('--html', 'Export dashboard as HTML report', false)
  .option('--period <days>', 'Time window: 7d, 30d, 90d', '7d')
  .option('--quality', 'Show suggestion quality panel', false)
  .option('--team', 'Show team-level overview (cross-change aggregation)', false)
  .option('--adr', 'Show ADR index (decision memory view)', false)
  .option('--memory', 'Show memory overview with type counts', false)
  .action(async (opts: { change?: string; watch?: boolean; html?: boolean; period?: string; quality?: boolean; team?: boolean; adr?: boolean; memory?: boolean }) => {
    const period = opts.period === '90d' ? '90d' : opts.period === '30d' ? '30d' : '7d';
    const exitCode = await runDashboard({
      change: opts.change,
      watch: opts.watch,
      html: opts.html,
      period,
      quality: opts.quality,
      team: opts.team,
      adr: opts.adr,
      memory: opts.memory,
    });
    process.exit(exitCode);
  });

// v0.5: suggest — workflow suggestions (advisory, never auto-execute).
// v0.6 adds: --calibrate, --quality, --show-expired, --show-all.
// v0.7 adds: --explain.
program
  .command('suggest')
  .description('Show workflow suggestions (stuck/rollback/phase-review)')
  .option('--change <name>', 'Filter to a specific change')
  .option('--stuck', 'Only show stuck detections', false)
  .option('--json', 'Output as JSON with quality metrics', false)
  .option('--mark-resolved <id>', 'Mark a suggestion as resolved')
  .option('--action <action>', 'Feedback action: accepted, dismissed, ignored (default: accepted)', 'accepted')
  .option('--calibrate', 'Run stuck threshold calibration', false)
  .option('--quality', 'Show suggestion quality dashboard', false)
  .option('--show-expired', 'Include expired suggestions in output', false)
  .option('--show-all', 'Show suggestions at all visibility levels', false)
  .option('--explain', 'Attach inline trace explanation to each suggestion', false)
  .action(async (opts: { change?: string; stuck?: boolean; json?: boolean; markResolved?: string; action?: string; calibrate?: boolean; quality?: boolean; showExpired?: boolean; showAll?: boolean; explain?: boolean }) => {
    const exitCode = await runSuggest({
      change: opts.change,
      stuck: opts.stuck,
      json: opts.json,
      markResolved: opts.markResolved,
      action: opts.action,
      calibrate: opts.calibrate,
      quality: opts.quality,
      showExpired: opts.showExpired,
      showAll: opts.showAll,
      explain: opts.explain,
    });
    process.exit(exitCode);
  });

// v0.6: review — interactive suggestion processing.
program
  .command('review')
  .description('Interactive suggestion review (accept/dismiss/snooze/ignore)')
  .option('--change <name>', 'Filter to a specific change')
  .option('--type <type>', 'Filter by suggestion type: stuck, phase_review, rollback_warning')
  .option('--auto <action>', 'Batch mode: accept or snooze')
  .option('--snooze-days <days>', 'Days to snooze (default: 7)', '7')
  .option('--json', 'Output as JSON', false)
  .action(async (opts: { change?: string; type?: string; auto?: string; snoozeDays?: string; json?: boolean }) => {
    const exitCode = await runReview({
      change: opts.change,
      type: opts.type as ReviewOptions['type'],
      auto: !!opts.auto,
      autoAction: opts.auto === 'snooze' ? 'snooze' : 'accept',
      snoozeDays: parseInt(opts.snoozeDays ?? '7', 10),
      json: opts.json,
    });
    process.exit(exitCode);
  });

// v0.6: check — CI-friendly workflow health check (non-blocking).
program
  .command('check')
  .description('Non-blocking workflow health check for CI/team sharing')
  .option('--change <name>', 'Change to inspect')
  .option('--mode <mode>', 'Execution depth: quick, standard (default), full', 'standard')
  .option('--output <format>', 'Output format: cli (default), markdown, json', 'cli')
  .option('--env', 'Environment detection mode', false)
  .option('--exit-code', 'Enable non-zero exit codes for failures', false)
  .option('--fail-on <level>', 'Exit code trigger: none, stuck_critical, any_critical', 'none')
  .action(async (opts: { change?: string; mode?: string; output?: string; env?: boolean; exitCode?: boolean; failOn?: string }) => {
    const exitCode = await runCheck({
      change: opts.change,
      mode: opts.mode as CheckOptions['mode'],
      output: opts.output as CheckOptions['output'],
      env: opts.env,
      exitCode: opts.exitCode,
      failOn: opts.failOn as CheckOptions['failOn'],
    });
    process.exit(exitCode);
  });

// v0.7: explain — suggestion traceability (read-only, per §9.15).
program
  .command('explain')
  .description('Show suggestion traceability (read-only, never modifies data)')
  .option('--id <id>', 'Explain a specific suggestion by ID')
  .option('--change <name>', 'Filter to a specific change')
  .option('--type <type>', 'Filter by suggestion type: stuck, phase_review, rollback_warning')
  .option('--json', 'Output as JSON', false)
  .action(async (opts: { id?: string; change?: string; type?: string; json?: boolean }) => {
    const exitCode = await runExplain({
      id: opts.id,
      change: opts.change,
      type: opts.type,
      json: opts.json,
    });
    process.exit(exitCode);
  });

// v0.7: rules — rule governance (list/info/override/remove, §9.14).
program
  .command('rules')
  .description('List and manage Advisor rules (overrides stored in Derived Cache)')
  .option('--list', 'List all active rules with config versions', false)
  .option('--info <name>', 'Show detailed info for a specific rule')
  .option('--override <rule.param=value>', 'Override a rule parameter (e.g., stuck_detection.build=25)')
  .option('--remove <rule.param>', 'Remove a user override (e.g., stuck_detection.build)')
  .option('--json', 'Output as JSON', false)
  .action(async (opts: { list?: boolean; info?: string; override?: string; remove?: string; json?: boolean }) => {
    const exitCode = await runRules({
      list: opts.list,
      info: opts.info,
      override: opts.override,
      remove: opts.remove,
      json: opts.json,
    });
    process.exit(exitCode);
  });

// v0.9: archive — full archive with knowledge extraction + L0 Memory.
program
  .command('archive')
  .description('Archive a change with knowledge extraction and L0 Memory')
  .option('--change <name>', 'Change to archive')
  .option('--action <action>', 'Post-archive action: archive-local, push-pr, keep-state, discard')
  .option('--message <msg>', 'Commit message for push-pr action')
  .option('--no-extract', 'Skip knowledge extraction')
  .option('--force', 'Archive from any phase (not just VERIFY)')
  .option('--adr', 'Generate detailed ADR entries in MemoryStore', false)
  .action(async (opts: { change?: string; action?: string; message?: string; extract?: boolean; force?: boolean; adr?: boolean }) => {
    const exitCode = await runArchive({
      change: opts.change,
      action: opts.action,
      message: opts.message,
      noExtract: !opts.extract,
      force: opts.force,
      adr: opts.adr,
    });
    process.exit(exitCode);
  });

// v0.9: verify — quality gates with evidence output.
program
  .command('verify')
  .description('Run quality gates and produce evidence report')
  .option('--change <name>', 'Change to verify')
  .option('--gate <gate>', 'Specific gate: compile, test, tasks, coverage')
  .option('--skip <gate>', 'Gate to skip')
  .action(async (opts: { change?: string; gate?: string; skip?: string }) => {
    const exitCode = await runVerify({
      change: opts.change,
      gate: opts.gate,
      skip: opts.skip,
    });
    process.exit(exitCode);
  });

// v0.9: fingerprint — confidence-scored tech stack detection.
program
  .command('fingerprint')
  .description('Detect and display project tech stack with confidence scores')
  .option('--json', 'Output as JSON', false)
  .option('--refresh', 'Re-scan and update cache', false)
  .action(async (opts: { json?: boolean; refresh?: boolean }) => {
    const exitCode = await runFingerprint({
      json: opts.json,
      refresh: opts.refresh,
    });
    process.exit(exitCode);
  });

// v0.9: release — bundle archive + evidence + knowledge for handoff.
program
  .command('release')
  .description('Bundle completed change artifacts for handoff')
  .option('--change <name>', 'Change to release (must be in ARCHIVE phase)')
  .option('--output <dir>', 'Output directory (default: .ivy/releases/<name>/)')
  .action(async (opts: { change?: string; output?: string }) => {
    const exitCode = await runRelease({
      change: opts.change,
      output: opts.output,
    });
    process.exit(exitCode);
  });

// v0.10: export — read-only data export.
program
  .command('export')
  .description('Export project data to standard JSON format (read-only)')
  .option('--pipe', 'Output JSON to stdout (pipe-friendly)', false)
  .option('--project <paths...>', 'Include additional project paths')
  .option('--dimension <dim>', 'Export specific dimension: changes, metrics, knowledge')
  .action(async (opts: { pipe?: boolean; project?: string[]; dimension?: string }) => {
    const exitCode = await runExport({
      pipe: opts.pipe,
      project: opts.project,
      dimension: opts.dimension as 'changes' | 'metrics' | 'knowledge' | undefined,
    });
    process.exit(exitCode);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
