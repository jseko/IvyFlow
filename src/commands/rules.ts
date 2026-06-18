/**
 * `ivy rules` — rule governance command (v0.7).
 *
 * Supports: --list, --info <name>, --override <rule.param=value>,
 *           --remove <rule.param>, --json
 *
 * Per §9.14: overrides NEVER modify built-in rule code or default config.
 * All overrides are stored in Derived Cache (rule_manifest.json).
 */

import { logger } from '../utils/logger.js';
import {
  getRuleDefinitions,
  getRuleDefinition,
  getEffectiveConfig,
  applyOverride,
  removeOverride,
  type RuleDefinition,
} from '../core/rule-registry.js';

export interface RulesOptions {
  cwd?: string;
  list?: boolean;
  info?: string;
  override?: string;
  remove?: string;
  json?: boolean;
}

/**
 * Parse "ruleName.param=value" format for --override.
 */
function parseOverrideArg(arg: string): { ruleName: string; param: string; value: string } {
  // Format: ruleName.param=value
  const eqIdx = arg.indexOf('=');
  if (eqIdx === -1) {
    throw new Error(`Invalid override format. Use: ruleName.param=value (e.g., stuck_detection.build=25)`);
  }

  const key = arg.substring(0, eqIdx);
  const value = arg.substring(eqIdx + 1);

  const dotIdx = key.lastIndexOf('.');
  if (dotIdx === -1) {
    throw new Error(`Invalid override format. Use: ruleName.param=value (e.g., stuck_detection.build=25)`);
  }

  return {
    ruleName: key.substring(0, dotIdx),
    param: key.substring(dotIdx + 1),
    value,
  };
}

/**
 * Parse "ruleName.param" format for --remove.
 */
function parseRemoveArg(arg: string): { ruleName: string; param: string } {
  const dotIdx = arg.lastIndexOf('.');
  if (dotIdx === -1) {
    throw new Error(`Invalid remove format. Use: ruleName.param (e.g., stuck_detection.build)`);
  }
  return {
    ruleName: arg.substring(0, dotIdx),
    param: arg.substring(dotIdx + 1),
  };
}

const ALGO_LABELS: Record<string, string> = {
  '1': 'Fixed threshold',
  '2': 'Adaptive (mean+1.5σ)',
  '3': 'P80 percentile',
};

function algoLabel(v: number): string {
  return ALGO_LABELS[String(v)] ?? `v${v}`;
}

function listRules(rules: RuleDefinition[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(rules, null, 2));
    return;
  }

  logger.info('');
  logger.info('IvyFlow Active Rules');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('');

  // Header
  const header = '  Rule                    Type          Algo/Config   Source     Override';
  logger.info(header);
  logger.info('  ' + '─'.repeat(header.length));

  for (const rule of rules) {
    const name = rule.name.padEnd(24);
    const type = rule.type.padEnd(12);
    const version = `v${rule.algorithmVersion}/v${rule.configVersion}`.padEnd(12);
    const source = rule.source.padEnd(10);
    const ov = rule.allowedOverrides.length > 0 ? '—' : '—';
    logger.info(`  ${name}${type}${version}${source}${ov}`);
  }

  logger.info('');
  logger.info(`  Total: ${rules.length} rule(s)`);
}

function showRuleInfo(rule: RuleDefinition, effectiveConfig: Record<string, unknown>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ rule, effectiveConfig }, null, 2));
    return;
  }

  const hasOverride = JSON.stringify(effectiveConfig) !== JSON.stringify(rule.defaultConfig);

  logger.info('');
  logger.info(`${rule.name}`);
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('');
  logger.info(`  Type:           ${rule.type}`);
  logger.info(`  Algorithm:      v${rule.algorithmVersion} (${algoLabel(rule.algorithmVersion)})`);
  logger.info(`  Config:         v${rule.configVersion}`);
  logger.info(`  Description:    ${rule.description}`);
  logger.info('');
  logger.info(`  Default config: ${JSON.stringify(rule.defaultConfig)}`);
  logger.info(`  Effective:      ${JSON.stringify(effectiveConfig)}`);
  logger.info(`  User override:  ${hasOverride ? 'Yes' : 'No'}`);
  logger.info('');
  logger.info(`  Allowed overrides: ${rule.allowedOverrides.join(', ') || '(none)'}`);
  logger.info('');
}

export async function runRules(opts: RulesOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  try {
    // --override
    if (opts.override) {
      const { ruleName, param, value } = parseOverrideArg(opts.override);
      const numericValue = /^\d+(\.\d+)?$/.test(value) ? (value.includes('.') ? parseFloat(value) : parseInt(value, 10)) : value;

      // Show preview
      const rule = getRuleDefinition(ruleName);
      if (!rule) {
        logger.error(`Rule '${ruleName}' not found.`);
        return 1;
      }

      const effective = await getEffectiveConfig(cwd, ruleName);
      const currentValue = findConfigValue(effective, param);

      logger.info('');
      logger.info(`Overriding rule ${ruleName}.${param}:`);
      logger.info(`  Current:  ${currentValue ?? 'default'}`);
      logger.info(`  Override: ${numericValue}`);
      if (!opts.json) {
        logger.info('');
      }

      await applyOverride(cwd, ruleName, param, numericValue);
      logger.success(`Override saved to .ivy/sessions/cache/rule_manifest.json`);

      // Show updated effective config
      const updated = await getEffectiveConfig(cwd, ruleName);
      const updatedValue = findConfigValue(updated, param);
      logger.info(`  Now: ${param} = ${updatedValue}`);
      logger.info('');

      return 0;
    }

    // --remove
    if (opts.remove) {
      const { ruleName, param } = parseRemoveArg(opts.remove);

      const rule = getRuleDefinition(ruleName);
      if (!rule) {
        logger.error(`Rule '${ruleName}' not found.`);
        return 1;
      }

      const removed = await removeOverride(cwd, ruleName, param);
      if (removed) {
        logger.success(`Override removed: ${ruleName}.${param}`);
      } else {
        logger.info(`No override found for ${ruleName}.${param}`);
      }
      return 0;
    }

    // --info <name>
    if (opts.info) {
      const rule = getRuleDefinition(opts.info);
      if (!rule) {
        logger.error(`Rule '${opts.info}' not found.`);
        return 1;
      }

      const effectiveConfig = await getEffectiveConfig(cwd, opts.info);
      showRuleInfo(rule, effectiveConfig, opts.json ?? false);
      return 0;
    }

    // --list (default)
    const rules = getRuleDefinitions();
    listRules(rules, opts.json ?? false);
    return 0;
  } catch (err) {
    logger.error(`Rules command failed: ${(err as Error).message}`);
    return 1;
  }
}

/**
 * Find a config value at a path within a potentially nested config object.
 */
function findConfigValue(config: Record<string, unknown>, path: string): unknown {
  if (config.thresholdByPhase && typeof config.thresholdByPhase === 'object') {
    const thresholds = config.thresholdByPhase as Record<string, unknown>;
    if (path in thresholds) return thresholds[path];
  }
  return config[path];
}
