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
import { runRulesGen, type RulesGenOptions } from '../commands/rules-gen.js';
import { runRules, type RulesOptions } from '../commands/rules.js';
import { runArchive } from '../commands/archive.js';
import { runVerify } from '../commands/verify.js';
import { runPropose, runApply } from '../commands/propose-apply.js';
import {
  runWorktreeCreate,
  runWorktreeList,
  runWorktreeCleanup,
  runWorktreeCleanupAll,
  runWorktreeMerge,
  runWorktreeStatus,
} from '../commands/worktree.js';
import {
  runDispatch,
  runDispatchStatus,
  runDispatchSyncStatus,
} from '../commands/dispatch.js';
import { runFingerprint } from '../commands/fingerprint.js';
import { runRelease } from '../commands/release.js';
import { runAudit } from '../commands/audit.js';
import { runTrace } from '../commands/trace.js';
import { runExport } from '../commands/export.js';
import { runState, type StateOptions } from '../commands/state.js';
import { runWorkflow, type WorkflowOptions } from '../commands/workflow.js';
import { runCapability, type CapabilityOptions } from '../commands/capability.js';
import { runCapabilityVerify } from '../commands/capability-verify.js';
import { runGuardValidate, runGuard } from '../commands/guard.js';
import { runHandoff, type HandoffOptions } from '../commands/handoff.js';
import { runNext } from '../commands/next.js';
import { runSync } from '../commands/sync.js';
import { runAssessCommand } from '../commands/assess.js';
import { runSkillList } from '../commands/skill-list.js';
import { runCouncilAsk, runCouncilList, runCouncilRegister } from '../commands/council.js';
import { runFeedback } from '../commands/feedback.js';
import { runRulesAudit } from '../commands/rules-audit.js';
import { runExplore } from '../commands/explore.js';
import {
  runKnowledgeLink,
  runKnowledgeLinks,
  runKnowledgeTraverse,
  runKnowledgeUnlink,
} from '../commands/knowledge.js';
import { runMemory, type MemoryOptions } from '../commands/memory.js';
import { runRoleShow, runRoleList, runRoleSet } from '../commands/role.js';
import { runPipelineStart, runPipelineStatus, runPipelineComplete, runPipelineBlock, runPipelineRetry } from '../commands/pipeline.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const program = new Command();

program
  .name('ivy')
  .description('A Workflow Enforcer for AI Coding Agents')
  .version(version);

