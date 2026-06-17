#!/usr/bin/env node
/**
 * check-manifest.js — validates assets/manifest.json schema (v2):
 *   - schemaVersion === 2
 *   - skills[] non-empty, all paths exist
 *   - rules[] all paths exist
 *   - hooks: known renderers + assets exist
 */

import { readFileSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '..', 'assets');
const manifestPath = join(assetsDir, 'manifest.json');

const m = JSON.parse(readFileSync(manifestPath, 'utf-8'));

let failed = false;
function err(msg) { console.error(`[check-manifest] ${msg}`); failed = true; }

if (m.schemaVersion !== 2) err(`schemaVersion must be 2, got ${m.schemaVersion}`);
if (!Array.isArray(m.skills) || m.skills.length === 0) err('skills[] must be non-empty');
for (const s of m.skills ?? []) {
  try { statSync(join(assetsDir, 'skills', s)); }
  catch { err(`skill not found: ${s}`); }
}
for (const r of m.rules ?? []) {
  try { statSync(join(assetsDir, 'rules', r)); }
  catch { err(`rule not found: ${r}`); }
}

const knownStaticAssets = ['ivy-git-prepush.sh'];
const knownRenderers = ['windsurf-json'];
for (const [name, def] of Object.entries(m.hooks ?? {})) {
  if (def.type === 'static') {
    if (!knownStaticAssets.includes(def.asset)) err(`unknown static asset: ${def.asset}`);
    try { statSync(join(assetsDir, 'hooks', def.asset)); }
    catch { err(`hook asset not found: ${def.asset}`); }
  } else if (def.type === 'rendered') {
    if (!knownRenderers.includes(def.renderer)) err(`unknown renderer: ${def.renderer}`);
  } else {
    err(`unknown hook type: ${def.type} for ${name}`);
  }
}

if (failed) process.exit(1);
console.log(`[check-manifest] PASS — schemaVersion=${m.schemaVersion}, skills=${m.skills.length}, rules=${(m.rules??[]).length}, hooks=${Object.keys(m.hooks??{}).length}`);
