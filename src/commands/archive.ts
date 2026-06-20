/**
 * `ivy archive` — Archive a change with knowledge extraction and L0 Memory.
 *
 * v0.9 rewrite: replaces the v0.7/0.8 flag-based archive with a full command
 * that handles phase transition, knowledge extraction, L0 Memory writing,
 * and post-archive actions (push-pr, keep-state, discard).
 */

import path from 'path';

import { fileExists, ensureDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';
import { runArchiveEngine, listArchivableChanges } from '../core/archive-engine.js';
import { extractKnowledge } from '../core/knowledge-extractor.js';
import { writeL0Memory } from '../core/memory-writer.js';
import { MemoryStore } from '../core/memory-arch.js';
import type { ArchiveOptions, ArchiveResult } from '../core/types.js';

// ─── Types ───

export interface ArchiveCommandOptions {
  cwd?: string;
  change?: string;
  action?: string;
  noExtract?: boolean;
  message?: string;
  force?: boolean;
  adr?: boolean;
  cleanupWorktree?: boolean;
}

interface ProjectYaml {
  version?: string;
  changes?: Array<{
    name: string;
    phase: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ─── Command Entry Point ───

export async function runArchive(opts: ArchiveCommandOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const ivyDir = path.join(cwd, '.ivy');
  const openspecDir = path.join(cwd, 'openspec');

  // Resolve change name — interactive prompt if omitted
  let changeName = opts.change;

  if (!changeName) {
    const changes = await listArchivableChanges(ivyDir);
    if (changes.length === 0) {
      logger.error('No changes in VERIFY phase to archive.');
      logger.info('Use --force to archive from any phase.');
      return 1;
    }

    if (changes.length === 1) {
      changeName = changes[0].name;
      logger.info(`Archiving the only active change: ${changeName}`);
    } else {
      const { select } = await import('@inquirer/prompts');
      changeName = await select({
        message: 'Select a change to archive:',
        choices: changes.map((c) => ({
          name: `${c.name} (${c.phase})`,
          value: c.name,
        })),
      });
    }
  }

  logger.step(`Archiving change: ${changeName}`);

  // 1) Knowledge extraction (before phase transition)
  const changeDir = path.join(openspecDir, 'changes', changeName);
  const knowledgeDir = path.join(ivyDir, 'knowledge');
  const memoryBaseDir = path.join(ivyDir, 'memory', changeName);

  if (!opts.noExtract) {
    logger.step('Extracting knowledge...');
    const knowledge = await extractKnowledge({ changeDir });

    const totalRecords =
      knowledge.decisions.length +
      knowledge.constraints.length +
      knowledge.risks.length +
      knowledge.facts.length;

    if (totalRecords > 0) {
      // Write knowledge YAML
      await ensureDir(knowledgeDir);
      await writeYaml(path.join(knowledgeDir, `${changeName}.yaml`), knowledge as unknown as Record<string, unknown>);

      // Write L0 Memory
      await writeL0Memory({
        memoryDir: memoryBaseDir,
        knowledge,
        changeName,
        extractableTypes: ['decisions', 'constraints', 'risks', 'facts'],
      });

      logger.success(`Knowledge extracted: ${knowledge.decisions.length} decisions, ${knowledge.constraints.length} constraints, ${knowledge.risks.length} risks, ${knowledge.facts.length} facts`);
      logger.success(`L0 Memory: ${memoryBaseDir}`);

      // If --adr flag, generate ADR entries in MemoryStore
      if (opts.adr && knowledge.decisions.length > 0) {
        logger.step('Generating ADR entries...');
        const store = new MemoryStore(cwd);
        await store.ensureSchema();
        for (const decision of knowledge.decisions) {
          await store.write({
            type: 'decision',
            title: decision.title,
            timestamp: new Date().toISOString(),
            changeName,
            source: decision.source,
            content: decision.description,
            tags: ['adr'],
          });
        }
        logger.success(`ADR: ${knowledge.decisions.length} decision(s) written to MemoryStore`);
      }
    } else {
      logger.info('No extractable knowledge found in change documents.');
    }
  }

  // 2) Run archive engine (phase transition, file move, report)
  const result = await runArchiveEngine({
    changeName,
    openspecDir,
    ivyDir,
    action: opts.action as ArchiveOptions['action'],
    force: opts.force,
    extractKnowledge: !opts.noExtract,
  });

  logger.success(result.summary);

  // Print summary
  logger.info('');
  logger.dim(`  Report: ${result.reportPath ?? 'n/a'}`);
  logger.dim(`  Knowledge: ${opts.noExtract ? 'skipped' : path.join(knowledgeDir, `${changeName}.yaml`)}`);
  logger.dim(`  From: ${result.oldPhase} → To: ${result.newPhase}`);

  // 3) Worktree cleanup (if requested)
  if (opts.cleanupWorktree && changeName) {
    logger.step('Cleaning up worktree...');
    try {
      const { WorktreeManager } = await import('../core/worktree-manager.js');
      const mgr = new WorktreeManager({ cwd });
      await mgr.cleanup(changeName);
      logger.success('Worktree cleaned up.');
    } catch (err) {
      logger.warn(`Worktree cleanup skipped: ${(err as Error).message}`);
    }
  }

  return 0;
}
