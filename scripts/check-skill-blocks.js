#!/usr/bin/env node
/**
 * check-skill-blocks.js — enforces §9.3 evolution constraint:
 *   SKILL.md must contain exactly 4 HTML-marked blocks (ROUTER /
 *   CONSTRAINTS / VARIABLES / REFERENCES). Each block ≤ 50 lines.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(__dirname, '..', 'assets', 'skills', 'ivy', 'SKILL.md');

const expected = ['ROUTER', 'CONSTRAINTS', 'VARIABLES', 'REFERENCES'];
const MAX_LINES = 50;

const text = readFileSync(skillPath, 'utf-8');
const lines = text.split('\n');

let failed = false;
for (let i = 0; i < expected.length; i++) {
  const name = expected[i];
  const startIdx = lines.findIndex((l) => l.includes(`<!-- BLOCK ${i + 1}: ${name}`));
  const endIdx = lines.findIndex((l) => l.includes(`<!-- BLOCK ${i + 1} END`));
  if (startIdx === -1 || endIdx === -1) {
    console.error(`[check-skill-blocks] MISSING block ${i + 1} (${name})`);
    failed = true;
    continue;
  }
  const len = endIdx - startIdx + 1;
  if (len > MAX_LINES) {
    console.error(`[check-skill-blocks] BLOCK ${i + 1} (${name}) is ${len} lines, max ${MAX_LINES}`);
    failed = true;
  } else {
    console.log(`[check-skill-blocks] OK — BLOCK ${i + 1} (${name}): ${len} lines`);
  }
}

// Also forbid a 5th block.
const fifth = lines.findIndex((l) => l.match(/<!-- BLOCK 5:/));
if (fifth !== -1) {
  console.error('[check-skill-blocks] FORBIDDEN — found BLOCK 5 marker (max 4 blocks)');
  failed = true;
}

if (failed) process.exit(1);
console.log('[check-skill-blocks] PASS — SKILL.md 4 blocks within constraints');
