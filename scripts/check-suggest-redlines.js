#!/usr/bin/env node
/**
 * check-suggest-redlines.js — validates §9.9 through §9.12 evolution constraints.
 *
 * §9.9:  All suggestions are advisory-only. No auto-execute mechanism.
 * §9.10: All suggestions carry unique IDs and support feedback closure.
 * §9.11: Git Watch emits file_save events with NO file content.
 * §9.12: Calibration writes to Derived Cache only (never L1).
 *
 * These checks are structural (grep-based) — they detect forbidden patterns,
 * not semantic correctness. Unit tests cover the behavioral guarantees.
 */

import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..', 'src');

let failed = false;
function err(msg) { console.error(`[check-suggest-redlines] ${msg}`); failed = true; }
function ok(msg) { console.log(`[check-suggest-redlines] OK — ${msg}`); }

// ─── §9.9: Advisory-only constraint ───

const SUGGEST_ENGINE = join(srcDir, 'core', 'suggest-engine.ts');
const SUGGEST_CLI = join(srcDir, 'commands', 'suggest.ts');

(function check_99_no_auto_execute() {
  const engine = readFileSync(SUGGEST_ENGINE, 'utf-8');
  const cli = readFileSync(SUGGEST_CLI, 'utf-8');

  // Strip comment-only lines to avoid false positives on compliant declarations
  const engineLines = engine.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  );
  const engineText = engineLines.join('\n');
  const cliLines = cli.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  );
  const cliText = cliLines.join('\n');

  // Forbidden patterns in suggest-engine.ts (non-comment lines)
  const forbiddenEngine = [
    { pattern: /autoExecute|autoApply|autoFix|auto_fix/i, name: 'auto-execute field or function' },
    { pattern: /execSync|spawnSync/, name: 'process execution' },
  ];
  for (const { pattern, name } of forbiddenEngine) {
    if (pattern.test(engineText)) {
      err(`§9.9 VIOLATION: suggest-engine.ts contains forbidden pattern "${name}"`);
    }
  }

  // Forbidden patterns in suggest.ts (non-comment lines)
  const forbiddenCLI = [
    { pattern: /auto.?[Ee]xec(?:ute)?|auto.?[Aa]pply|auto.?[Ff]ix/, name: '--auto-execute CLI flag' },
    { pattern: /--auto\w+/, name: '--auto-* flag (advisory-only)' },
  ];
  for (const { pattern, name } of forbiddenCLI) {
    if (pattern.test(cliText)) {
      err(`§9.9 VIOLATION: suggest.ts contains forbidden pattern "${name}"`);
    }
  }

  // Verify the Suggestion interface has no auto-execute field
  const suggestionMatch = engine.match(/export interface Suggestion \{([^}]+)\}/);
  if (suggestionMatch) {
    const body = suggestionMatch[1];
    if (/auto/i.test(body)) {
      err('§9.9 VIOLATION: Suggestion interface contains an "auto" field (must be advisory-only)');
    }
  }

  ok('§9.9 — no auto-execute patterns found in suggest-engine.ts or suggest.ts');
})();

// ─── §9.10: Unique IDs + feedback closure ───

(function check_910_unique_ids_and_feedback() {
  const engine = readFileSync(SUGGEST_ENGINE, 'utf-8');
  const cli = readFileSync(SUGGEST_CLI, 'utf-8');

  // 1. Suggestion interface must have `id: string`
  if (!/^\s+id:\s+string;/m.test(engine)) {
    err('§9.10 VIOLATION: Suggestion type missing required `id: string` field');
  }

  // 2. generateSuggestionId must exist and produce unique IDs
  if (!engine.includes('function generateSuggestionId')) {
    err('§9.10 VIOLATION: generateSuggestionId function not found in suggest-engine.ts');
  }
  if (!engine.includes('sugg_')) {
    err('§9.10 VIOLATION: suggestion ID format "sugg_<type>_<nn>" not found');
  }

  // 3. --mark-resolved flag must exist
  if (!cli.includes('markResolved') && !cli.includes('mark-resolved')) {
    err('§9.10 VIOLATION: suggest.ts must support --mark-resolved for feedback closure');
  }

  // 4. Feedback actions must be defined
  if (!cli.includes('accepted') || !cli.includes('dismissed') || !cli.includes('ignored')) {
    err('§9.10 VIOLATION: suggest.ts must support feedback actions: accepted, dismissed, ignored');
  }

  ok('§9.10 — unique IDs (generateSuggestionId + sugg_ format) and feedback (--mark-resolved) are present');
})();

