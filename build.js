#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const runTsc = (args = []) => {
  const tscPath = require.resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [tscPath, ...args], { stdio: 'inherit' });
};

console.log('Building IvyFlow...\n');

if (existsSync('dist')) {
  console.log('Cleaning dist directory...');
  rmSync('dist', { recursive: true, force: true });
}

console.log('Syncing phase list to assets/roles/developer/rules/ivy-phase-guard.md...');
execFileSync(process.execPath, ['scripts/sync-phases.js'], { stdio: 'inherit' });

console.log('Validating manifest.json schema...');
execFileSync(process.execPath, ['scripts/check-manifest.js'], { stdio: 'inherit' });

console.log('Validating SKILL.md structure (frontmatter + size invariants)...');
execFileSync(process.execPath, ['scripts/check-skill-blocks.js'], { stdio: 'inherit' });

console.log('Validating §9.9/§9.10/§9.11/§9.12 evolution constraints...');
execFileSync(process.execPath, ['scripts/check-suggest-redlines.js'], { stdio: 'inherit' });

console.log('Compiling TypeScript...');
try {
  runTsc(['--version']);
  runTsc();
  console.log('\nBuild completed successfully!');
} catch (error) {
  console.error('\nBuild failed!');
  process.exit(1);
}
