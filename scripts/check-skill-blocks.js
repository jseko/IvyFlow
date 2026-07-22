#!/usr/bin/env node
/**
 * check-skill-blocks.js — SKILL.md structural sanity gate.
 *
 * The v0.15 multi-role refactor retired the old §9.3 layout (a single
 * ivy/SKILL.md split into 4 HTML-marked blocks). Today every SKILL.md
 * under assets/ uses plain YAML frontmatter + markdown, including the
 * per-phase skills and the role-level dispatchers.
 *
 * This gate enforces the invariants that survived the refactor:
 *   - file is non-empty
 *   - file stays within a sane line budget (single-file readability, §9.3 spirit)
 *   - IF a YAML frontmatter block is present, it MUST declare non-empty
 *     `name` and `description` (the fields the skill registry relies on)
 *
 * Structural only (not semantic) — behavioral guarantees live in unit tests.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '..', 'assets');

// Single-file readability budget. Longest real SKILL.md today is ~117 lines,
// so 400 leaves headroom without permitting unbounded growth.
const MAX_LINES = 400;

let failed = false;
function err(msg) { console.error(`[check-skill-blocks] ${msg}`); failed = true; }

function collectSkillFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) collectSkillFiles(full, out);
    else if (e.name === 'SKILL.md') out.push(full);
  }
  return out;
}

function checkFrontmatter(text, relPath) {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return; // no frontmatter — allowed (e.g. capability docs)
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) {
    err(`${relPath}: frontmatter block is not terminated with '---'`);
    return;
  }
  const fm = lines.slice(1, end).join('\n');
  if (!/^\s*name:\s*\S+/m.test(fm)) {
    err(`${relPath}: frontmatter is missing a non-empty \`name\``);
  }
  if (!/^\s*description:\s*\S+/m.test(fm)) {
    err(`${relPath}: frontmatter is missing a non-empty \`description\``);
  }
}

const files = collectSkillFiles(assetsDir);
if (files.length === 0) {
  err('no SKILL.md found under assets/');
}

let checked = 0;
for (const f of files) {
  const rel = relative(assetsDir, f);
  const text = readFileSync(f, 'utf-8');
  const lineCount = text.split('\n').length;
  if (lineCount === 0) {
    err(`${rel}: empty file`);
    continue;
  }
  if (lineCount > MAX_LINES) {
    err(`${rel}: ${lineCount} lines exceeds MAX_LINES=${MAX_LINES}`);
    continue;
  }
  checkFrontmatter(text, rel);
  checked++;
}

if (failed) process.exit(1);
console.log(
  `[check-skill-blocks] PASS — ${checked} SKILL.md validated ` +
  `(non-empty, ≤${MAX_LINES} lines, frontmatter name/description when present)`,
);