// ─── §9.11: Git Watch emits file_save events with NO file content ───

(function check_911_no_file_content() {
  const GIT_WATCH = join(srcDir, 'core', 'git-watch.ts');
  let hasGitWatch = true;
  try { readFileSync(GIT_WATCH); } catch { hasGitWatch = false; }

  if (!hasGitWatch) {
    err('§9.11 VIOLATION: git-watch.ts not found (must implement file_save events without content)');
    return;
  }

  const watch = readFileSync(GIT_WATCH, 'utf-8');

  // Must NOT read file content
  const forbiddenContent = [
    { pattern: /readFile|readFileSync/, name: 'reading file content (forbidden by §9.11)' },
    { pattern: /\.content\b/, name: 'accessing file content property' },
  ];
  for (const { pattern, name } of forbiddenContent) {
    if (pattern.test(watch)) {
      err(`§9.11 VIOLATION: git-watch.ts must not read file content — found "${name}"`);
    }
  }

  // Must have specific metadata fields (not content)
  if (!watch.includes('fileSize') || !watch.includes('commitHash')) {
    err('§9.11 VIOLATION: git-watch.ts must emit fileSize and commitHash (not file content)');
  }

  // Must execute appendRawEvent which handles L1 writes
  if (!watch.includes('appendRawEvent')) {
    err('§9.11 VIOLATION: git-watch.ts must use appendRawEvent for L1 writes');
  }

  ok('§9.11 — git-watch.ts emits file_save events with metadata only (no file content)');
})();

// ─── §9.12: Calibration writes to Derived Cache only (never L1) ───

(function check_912_calibration_only_derived_cache() {
  const CALIBRATOR = join(srcDir, 'core', 'quality-calibrator.ts');

  const calibrator = readFileSync(CALIBRATOR, 'utf-8');

  // Must NOT write to L1 (raw events) — check non-comment lines only
  const calibratorLines = calibrator.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  );
  const calibratorCode = calibratorLines.join('\n');

  const forbiddenL1 = [
    { pattern: /appendRawEvent/, name: 'writing to L1 raw events' },
    { pattern: /events\.jsonl/, name: 'direct events.jsonl write' },
    { pattern: /writeRawEvent/, name: 'raw event write function' },
  ];
  for (const { pattern, name } of forbiddenL1) {
    if (pattern.test(calibratorCode)) {
      err(`§9.12 VIOLATION: quality-calibrator.ts must not modify L1 — found "${name}"`);
    }
  }

  // Must write to Derived Cache path
  if (!calibrator.includes('sessions/cache/') && !calibrator.includes('cache/calibration_profile')) {
    err('§9.12 VIOLATION: quality-calibrator.ts must write to Derived Cache (.ivy/sessions/cache/)');
  }

  // Must not modify L2 (inferred sessions)
  if (calibratorCode.includes('appendInferredEvent')) {
    err('§9.12 VIOLATION: quality-calibrator.ts must not modify L2 (inferred events)');
  }

  ok('§9.12 — quality-calibrator.ts writes to Derived Cache only (no L1/L2 modification)');
})();

// ─── §9.13: Analytics precision — descriptive statistics only, no causal claims ───

