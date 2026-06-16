#!/usr/bin/env node
/**
 * Sync phase list from src/core/phase-machine.ts → assets/rules/ivy-phase-guard.md.
 *
 * Modes:
 *   node scripts/sync-phases.js          # rewrite the marked block in place
 *   node scripts/sync-phases.js --check  # exit non-zero if file would change (CI gate)
 *
 * Parses the IvyPhase enum from phase-machine.ts via regex (no TS compilation
 * dependency) so this script can run before `npm run build`.
 */

import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const ENUM_SOURCE = path.join(repoRoot, 'src', 'core', 'phase-machine.ts');
const RULE_FILE = path.join(repoRoot, 'assets', 'rules', 'ivy-phase-guard.md');

const BEGIN_MARK = '<!-- DO NOT EDIT: synced from src/core/phase-machine.ts -->';
const END_MARK = '<!-- END DO NOT EDIT -->';

function extractPhases(source) {
  const enumMatch = source.match(/export\s+enum\s+IvyPhase\s*\{([^}]+)\}/);
  if (!enumMatch) {
    throw new Error('Could not locate `export enum IvyPhase { ... }` in phase-machine.ts');
  }
  const body = enumMatch[1];
  const memberPattern = /[A-Z_]+\s*=\s*'([a-z]+)'/g;
  const phases = [];
  let m;
  while ((m = memberPattern.exec(body)) !== null) {
    phases.push(m[1]);
  }
  if (phases.length === 0) {
    throw new Error('IvyPhase enum has no string-valued members');
  }
  return phases;
}

function buildBlock(phases) {
  const bullets = phases.map((p) => `- \`${p}\``).join('\n');
  return `${BEGIN_MARK}\n${bullets}\n${END_MARK}`;
}

function rewrite(content, newBlock) {
  const beginIdx = content.indexOf(BEGIN_MARK);
  const endIdx = content.indexOf(END_MARK);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`Marker block not found in ${RULE_FILE}`);
  }
  const before = content.slice(0, beginIdx);
  const after = content.slice(endIdx + END_MARK.length);
  return before + newBlock + after;
}

function main() {
  const checkOnly = process.argv.includes('--check');

  const source = readFileSync(ENUM_SOURCE, 'utf-8');
  const phases = extractPhases(source);
  const block = buildBlock(phases);

  const ruleContent = readFileSync(RULE_FILE, 'utf-8');
  const updated = rewrite(ruleContent, block);

  if (updated === ruleContent) {
    console.log(`[sync-phases] OK — ${phases.length} phases already in sync (${phases.join(', ')})`);
    return;
  }

  if (checkOnly) {
    console.error('[sync-phases] DRIFT DETECTED — assets/rules/ivy-phase-guard.md is out of sync');
    console.error(`             Expected phases: ${phases.join(', ')}`);
    console.error('             Run `npm run sync-phases` and commit the result.');
    process.exit(1);
  }

  writeFileSync(RULE_FILE, updated, 'utf-8');
  console.log(`[sync-phases] Updated ${path.relative(repoRoot, RULE_FILE)} (${phases.join(', ')})`);
}

main();
