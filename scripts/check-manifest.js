#!/usr/bin/env node
/**
 * check-manifest.js — validates assets/manifest.json schema (v6):
 *   - schemaVersion === 6
 *   - skills[] non-empty, all paths exist
 *   - rules[] all paths exist
 *   - hooks: known renderers + assets exist
 *   - suggest/review/check/explain/ruleGovernance: valid config (when present)
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

if (m.schemaVersion !== 6) err(`schemaVersion must be 6, got ${m.schemaVersion}`);
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
const knownRenderers = ['windsurf-json', 'cursor-json'];
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

// Validate suggest config (v5+)
if (m.suggest) {
  if (!m.suggest.config) err('suggest.config is required');
  if (m.suggest.config.stuckDetection) {
    const { thresholdByPhase } = m.suggest.config.stuckDetection;
    if (!thresholdByPhase) err('suggest.config.stuckDetection.thresholdByPhase is required');
    const expectedPhases = ['open', 'design', 'build', 'verify', 'archive'];
    for (const ph of expectedPhases) {
      if (typeof thresholdByPhase[ph] !== 'number') err(`thresholdByPhase.${ph} must be a number`);
    }
  }
  if (!m.suggest.config.feedback) err('suggest.config.feedback is required');
  if (!m.suggest.config.cache) err('suggest.config.cache is required');
}

// Validate review config (v5+)
if (m.review) {
  if (!m.review.config) err('review.config is required');
  if (!m.review.config.batchModes) err('review.config.batchModes is required');
}

// Validate check config (v5+)
if (m.check) {
  if (!m.check.config) err('check.config is required');
  if (!m.check.config.modes) err('check.config.modes is required');
  if (!m.check.config.outputFormats) err('check.config.outputFormats is required');
  if (!m.check.config.failOnLevels) err('check.config.failOnLevels is required');
}

// Validate explain config (v6+)
if (m.explain) {
  if (!m.explain.config) err('explain.config is required');
  if (m.explain.config.readOnly !== true) err('explain.config.readOnly must be true');
}

// Validate ruleGovernance config (v6+)
if (m.ruleGovernance) {
  if (!m.ruleGovernance.config) err('ruleGovernance.config is required');
  if (m.ruleGovernance.config.overrideScope !== 'derived_cache_only') {
    err('ruleGovernance.config.overrideScope must be "derived_cache_only"');
  }
}

if (failed) process.exit(1);
console.log(`[check-manifest] PASS — schemaVersion=${m.schemaVersion}, skills=${m.skills.length}, rules=${(m.rules??[]).length}, hooks=${Object.keys(m.hooks??{}).length}`);