(function check_913_no_causal_claims() {
  const ANALYTICS_ADOP = join(srcDir, 'core', 'adoption-engine.ts');
  const ANALYTICS_CLI = join(srcDir, 'commands', 'analytics.ts');

  const adoption = readFileSync(ANALYTICS_ADOP, 'utf-8');
  const cli = readFileSync(ANALYTICS_CLI, 'utf-8');

  const adoptionCode = adoption.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  ).join('\n');

  const cliCode = cli.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  ).join('\n');

  // Must not claim predictive or causal precision (allow "not causal" disclaimer)
  const forbiddenClaims = [
    { pattern: /predictive|prediction/, name: 'predictive claim' },
    { pattern: /causal(?! conclusion)/, name: 'causal claim (only "not causal conclusion" is acceptable)' },
    { pattern: /guaranteed.?accuracy/, name: 'precision guarantee' },
  ];
  for (const { pattern, name } of forbiddenClaims) {
    if (pattern.test(adoptionCode)) {
      err(`§9.13 VIOLATION: adoption-engine.ts contains forbidden pattern "${name}"`);
    }
    if (pattern.test(cliCode)) {
      err(`§9.13 VIOLATION: analytics.ts contains forbidden pattern "${name}"`);
    }
  }

  // Must include "confidence" annotations per §9.13
  if (!adoption.includes('confidence')) {
    err('§9.13 VIOLATION: adoption-engine.ts must include confidence annotations');
  }

  ok('§9.13 — analytics: descriptive statistics only, confidence annotations present');
})();

// ─── §9.14: Override never mutates built-in rules through shared state ───

(function check_914_no_builtin_mutation() {
  const REGISTRY = join(srcDir, 'core', 'rule-registry.ts');
  const registry = readFileSync(REGISTRY, 'utf-8');

  // Must use deepCloneConfig or equivalent clone pattern to prevent shared mutable state
  if (!registry.includes('deepCloneConfig') && !registry.includes('JSON.parse(JSON.stringify')) {
    err('§9.14 VIOLATION: rule-registry.ts must use deep clone pattern to prevent BUILTIN_RULES mutation');
  }

  // Override must write to Derived Cache only
  if (!registry.includes('derived_cache_only') && !registry.includes('cache/rule_manifest')) {
    err('§9.14 VIOLATION: rule-registry.ts must write overrides to Derived Cache only');
  }

  // Must not modify L1 or L2 events
  const registryLines = registry.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  );
  const registryCode = registryLines.join('\n');
  if (registryCode.includes('appendRawEvent')) {
    err('§9.14 VIOLATION: rule-registry.ts must not write L1 events');
  }

  ok('§9.14 — rule-registry.ts: deep clone pattern present, overrides restricted to Derived Cache');
})();

// ─── §9.15: Explain is read-only, never writes events ───

(function check_915_explain_read_only() {
  const EXPLAIN_ENGINE = join(srcDir, 'core', 'explain-engine.ts');
  const EXPLAIN_CLI = join(srcDir, 'commands', 'explain.ts');

  const engine = readFileSync(EXPLAIN_ENGINE, 'utf-8');
  const cli = readFileSync(EXPLAIN_CLI, 'utf-8');

  const engineCode = engine.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  ).join('\n');

  const cliCode = cli.split('\n').filter(
    (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
  ).join('\n');

  // Must not write events
  const forbiddenWrites = [
    { pattern: /appendRawEvent/, name: 'writing L1 raw events' },
    { pattern: /appendInferredEvent/, name: 'writing L2 inferred events' },
    { pattern: /events\.jsonl/, name: 'direct events.jsonl write' },
    { pattern: /writeFile|writeFileSync/, name: 'file write operation' },
  ];
  for (const { pattern, name } of forbiddenWrites) {
    if (pattern.test(engineCode)) {
      err(`§9.15 VIOLATION: explain-engine.ts must be read-only — found "${name}"`);
    }
    if (pattern.test(cliCode)) {
      err(`§9.15 VIOLATION: explain.ts must be read-only — found "${name}"`);
    }
  }

  ok('§9.15 — explain-engine.ts and explain.ts: read-only, no event writes');
})();

// ─── Summary ───

if (failed) process.exit(1);
console.log('[check-suggest-redlines] PASS — §9.9 and §9.10 constraints satisfied');
