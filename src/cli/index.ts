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
import { runAudit } from '../commands/audit.js';
import { runTrace } from '../commands/trace.js';
import { runExport } from '../commands/export.js';
import { runState, type StateOptions } from '../commands/state.js';
import { runWorkflow, type WorkflowOptions } from '../commands/workflow.js';
import { runExplore } from '../commands/explore.js';
import { runCapability, type CapabilityOptions } from '../commands/capability.js';
import { runCapabilityHealth } from '../commands/capability-health.js';
import { runRulesGen } from '../commands/rules-gen.js';
import {
  runKnowledgeLink,
  runKnowledgeLinks,
  runKnowledgeTraverse,
  runKnowledgeUnlink,
} from '../commands/knowledge.js';

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
// v0.11: --ecosystem — capability detection, --sync-kb — knowledge sync.
// v0.12: --memory — memory health assessment.
program
  .command('doctor')
  .description('Local invariant health check (§9.4: no telemetry / network / state inference)')
  .option('--fix', 'Re-create missing skills/rules/hooks (never rewrites existing files)', false)
  .option('--platforms', 'Show platform health certification report', false)
  .option('--ecosystem', 'v0.11: Show ecosystem capability detection', false)
  .option('--sync-kb', 'v0.11: Sync knowledge base reference markers', false)
  .option('--memory', 'v0.12: Assess memory health across 6 dimensions', false)
  .option('--json', 'v0.12: Output as JSON', false)
  .action(async (opts: { fix?: boolean; platforms?: boolean; ecosystem?: boolean; syncKb?: boolean; memory?: boolean; json?: boolean }) => {
    const exitCode = await runDoctor({ fix: opts.fix, platforms: opts.platforms, ecosystem: opts.ecosystem, syncKb: opts.syncKb, memory: opts.memory, json: opts.json });
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
// v0.11: --org, --knowledge, --metrics, --format flags.
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
  .option('--org <paths...>', 'v0.11: Organization Insights (cross-project aggregation)', false)
  .option('--knowledge', 'v0.11: Show knowledge graph overview', false)
  .option('--metrics <list>', 'v0.11: Metrics filter for --org (comma-separated)')
  .option('--format <fmt>', 'v0.11: Output format: text, json (default: text)', 'text')
  .action(async (opts: { change?: string; watch?: boolean; html?: boolean; period?: string; quality?: boolean; team?: boolean; adr?: boolean; memory?: boolean; org?: string[]; knowledge?: boolean; metrics?: string; format?: string }) => {
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
      org: opts.org,
      knowledge: opts.knowledge,
      metrics: opts.metrics,
      format: opts.format as 'text' | 'json' | undefined,
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
// v0.12: --gate evidence, --min-evidence.
program
  .command('verify')
  .description('Run quality gates and produce evidence report')
  .option('--change <name>', 'Change to verify')
  .option('--gate <gate>', 'Specific gate: compile, test, tasks, coverage, evidence')
  .option('--skip <gate>', 'Gate to skip')
  .option('--min-evidence <pct>', 'v0.12: Minimum evidence coverage percentage (default: 50)', parseInt)
  .action(async (opts: { change?: string; gate?: string; skip?: string; minEvidence?: number }) => {
    const exitCode = await runVerify({
      change: opts.change,
      gate: opts.gate,
      skip: opts.skip,
      minEvidence: opts.minEvidence,
    });
    process.exit(exitCode);
  });

// v0.12: audit — evidence coverage audit.
program
  .command('audit')
  .description('v0.12: Evidence coverage audit for memory records')
  .option('--change <name>', 'Change to audit')
  .option('--json', 'Output as JSON', false)
  .option('--pipe', 'Output JSON to stdout (pipe-friendly)', false)
  .action(async (opts: { change?: string; json?: boolean; pipe?: boolean }) => {
    const exitCode = await runAudit({
      change: opts.change,
      json: opts.json,
      pipe: opts.pipe,
    });
    process.exit(exitCode);
  });

// v0.12: trace — follow knowledge links.
program
  .command('trace')
  .description('v0.12: Trace knowledge links forward or backward through memory records')
  .argument('<id>', 'Record ID to trace from')
  .option('--direction <dir>', 'Trace direction: forward (default) or backward', 'forward')
  .option('--impact', 'v0.12 (Experimental): Estimate impact on related records', false)
  .option('--json', 'Output as JSON', false)
  .action(async (id: string, opts: { direction?: string; impact?: boolean; json?: boolean }) => {
    const exitCode = await runTrace({
      id,
      direction: opts.direction as 'forward' | 'backward' | undefined,
      impact: opts.impact,
      json: opts.json,
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
  .option('--dimension <dim>', 'Export specific dimension: changes, metrics, knowledge, workflow-evidence')
  .action(async (opts: { pipe?: boolean; project?: string[]; dimension?: string }) => {
    const exitCode = await runExport({
      pipe: opts.pipe,
      project: opts.project,
      dimension: opts.dimension as 'changes' | 'metrics' | 'knowledge' | 'workflow-evidence' | undefined,
    });
    process.exit(exitCode);
  });

// v0.13: state — lifecycle checkpoint management.
const stateCmd = program
  .command('state')
  .description('v0.13: Lifecycle checkpoint view, set, and recover');

stateCmd
  .command('set')
  .argument('<checkpoint>', 'Target checkpoint: open, design, build, verify, archive')
  .description('Transition to a new lifecycle checkpoint')
  .option('--change <name>', 'Change to operate on')
  .option('--rationale <text>', 'Transition rationale (recorded in Workflow Evidence)')
  .option('--refs <ids>', 'Comma-separated v0.12 EvidenceRecord IDs')
  .action(async (checkpoint: string, opts: { change?: string; rationale?: string; refs?: string }) => {
    const exitCode = await runState({
      command: 'set',
      checkpoint,
      change: opts.change,
      rationale: opts.rationale,
      refs: opts.refs,
      cwd: process.cwd(),
    });
    process.exit(exitCode);
  });

stateCmd
  .command('recover')
  .description('Restore checkpoint from .ivy/state.yaml after restart')
  .option('--change <name>', 'Change to recover')
  .action(async (opts: { change?: string }) => {
    const exitCode = await runState({ command: 'recover', change: opts.change, cwd: process.cwd() });
    process.exit(exitCode);
  });

stateCmd
  .command('show', { isDefault: true })
  .description('Show current lifecycle state')
  .option('--change <name>', 'Filter to a specific change')
  .option('--pending', 'Show pending decision points')
  .action(async (opts: { change?: string; pending?: boolean }) => {
    const exitCode = await runState({ change: opts.change, pending: !!opts.pending, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.13: workflow — preset, evidence, archive management.
const workflowCmd = program
  .command('workflow')
  .description('v0.13: Workflow preset, evidence, and archive commands');

workflowCmd
  .command('start')
  .description('Start a workflow (create state + optional isolate)')
  .argument('[change]', 'Change name to start')
  .option('--isolate', 'Create isolated git worktree', false)
  .action(async (change: string | undefined, opts: { isolate?: boolean }) => {
    const exitCode = await runWorkflow({ subcommand: 'start', change, isolate: opts.isolate, cwd: process.cwd() });
    process.exit(exitCode);
  });

workflowCmd
  .command('status')
  .description('Show current workflow state')
  .option('--change <name>', 'Change to inspect')
  .action(async (opts: { change?: string }) => {
    const exitCode = await runWorkflow({ subcommand: 'status', change: opts.change, cwd: process.cwd() });
    process.exit(exitCode);
  });

workflowCmd
  .command('preset')
  .description('List available workflow presets or auto-detect')
  .option('--detect', 'Auto-detect preset for current change', false)
  .option('--change <name>', 'Change to inspect')
  .action(async (opts: { detect?: boolean; change?: string }) => {
    const exitCode = await runWorkflow({ subcommand: 'preset', detect: opts.detect, change: opts.change, cwd: process.cwd() });
    process.exit(exitCode);
  });

workflowCmd
  .command('evidence')
  .description('Display transition evidence')
  .option('--change <name>', 'Change to inspect')
  .option('--check-archive', 'Check archive readiness', false)
  .action(async (opts: { change?: string; checkArchive?: boolean }) => {
    const exitCode = await runWorkflow({ subcommand: 'evidence', change: opts.change, checkArchive: opts.checkArchive, cwd: process.cwd() });
    process.exit(exitCode);
  });

workflowCmd
  .command('archive')
  .description('Archive a completed change')
  .argument('[change]', 'Change name to archive')
  .option('--clean', 'Clean up worktrees on archive', false)
  .action(async (change: string | undefined, opts: { clean?: boolean }) => {
    const exitCode = await runWorkflow({ subcommand: 'archive', change, clean: opts.clean, cwd: process.cwd() });
    process.exit(exitCode);
  });

workflowCmd
  .command('show', { isDefault: true })
  .description('Show workflow commands help')
  .action(async () => {
    const exitCode = await runWorkflow({ cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.13: explore — read-only exploration mode.
program
  .command('explore')
  .description('v0.13: Read-only exploration mode')
  .action(async () => {
    const exitCode = await runExplore({ cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.14: capability — detect project capabilities
const capabilityCmd = program
  .command('capability')
  .description('v0.14: Capability detection and listing');

capabilityCmd
  .command('detect')
  .description('Detect project tech stack and capabilities')
  .option('--refresh', 'Force re-detection (skip cache)', false)
  .option('--format <type>', 'Output format: text | json', 'text')
  .action(async (opts: { refresh?: boolean; format?: string }) => {
    const exitCode = await runCapability({
      command: 'detect',
      refresh: opts.refresh,
      format: opts.format as 'text' | 'json',
      cwd: process.cwd(),
    });
    process.exit(exitCode);
  });

capabilityCmd
  .command('list')
  .description('List active capabilities')
  .option('--format <type>', 'Output format: text | json', 'text')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runCapability({
      command: 'list',
      format: opts.format as 'text' | 'json',
      cwd: process.cwd(),
    });
    process.exit(exitCode);
  });

// v0.14: capability profile
capabilityCmd
  .command('profile')
  .description('Show verification profile based on tech stack')
  .option('--maturity <level>', 'Maturity level: prototype | development | production', 'development')
  .option('--format <type>', 'Output format: text | json', 'text')
  .action(async (opts: { maturity?: string; format?: string }) => {
    const exitCode = await runCapability({
      command: 'profile',
      maturity: opts.maturity,
      format: opts.format as 'text' | 'json',
      cwd: process.cwd(),
    });
    process.exit(exitCode);
  });

// v0.14: capability health — Capability Health diagnostic
capabilityCmd
  .command('health')
  .description('Assess capability health (diagnostic, no scores)')
  .option('--gaps-only', 'Show gaps only')
  .option('--format <type>', 'Output format: text | json', 'text')
  .action(async (opts: { gapsOnly?: boolean; format?: string }) => {
    const exitCode = await runCapabilityHealth({
      cwd: process.cwd(),
      gapsOnly: opts.gapsOnly,
      format: opts.format as 'text' | 'json',
    });
    process.exit(exitCode);
  });

// v0.14: rules generate|analyze|validate — Rule Generator commands
const rulesGenCmd = program
  .command('rules')
  .description('v0.14: Rule generation and analysis commands');

rulesGenCmd
  .command('generate')
  .description('Generate rules from detected tech stack')
  .option('--format <type>', 'Output format: text | json', 'text')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runRulesGen({ subcommand: 'generate', format: opts.format as 'text' | 'json' });
    process.exit(exitCode);
  });

rulesGenCmd
  .command('analyze')
  .description('Analyze rules for coverage and conflicts')
  .option('--format <type>', 'Output format: text | json', 'text')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runRulesGen({ subcommand: 'analyze', format: opts.format as 'text' | 'json' });
    process.exit(exitCode);
  });

rulesGenCmd
  .command('validate')
  .description('Validate rules against current tech stack')
  .option('--format <type>', 'Output format: text | json', 'text')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runRulesGen({ subcommand: 'validate', format: opts.format as 'text' | 'json' });
    process.exit(exitCode);
  });

// v0.11: knowledge — knowledge linking commands.
const knowledge = program
  .command('knowledge')
  .description('v0.11: Knowledge linking and traversal commands');

knowledge
  .command('link')
  .description('Create a manual link between Memory records')
  .option('--source <id>', 'Source record ID')
  .option('--target <id>', 'Target record ID')
  .option('--relation <type>', 'Link relation: influences, implements, precedes, supersedes, evidences')
  .option('--desc <text>', 'Link description')
  .action(async (opts: { source?: string; target?: string; relation?: string; desc?: string }) => {
    const exitCode = await runKnowledgeLink(opts);
    process.exit(exitCode);
  });

knowledge
  .command('links')
  .argument('[record-id]', 'Record ID to query')
  .description('Query outgoing and incoming links for a record')
  .action(async (recordId?: string) => {
    const exitCode = await runKnowledgeLinks({ recordId });
    process.exit(exitCode);
  });

knowledge
  .command('traverse')
  .argument('<record-id>', 'Starting record ID')
  .description('Traverse knowledge link path')
  .option('--to <type>', 'Target record type: decision, constraint, risk, fact, evidence')
  .action(async (recordId: string, opts: { to?: string }) => {
    const exitCode = await runKnowledgeTraverse({ recordId, to: opts.to });
    process.exit(exitCode);
  });

knowledge
  .command('unlink')
  .argument('<record-id>', 'Record ID containing the link')
  .description('Delete a link from a record')
  .option('--index <n>', 'Link index to remove', parseInt)
  .action(async (recordId: string, opts: { index?: number }) => {
    const exitCode = await runKnowledgeUnlink({ recordId, linkIndex: opts.index });
    process.exit(exitCode);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
