/**
 * `ivy review` — interactive suggestion review (v0.6).
 *
 * Guides users through pending suggestions one by one.
 * Supports batch mode via --auto for CI/automation.
 * All output is advisory — never auto-executed.
 */

import { createInterface } from 'readline';
import { logger } from '../utils/logger.js';
import { runSuggestEngine, buildTypeMap } from '../core/suggest-engine.js';
import { recordFeedback, getSuggestionQuality } from '../core/feedback-recorder.js';
import type { Suggestion, SuggestionType } from '../core/suggest-engine.js';

export interface ReviewOptions {
  cwd?: string;
  change?: string;
  type?: SuggestionType;
  auto?: boolean;
  autoAction?: 'accept' | 'snooze';
  snoozeDays?: number;
  json?: boolean;
}

export interface ReviewSession {
  sessionId: string;
  startedAt: string;
  change: string;
  pendingCount: number;
  suggestions: Suggestion[];
}

let _sessionCounter = 0;

function generateSessionId(): string {
  _sessionCounter++;
  return `rev_${String(_sessionCounter).padStart(3, '0')}`;
}

// ─── Interactive Review ───

async function promptUser(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function interactiveReview(
  suggestions: Suggestion[],
  cwd: string,
): Promise<void> {
  let accepted = 0;
  let dismissed = 0;
  let snoozed = 0;
  let ignored = 0;

  logger.info('');
  logger.info(`IvyFlow Review Session — ${new Date().toISOString().split('T')[0]}`);
  logger.info('═'.repeat(70));
  logger.info(`You have ${suggestions.length} pending suggestion(s)`);
  logger.info('');

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const severityLabel = s.severity.toUpperCase();
    const typeLabel = s.type.toUpperCase();

    logger.info('─'.repeat(70));
    logger.info(`[${i + 1}/${suggestions.length}] ${s.severity === 'critical' ? '⚠️' : 'ℹ️'} [${typeLabel}]  ${severityLabel}  │  change: ${s.change}`);
    logger.info(`  ${s.message}`);
    if (s.action) logger.info(`  → ${s.action}`);
    logger.info('');

    const answer = await promptUser('  → [A]ccept  [D]ismiss  [S]nooze  [I]gnore  [Q]uit\n  Your choice? > ');

    switch (answer) {
      case 'a':
      case 'accept':
        await recordFeedback(cwd, s.id, 'accepted');
        logger.success('  ✅ Accepted — feedback recorded');
        accepted++;
        break;

      case 'd':
      case 'dismiss': {
        const reason = await promptUser('  Reason (optional, press Enter to skip): ');
        await recordFeedback(cwd, s.id, 'dismissed', reason || undefined);
        logger.success('  ✅ Dismissed — feedback recorded');
        dismissed++;
        break;
      }

      case 's':
      case 'snooze': {
        const daysStr = await promptUser('  Snooze days (default 7): ');
        const days = parseInt(daysStr, 10) || 7;
        // Record as dismissed with snooze context
        await recordFeedback(cwd, s.id, 'dismissed', `snoozed-${days}d`);
        logger.success(`  ✅ Snoozed for ${days} days`);
        snoozed++;
        break;
      }

      case 'i':
      case 'ignore':
        await recordFeedback(cwd, s.id, 'ignored');
        logger.success('  ✅ Ignored — feedback recorded');
        ignored++;
        break;

      case 'q':
      case 'quit':
        logger.info('  Review session ended.');
        logger.info('');
        printSummary(suggestions.length, accepted, dismissed, snoozed, ignored);
        return;

      default:
        logger.warn(`  Invalid choice: "${answer}". Skipping.`);
        break;
    }
    logger.info('');
  }

  printSummary(suggestions.length, accepted, dismissed, snoozed, ignored);
}

function printSummary(
  total: number,
  accepted: number,
  dismissed: number,
  snoozed: number,
  ignored: number,
): void {
  const processed = accepted + dismissed + snoozed + ignored;
  logger.info('═'.repeat(70));
  logger.info(`  Session summary: ${processed}/${total} processed`);
  logger.info(`    Accepted:  ${accepted}`);
  logger.info(`    Dismissed: ${dismissed}`);
  logger.info(`    Snoozed:   ${snoozed}`);
  logger.info(`    Ignored:   ${ignored}`);
  logger.info('');
}

// ─── Batch Mode ───

async function batchReview(
  suggestions: Suggestion[],
  cwd: string,
  opts: ReviewOptions,
): Promise<void> {
  let count = 0;

  for (const s of suggestions) {
    // Filter by type if specified
    if (opts.type && s.type !== opts.type) continue;

    if (opts.autoAction === 'accept') {
      await recordFeedback(cwd, s.id, 'accepted');
      count++;
    } else if (opts.autoAction === 'snooze') {
      const days = opts.snoozeDays ?? 7;
      await recordFeedback(cwd, s.id, 'dismissed', `snoozed-${days}d`);
      count++;
    }
  }

  logger.success(`Batch review complete: ${count} suggestion(s) processed (${opts.autoAction ?? 'accept'})`);
}

// ─── Main Entry ───

export async function runReview(opts: ReviewOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  // Run suggest engine to get pending suggestions
  const suggestions = await runSuggestEngine(cwd, {
    changes: opts.change ? [opts.change] : undefined,
  });

  // Filter to pending only (exclude expired by default)
  const pending = suggestions.filter((s) => {
    if (opts.json) return true; // JSON mode shows all
    return s.status === 'pending' || !s.status;
  });

  if (opts.json) {
    const typeMap = buildTypeMap(suggestions);
    const quality = await getSuggestionQuality(cwd, typeMap);
    const session: ReviewSession = {
      sessionId: generateSessionId(),
      startedAt: new Date().toISOString(),
      change: opts.change ?? '*',
      pendingCount: pending.length,
      suggestions: pending,
    };
    console.log(JSON.stringify({ session, quality }, null, 2));
    return 0;
  }

  if (pending.length === 0) {
    logger.info('No pending suggestions. Good work!');
    return 0;
  }

  if (opts.auto) {
    await batchReview(pending, cwd, opts);
  } else {
    await interactiveReview(pending, cwd);
  }

  return 0;
}