program
  .command('init')
  .description('Bootstrap IvyFlow in the current project with interactive wizard')
  .option('--quick', 'Quick mode: skip wizard, auto-select recommended packs + detected platforms')
  .option('--standard', 'Standard mode: interactive 6-step wizard (default)')
  .option('--enterprise', 'Standard mode (enterprise alias, no separate behavior)')
  .option('--yes', 'Accept all defaults (project scope, recommended packs, detected platforms)')
  .option('--all', 'Install everything (all capability packs + all detected platforms)')
  .option('--overwrite', 'Overwrite existing IvyFlow files', false)
  .option('--skip-openspec', 'Skip OpenSpec installation step (offline)', false)
  .option('--platforms <ids>', 'Comma-separated platform ids (override detection)')
  .action(async (opts: { quick?: boolean; standard?: boolean; enterprise?: boolean; yes?: boolean; all?: boolean; overwrite?: boolean; skipOpenspec?: boolean; platforms?: string }) => {
    const mode = opts.enterprise ? 'standard' : opts.quick ? 'quick' : 'standard';
    const exitCode = await runInit({
      mode,
      overwrite: opts.overwrite,
      skipOpenSpec: opts.skipOpenspec,
      platforms: opts.platforms?.split(',').map((s) => s.trim()).filter(Boolean),
      yes: opts.yes,
      all: opts.all,
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
  .action(async (opts: Record<string, unknown>) => {
    const exitCode = await runDoctor(opts as Parameters<typeof runDoctor>[0]);
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
// v0.15: --demo, --explain, --trend flags.
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
  .option('--demo', 'v0.15: Show demo analytics with built-in sample data', false)
  .option('--explain', 'v0.15: Show data provenance annotations with line-level detail', false)
  .option('--trend', 'v0.15: Show adoption trend over time periods', false)
  .option('--provenance', 'Use provenance data source (Phase 0 Origin events)', false)
  .option('--value', 'Phase 2B: Show Value Index', false)
  .option('--csi', 'Phase 2B: Show Context Sufficiency Index', false)
  .option('--feedback', 'Phase 2B: Show Human Feedback Loop', false)
  .action(async (opts: { change?: string; project?: boolean; period?: string; enable?: boolean; disable?: boolean; json?: boolean; confidence?: boolean; demo?: boolean; explain?: boolean; trend?: boolean; provenance?: boolean; value?: boolean; csi?: boolean; feedback?: boolean }) => {
    const period = opts.period === '90d' ? '90d' : opts.period === '30d' ? '30d' : '7d';
    const exitCode = await runAnalytics({
      change: opts.change,
      project: opts.project,
      period,
      enable: opts.enable,
      disable: opts.disable,
      json: opts.json,
      confidence: opts.confidence,
      demo: opts.demo,
      explain: opts.explain,
      trend: opts.trend,
      provenance: opts.provenance,
      value: opts.value,
      csi: opts.csi,
      feedback: opts.feedback,
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
  .option('--demo', 'v0.15: Org Intelligence demo mode (built-in sample data)', false)
  .option('--value', 'Phase 2B: Show Value Index panel', false)
  .option('--csi', 'Phase 2B: Show Context Sufficiency Index panel', false)
  .option('--feedback', 'Phase 2B: Show Feedback Loop panel', false)
  .option('--output <path>', 'Output file path (for --format html)')
  .action(async (opts: { change?: string; watch?: boolean; html?: boolean; period?: string; quality?: boolean; team?: boolean; adr?: boolean; memory?: boolean; org?: string[]; knowledge?: boolean; metrics?: string; format?: string; demo?: boolean; value?: boolean; csi?: boolean; feedback?: boolean; output?: string }) => {
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
      demo: opts.demo,
      value: opts.value,
      csi: opts.csi,
      feedback: opts.feedback,
      output: opts.output,
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

// v0.15: rules — rule management (list/info/override/remove), generation, analysis, validation, and audit.
const rulesCmd = program
  .command('rules')
  .description('v0.15: Rule management — list, generate, analyze, validate, and audit rules');

// v0.7: rules list/info/override/remove
rulesCmd
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
  .option('--cleanup-worktree', 'Clean up worktree on archive', false)
  .action(async (opts: { change?: string; action?: string; message?: string; extract?: boolean; force?: boolean; adr?: boolean; cleanupWorktree?: boolean }) => {
    const exitCode = await runArchive({
      change: opts.change,
      action: opts.action,
      message: opts.message,
      noExtract: !opts.extract,
      force: opts.force,
      adr: opts.adr,
      cleanupWorktree: opts.cleanupWorktree,
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
  .argument('<checkpoint>', 'Target checkpoint to transition to (open/design/build/verify/archive)')
  .argument('[value]', 'When present, switches to field mode: set workflow field <checkpoint> to <value>')
  .description('Transition to a checkpoint, OR set a workflow field: `ivy state set <field> <value>`')
  .option('--change <name>', 'Change to operate on')
  .option('--rationale <text>', 'Transition rationale (recorded in Workflow Evidence)')
  .option('--refs <ids>', 'Comma-separated v0.12 EvidenceRecord IDs')
  .option('--workflow <preset>', 'S3: declare workflow preset (full|hotfix|tweak) when opening a change')
  .action(async (checkpoint: string, value: string | undefined, opts: { change?: string; rationale?: string; refs?: string; workflow?: string }) => {
    const exitCode = await runState({
      command: 'set',
      checkpoint,
      value,
      change: opts.change,
      rationale: opts.rationale,
      refs: opts.refs,
      workflow: opts.workflow,
      cwd: process.cwd(),
    });
    process.exit(exitCode);
  });

stateCmd
  .command('get')
  .argument('<field>', 'Workflow field to read (e.g. isolation, build_mode, branch_status)')
  .description('Read a workflow field from the current change state')
  .option('--change <name>', 'Change to operate on')
  .action(async (field: string, opts: { change?: string }) => {
    const exitCode = await runState({ command: 'get', field, change: opts.change, cwd: process.cwd() });
    process.exit(exitCode);
  });

stateCmd
  .command('recover')
  .description('Restore checkpoint from the change state file (.ivy.yaml) after restart')
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

// v0.15: capability — capability detection and listing.
const capabilityCmd = program
  .command('capability')
  .description('v0.15: Capability detection, listing, health, and profile');

capabilityCmd
  .command('detect')
  .description('Detect project tech stack and capabilities')
  .option('--refresh', 'Force re-detection', false)
  .option('--format <fmt>', 'Output format: text (default) or json')
  .action(async (opts: { refresh?: boolean; format?: string }) => {
    const exitCode = await runCapability({ subcommand: 'detect', refresh: opts.refresh, format: opts.format, cwd: process.cwd() });
    process.exit(exitCode);
  });

capabilityCmd
  .command('list')
  .description('List detected capabilities')
  .option('--recommended', 'Show recommended skills', false)
  .action(async (opts: { recommended?: boolean }) => {
    const exitCode = await runCapability({ subcommand: 'list', recommended: opts.recommended, cwd: process.cwd() });
    process.exit(exitCode);
  });

capabilityCmd
  .command('health')
  .description('Show capability health assessment (3D: coverage, drift, risk)')
  .option('--gaps-only', 'Show gaps only', false)
  .option('--recommendations', 'Show recommendations for gaps (v0.16)', false)
  .option('--format <fmt>', 'Output format: text (default) or json')
  .action(async (opts: { gapsOnly?: boolean; recommendations?: boolean; format?: string }) => {
    const exitCode = await runCapability({ subcommand: 'health', gapsOnly: opts.gapsOnly, recommendations: opts.recommendations, format: opts.format as 'text' | 'json' | undefined, cwd: process.cwd() });
    process.exit(exitCode);
  });

capabilityCmd
  .command('profile')
  .description('Show verification profile based on detected tech stack')
  .option('--format <fmt>', 'Output format: text (default) or json')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runCapability({ subcommand: 'profile', format: opts.format as 'text' | 'json' | undefined, cwd: process.cwd() });
    process.exit(exitCode);
  });

capabilityCmd
  .command('verify')
  .description('Capability-lifecycle integration check (advisory)')
  .action(async () => {
    const exitCode = await runCapabilityVerify({ cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.15: rules subcommands — generate, analyze, validate.

rulesCmd
  .command('generate')
  .description('Generate rules from detected tech stack')
  .option('--format <fmt>', 'Output format: text (default) or json')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runRulesGen({ subcommand: 'generate', format: opts.format as 'text' | 'json' | undefined, cwd: process.cwd() });
    process.exit(exitCode);
  });

rulesCmd
  .command('analyze')
  .description('Analyze generated rules (count, coverage, conflicts)')
  .option('--format <fmt>', 'Output format: text (default) or json')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runRulesGen({ subcommand: 'analyze', format: opts.format as 'text' | 'json' | undefined, cwd: process.cwd() });
    process.exit(exitCode);
  });

rulesCmd
  .command('validate')
  .description('Validate rules against current tech stack')
  .option('--format <fmt>', 'Output format: text (default) or json')
  .action(async (opts: { format?: string }) => {
    const exitCode = await runRulesGen({ subcommand: 'validate', format: opts.format as 'text' | 'json' | undefined, cwd: process.cwd() });
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

// v0.15: memory — convergence memory commands.
const memoryCmd = program
  .command('memory')
  .description('v0.15: Memory management (status, enable, GC)');

memoryCmd
  .command('status')
  .description('Show enhanced memory system status')
  .action(async () => {
    const exitCode = await runMemory({ subcommand: 'status' });
    process.exit(exitCode);
  });

memoryCmd
  .command('enable')
  .argument('<feature>', 'Feature to enable (vector-search, memory-linking, knowledge-graph, procedural-memory)')
  .description('Enable an extended memory feature')
  .action(async (feature: string) => {
    const exitCode = await runMemory({ subcommand: 'enable', feature });
    process.exit(exitCode);
  });

memoryCmd
  .command('gc')
  .description('Run memory garbage collection')
  .option('--dry-run', 'Show what would be deleted without deleting', false)
  .action(async (opts: { dryRun?: boolean }) => {
    const exitCode = await runMemory({ subcommand: 'gc', dryRun: opts.dryRun });
    process.exit(exitCode);
  });

// v0.29/v0.32: council — memory council commands.
const councilCmd = program
  .command('council')
  .description('v0.29/v0.32: Memory council — single-project and cross-project analysis');

councilCmd
  .command('ask')
  .argument('<question>', 'The question to ask the council')
  .description('Ask the council a question (single-project or --cross-project)')
  .option('--format <fmt>', 'Output format: yaml, json, text (default: yaml for single, text for cross-project)')
  .option('--perspectives <ids>', 'Comma-separated perspective IDs')
  .option('--output <path>', 'Output file path')
  .option('--min-conf <num>', 'Minimum confidence filter')
  .option('--cross-project', 'Enable cross-project mode', false)
  .option('--org', 'Alias for --cross-project', false)
  .option('--concurrency <n>', 'Override adaptive concurrency', parseInt)
  .action(async (question: string, opts: { format?: string; perspectives?: string; output?: string; minConf?: string; crossProject?: boolean; org?: boolean; concurrency?: number }) => {
    const exitCode = await runCouncilAsk(question, {
      format: opts.format,
      perspectives: opts.perspectives,
      output: opts.output,
      minConf: opts.minConf,
      crossProject: opts.crossProject,
      org: opts.org,
      concurrency: opts.concurrency,
    });
    process.exit(exitCode);
  });

councilCmd
  .command('list')
  .description('List all registered perspectives')
  .option('--json', 'Output as JSON', false)
  .action(async (opts: { json?: boolean }) => {
    const exitCode = await runCouncilList({ json: opts.json });
    process.exit(exitCode);
  });

councilCmd
  .command('register')
  .description('Register a custom perspective (v1.0 feature)')
  .action(async () => {
    const exitCode = await runCouncilRegister();
    process.exit(exitCode);
  });

// v0.16: feedback — runtime signal statistics and insights.
program
  .command('feedback')
  .description('v0.16: Runtime signal statistics and rule usage insights')
  .argument('[stats|history|cleanup]', 'Subcommand (default: stats)')
  .option('--format <fmt>', 'Output format: text (default) or json')
  .option('--days <n>', 'Analysis window in days (default: 30)', '30')
  .action(async (subcommand?: string, opts: { format?: string; days?: string } = {}) => {
    const exitCode = await runFeedback({
      subcommand: subcommand as 'stats' | 'history' | 'cleanup' | undefined,
      format: opts.format as 'text' | 'json' | undefined,
      days: opts.days ? parseInt(opts.days, 10) : 30,
      cwd: process.cwd(),
    });
    process.exit(exitCode);
  });

// v0.15: guard — triple-defense guard layer status and validation.
// v0.33: guard — hard-blocking phase guard with --apply auto-transition.
const guardCmd = program
  .command('guard')
  .description('v0.33: Hard-blocking phase guard (--apply to auto-transition)');

guardCmd
  .command('validate', { isDefault: true })
  .description('v0.15: Guard layer status and validation (--demo for scenario walkthrough)')
  .option('--demo', 'Show 3 hard-coded guard scenarios', false)
  .action(async (opts: { demo?: boolean }) => {
    const exitCode = await runGuardValidate({ demo: opts.demo });
    process.exit(exitCode);
  });

guardCmd
  .command('run')
  .argument('<phase>', 'Phase to guard: open, design, build, verify, archive')
  .description('Run hard-blocking phase guard checks')
  .option('--apply', 'Auto-transition to next phase on pass', false)
  .option('--change <name>', 'Change to operate on')
  .action(async (phase: string, opts: { apply?: boolean; change?: string }) => {
    const exitCode = await runGuard({ phase, apply: opts.apply, change: opts.change, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.16: rules audit — rule usage insights.
rulesCmd
  .command('audit')
  .description('v0.16: Rule usage insights (read-only)')
  .argument('[rule-id]', 'Specific rule ID to inspect')
  .option('--format <fmt>', 'Output format: text (default) or json')
  .option('--days <n>', 'Analysis window in days (default: 30)', '30')
  .action(async (ruleId?: string, opts: { format?: string; days?: string } = {}) => {
    const exitCode = await runRulesAudit({
      ruleId,
      format: opts.format as 'text' | 'json' | undefined,
      days: opts.days ? parseInt(opts.days, 10) : 30,
      cwd: process.cwd(),
    });
    process.exit(exitCode);
  });

// v0.19: worktree — git worktree auto-management.
const worktreeCmd = program
  .command('worktree')
  .description('v0.19: Git worktree auto-management');

worktreeCmd
  .command('create')
  .argument('<name>', 'Change name')
  .description('Create a worktree for a change')
  .option('--branch <name>', 'Branch name (default: ivyflow-wt-<name>)')
  .action(async (name: string, opts: { branch?: string }) => {
    const exitCode = await runWorktreeCreate(name, { branch: opts.branch, cwd: process.cwd() });
    process.exit(exitCode);
  });

worktreeCmd
  .command('list')
  .description('List all IvyFlow-managed worktrees')
  .action(async () => {
    const exitCode = await runWorktreeList({ cwd: process.cwd() });
    process.exit(exitCode);
  });

worktreeCmd
  .command('cleanup')
  .argument('<name>', 'Change name')
  .description('Clean up a worktree')
  .action(async (name: string) => {
    const exitCode = await runWorktreeCleanup(name, { cwd: process.cwd() });
    process.exit(exitCode);
  });

worktreeCmd
  .command('cleanup-all')
  .description('Clean up all completed worktrees')
  .action(async () => {
    const exitCode = await runWorktreeCleanupAll({ cwd: process.cwd() });
    process.exit(exitCode);
  });

worktreeCmd
  .command('merge')
  .argument('<name>', 'Change name')
  .description('Merge worktree branch to origin')
  .option('--strategy <s>', 'Merge strategy: merge (default) or squash')
  .action(async (name: string, opts: { strategy?: string }) => {
    const exitCode = await runWorktreeMerge(name, { strategy: opts.strategy, cwd: process.cwd() });
    process.exit(exitCode);
  });

worktreeCmd
  .command('status')
  .description('Show worktree status overview')
  .action(async () => {
    const exitCode = await runWorktreeStatus({ cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.19: dispatch — multi-agent task dispatching.
const dispatchCmd = program
  .command('dispatch')
  .description('v0.19: Multi-agent task dispatch');

dispatchCmd
  .command('run')
  .description('Dispatch tasks from tasks.md')
  .option('--tasks <path>', 'Path to tasks.md')
  .option('--parallel <n>', 'Max parallel agents (default: 4)', parseInt)
  .option('--recommend', 'Recommend runnable tasks without executing')
  .option('--recommend-phase', 'Recommend next phase after dispatch completes')
  .action(async (opts: { tasks?: string; parallel?: number; recommend?: boolean; recommendPhase?: boolean }) => {
    const exitCode = await runDispatch({
      tasks: opts.tasks,
      parallel: opts.parallel,
      cwd: process.cwd(),
      recommend: opts.recommend,
      recommendPhase: opts.recommendPhase,
    });
    process.exit(exitCode);
  });

dispatchCmd
  .command('status', { isDefault: true })
  .description('Show task execution status')
  .option('--tasks <path>', 'Path to tasks.md')
  .action(async (opts: { tasks?: string }) => {
    const exitCode = await runDispatchStatus({ tasks: opts.tasks, cwd: process.cwd() });
    process.exit(exitCode);
  });

dispatchCmd
  .command('sync-status')
  .description('Sync task status with user confirmation')
  .option('--apply', 'Apply pending status updates to tasks.md')
  .option('--tasks <path>', 'Path to tasks.md')
  .action(async (opts: { apply?: boolean; tasks?: string }) => {
    const exitCode = await runDispatchSyncStatus({ apply: opts.apply, tasks: opts.tasks, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.19: propose — proposal-driven development entry point.
program
  .command('propose')
  .argument('<name>', 'Change name')
  .option('--parallel', 'Generate artifacts in parallel where dependencies allow')
  .description('v0.19: Create a proposal with worktree + recommend DESIGN phase')
  .action(async (name: string, opts: { parallel?: boolean }) => {
    const exitCode = await runPropose(name, { cwd: process.cwd(), parallel: opts.parallel });
    process.exit(exitCode);
  });

// v0.19: apply — implementation entry point.
program
  .command('apply')
  .argument('<name>', 'Change name')
  .description('v0.19: Apply a change with recommend VERIFY phase')
  .action(async (name: string) => {
    const exitCode = await runApply(name, { cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.33: handoff — context package generation for phase transitions.
program
  .command('handoff')
  .argument('<change-name>', 'Change name')
  .argument('<phase>', 'Phase: design')
  .description('v0.33: Generate context handoff package')
  .option('--write', 'Write handoff files', false)
  .option('--full', 'Include full file contents (default: compact)', false)
  .option('--hash-only', 'Only compute and print context hash', false)
  .action(async (changeName: string, phase: string, opts: { write?: boolean; full?: boolean; hashOnly?: boolean }) => {
    const exitCode = await runHandoff({ changeName, phase, write: opts.write, full: opts.full, hashOnly: opts.hashOnly, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.33: next — resolve next skill after phase transition.
program
  .command('next')
  .argument('<change-name>', 'Change name')
  .description('v0.33: Resolve next skill to load')
  .action(async (changeName: string) => {
    const exitCode = await runNext({ changeName, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.33: sync — synchronize .ai-rules/ to platform-specific formats.
program
  .command('sync')
  .description('v0.33: Sync .ai-rules/ to platform formats (Claude Code, Cursor, CodeBuddy)')
  .option('--platforms <ids>', 'Comma-separated platform IDs (default: all)')
  .option('--apply', 'Write converted files (default: dry-run)', false)
  .action(async (opts: { platforms?: string; apply?: boolean }) => {
    const exitCode = await runSync({ platforms: opts.platforms, apply: opts.apply, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.33: assess — five-dimension legacy project assessment.
program
  .command('assess')
  .description('v0.33: Five-dimension legacy project assessment')
  .option('--output <path>', 'Write assessment report to file')
  .action(async (opts: { output?: string }) => {
    const exitCode = await runAssessCommand({ output: opts.output, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.33: skill list — skill registry management.
program
  .command('skill')
  .description('v0.33: Skill registry management')
  .argument('[list|detail]', 'Subcommand (default: list)')
  .option('--detail <name>', 'Show detailed info for a specific skill')
  .action(async (subcommand?: string, opts?: { detail?: string }) => {
    const exitCode = await runSkillList({ detail: opts?.detail, cwd: process.cwd() });
    process.exit(exitCode);
  });

// v0.16: pipeline — multi-role pipeline orchestration.
const pipelineCmd = program
  .command('pipeline')
  .description('v0.16: Multi-role pipeline — orchestrate PM → Developer → QA → DevOps');

pipelineCmd
  .command('start <name>')
  .description('Create a new pipeline')
  .action(async (name: string) => {
    const exitCode = await runPipelineStart(name, process.cwd());
    process.exit(exitCode);
  });

pipelineCmd
  .command('status')
  .description('Show pipeline status')
  .action(async () => {
    const exitCode = await runPipelineStatus(process.cwd());
    process.exit(exitCode);
  });

pipelineCmd
  .command('complete <stage>')
  .description('Mark a stage as completed')
  .option('--choice <choice>', 'Branch choice for conditional edges')
  .action(async (stage: string, opts: { choice?: string }) => {
    const exitCode = await runPipelineComplete(stage, opts.choice, process.cwd());
    process.exit(exitCode);
  });

pipelineCmd
  .command('block <stage>')
  .description('Block a stage')
  .option('--reason <reason>', 'Reason for blocking', '未指定原因')
  .action(async (stage: string, opts: { reason?: string }) => {
    const exitCode = await runPipelineBlock(stage, opts.reason ?? '未指定原因', process.cwd());
    process.exit(exitCode);
  });

pipelineCmd
  .command('retry <stage>')
  .description('Retry a blocked or failed stage')
  .action(async (stage: string) => {
    const exitCode = await runPipelineRetry(stage, process.cwd());
    process.exit(exitCode);
  });

// v0.16: role — role management commands.
const roleCmd = program
  .command('role')
  .description('v0.16: Role management — switch between PM, Developer, QA, Architect, DevOps');

roleCmd
  .command('show')
  .description('Show current role')
  .action(async () => {
    const exitCode = await runRoleShow(process.cwd());
    process.exit(exitCode);
  });

roleCmd
  .command('list')
  .description('List available roles')
  .action(async () => {
    const exitCode = await runRoleList();
    process.exit(exitCode);
  });

roleCmd
  .command('set <role>')
  .description('Switch to a different role')
  .action(async (role: string) => {
    const exitCode = await runRoleSet(role, process.cwd());
    process.exit(exitCode);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
