/**
 * `ivy knowledge` — knowledge linking commands (v0.11).
 *
 * Subcommands:
 *   link       — create a manual link between Memory records
 *   links      — query links for a record
 *   traverse   — traverse link path between records
 *   unlink     — delete a link from a record
 */

import path from 'path';
import { logger } from '../utils/logger.js';
import { MemoryStore } from '../core/memory-arch.js';
import {
  createLink,
  getLinks,
  traverse,
  deleteLink,
} from '../core/knowledge-linking.js';
import type { LinkRelation } from '../core/knowledge-linking.js';
import { readYaml } from '../utils/yaml.js';
import type { MemoryRecordType } from '../core/types.js';
import { checkFeatureGate } from '../core/memory/manager.js';
import type { FeatureGateResult } from '../core/memory/manager.js';

export interface KnowledgeLinkOptions {
  cwd?: string;
  source?: string;
  target?: string;
  relation?: string;
  desc?: string;
  recordId?: string;
  linkIndex?: number;
  to?: string;
}

function getMemoryDir(cwd: string): string {
  return path.join(cwd, '.ivy', 'memory');
}

/**
 * `ivy knowledge link —source <id> —target <id> --relation <type> --desc <text>`
 */
/** Check if knowledge linking feature is enabled. */
async function checkLinkingGate(cwd: string): Promise<FeatureGateResult> {
  return checkFeatureGate(cwd, 'memory-linking');
}

export async function runKnowledgeLink(opts: KnowledgeLinkOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const memoryDir = getMemoryDir(cwd);

  // Feature gate check (Task 5.3)
  const gate = await checkLinkingGate(cwd);
  if (!gate.allowed) {
    logger.error(gate.message!);
    return 1;
  }

  if (!opts.source || !opts.target || !opts.relation) {
    logger.error('Usage: ivy knowledge link --source <id> --target <id> --relation <type> --desc <text>');
    logger.info('Valid relations: influences, implements, precedes, supersedes, evidences');
    return 1;
  }

  // Ensure MemoryStore schema exists
  const store = new MemoryStore(cwd);
  await store.ensureSchema();

  const result = await createLink(
    memoryDir,
    opts.source,
    opts.target,
    opts.relation as LinkRelation,
    opts.desc ?? '',
  );

  if (result.success) {
    logger.success(result.message);
    return 0;
  }

  logger.error(result.message);
  return 1;
}

/**
 * `ivy knowledge links <record-id>`
 */
export async function runKnowledgeLinks(opts: KnowledgeLinkOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const memoryDir = getMemoryDir(cwd);

  // Feature gate check (Task 5.3)
  const gate = await checkLinkingGate(cwd);
  if (!gate.allowed) {
    logger.error(gate.message!);
    return 1;
  }

  if (!opts.recordId) {
    logger.error('Usage: ivy knowledge links <record-id>');
    return 1;
  }

  const store = new MemoryStore(cwd);
  await store.ensureSchema();

  const result = await getLinks(memoryDir, opts.recordId);
  if (!result) {
    logger.error(`Record "${opts.recordId}" not found`);
    return 1;
  }

  console.log(`\nKnowledge Links: ${result.recordId}`);
  console.log('═'.repeat(60));

  console.log('\n  Outgoing:');
  if (result.outgoing.length === 0) {
    console.log('    (none)');
  } else {
    for (const link of result.outgoing) {
      console.log(`    [${link.index}] → ${link.target} [${link.relation}]`);
      console.log(`      "${link.description}"`);
    }
  }

  console.log('\n  Incoming:');
  if (result.incoming.length === 0) {
    console.log('    (none)');
  } else {
    for (const link of result.incoming) {
      console.log(`    ← ${link.sourceRecordId} [${link.link.relation}]`);
      console.log(`      "${link.link.description}"`);
    }
  }

  console.log('');
  return 0;
}

/**
 * `ivy knowledge traverse <record-id> --to <type>`
 */
export async function runKnowledgeTraverse(opts: KnowledgeLinkOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const memoryDir = getMemoryDir(cwd);

  // Feature gate check (Task 5.3)
  const gate = await checkLinkingGate(cwd);
  if (!gate.allowed) {
    logger.error(gate.message!);
    return 1;
  }

  if (!opts.recordId) {
    logger.error('Usage: ivy knowledge traverse <record-id> --to <type>');
    return 1;
  }

  const store = new MemoryStore(cwd);
  await store.ensureSchema();

  const targetType = opts.to as MemoryRecordType | undefined;
  const result = await traverse(memoryDir, opts.recordId, targetType);

  const startId = result.path[0]?.recordId ?? opts.recordId;
  console.log(`\nKnowledge Path: ${startId}${targetType ? ` → ${targetType}` : ''}`);
  console.log('═'.repeat(60));

  for (let i = 0; i < result.path.length; i++) {
    const step = result.path[i];
    const prefix = i === 0 ? '  START' : `  │  ${step.relation}`;
    const connector = i < result.path.length - 1 ? '▼' : '✓';
    console.log(`  ${prefix}`);
    console.log(`  ${connector}`);
    console.log(`  ${step.recordId} (depth ${step.depth})`);
  }

  if (result.complete) {
    console.log('  ✓ Path complete');
  } else {
    console.log('  △ Path incomplete (max depth reached or target not found)');
  }

  console.log('');
  return 0;
}

/**
 * `ivy knowledge unlink <record-id> --index <n>`
 */
export async function runKnowledgeUnlink(opts: KnowledgeLinkOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const memoryDir = getMemoryDir(cwd);

  // Feature gate check (Task 5.3)
  const gate = await checkLinkingGate(cwd);
  if (!gate.allowed) {
    logger.error(gate.message!);
    return 1;
  }

  if (!opts.recordId || opts.linkIndex === undefined) {
    logger.error('Usage: ivy knowledge unlink <record-id> --index <n>');
    return 1;
  }

  const store = new MemoryStore(cwd);
  await store.ensureSchema();

  const result = await deleteLink(memoryDir, opts.recordId, opts.linkIndex);
  if (result.success) {
    logger.success(result.message);
    return 0;
  }

  logger.error(result.message);
  return 1;
}
