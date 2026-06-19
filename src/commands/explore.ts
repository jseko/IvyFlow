/**
 * `ivy explore` — Read-only exploration mode.
 *
 * v0.13: Governed Execution — Explore Mode.
 *
 * Displays a banner showing allowed/forbidden actions and exits.
 * Does not provide any write-capable operations.
 */

import { logger } from '../utils/logger.js';

export interface ExploreOptions {
  cwd?: string;
}

export async function runExplore(_opts: ExploreOptions = {}): Promise<number> {
  logger.header('IvyFlow Explore Mode');
  logger.divider();
  logger.info('  You are in read-only exploration mode.');
  logger.info('');
  logger.info('  Allowed actions:');
  logger.info('    ✓ View current workflow phase');
  logger.info('    ✓ List installed platforms');
  logger.info('    ✓ Run health checks (ivy doctor)');
  logger.info('    ✓ Show workflow status (ivy status)');
  logger.info('    ✓ Validate phase transitions (ivy validate)');
  logger.info('    ✓ View lifecycle state (ivy state)');
  logger.info('');
  logger.info('  Forbidden actions:');
  logger.info('    ✗ Create new changes');
  logger.info('    ✗ Modify workflow phase');
  logger.info('    ✗ Install/uninstall platforms');
  logger.info('    ✗ Archive changes');
  logger.info('');
  logger.info('  Use `ivy init` outside explore mode to set up IvyFlow in a project.');
  logger.info('  Use `ivy state set <checkpoint>` to advance the lifecycle.');

  return 0;
}
