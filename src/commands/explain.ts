/**
 * `ivy explain` — suggestion traceability command (v0.7).
 *
 * Read-only aggregation: dynamically assembles FullExplanation from
 * Suggestion trace snapshot + Rule Registry + Calibration Profile.
 *
 * Per §9.15: NEVER writes events or modifies data.
 */

import { logger } from '../utils/logger.js';
import { runSuggestEngine, type Suggestion } from '../core/suggest-engine.js';
import { buildExplanation, formatExplanation, formatExplanationJson, type FullExplanation } from '../core/explain-engine.js';

export interface ExplainOptions {
  cwd?: string;
  id?: string;
  change?: string;
  type?: string;
  json?: boolean;
}

/**
 * Load all suggestions for a project (including pre-v0.7 without trace).
 */
async function loadSuggestions(projectPath: string, opts: ExplainOptions): Promise<Suggestion[]> {
  const all = await runSuggestEngine(projectPath, {
    changes: opts.change ? [opts.change] : undefined,
  });

  if (opts.type) {
    return all.filter((s) => s.type === opts.type);
  }

  if (opts.id) {
    return all.filter((s) => s.id === opts.id);
  }

  return all;
}

async function showSingleExplanation(
  projectPath: string,
  suggestion: Suggestion,
  json: boolean,
): Promise<number> {
  const exp = await buildExplanation(projectPath, suggestion);

  if (!exp) {
    if (json) {
      console.log(JSON.stringify({ error: 'No trace data available (pre-v0.7 suggestion)' }));
    } else {
      logger.warn('No trace data available (pre-v0.7 suggestion).');
    }
    return 1;
  }

  if (json) {
    console.log(JSON.stringify(formatExplanationJson(exp), null, 2));
  } else {
    logger.info('');
    logger.info('IvyFlow Suggestion Explanation');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');
    logger.info(formatExplanation(exp));
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
  }

  return 0;
}

async function showBatchExplanations(
  projectPath: string,
  suggestions: Suggestion[],
  json: boolean,
): Promise<number> {
  if (suggestions.length === 0) {
    if (json) {
      console.log(JSON.stringify({ explanations: [] }));
    } else {
      logger.info('No suggestions found.');
    }
    return 0;
  }

  const explanations: FullExplanation[] = [];
  let noTraceCount = 0;

  for (const s of suggestions) {
    const exp = await buildExplanation(projectPath, s);
    if (exp) {
      explanations.push(exp);
    } else {
      noTraceCount++;
    }
  }

  if (json) {
    console.log(JSON.stringify({
      total: suggestions.length,
      withTrace: explanations.length,
      noTrace: noTraceCount,
      explanations: explanations.map(formatExplanationJson),
    }, null, 2));
    return 0;
  }

  logger.info('');
  logger.info(`IvyFlow Suggestion Explanations — ${suggestions.length} suggestion(s)`);
  logger.info('═══════════════════════════════════════════════════════');

  for (const exp of explanations) {
    logger.info('');
    logger.info(`📋 ${exp.suggestion.id} — ${exp.suggestion.type.toUpperCase()} — ${exp.suggestion.severity}`);
    logger.info(formatExplanation(exp));
    logger.info('───────────────────────────────────────────────────');
  }

  if (noTraceCount > 0) {
    logger.info('');
    logger.warn(`${noTraceCount} suggestion(s) have no trace data (pre-v0.7).`);
  }

  return 0;
}

export async function runExplain(opts: ExplainOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  try {
    const suggestions = await loadSuggestions(cwd, opts);

    if (suggestions.length === 0) {
      if (opts.id) {
        logger.warn(`Suggestion "${opts.id}" not found.`);
        return 1;
      }
      if (opts.json) {
        console.log(JSON.stringify({ explanations: [] }));
      } else {
        logger.info('No suggestions found.');
      }
      return 0;
    }

    if (opts.id && suggestions.length === 1) {
      // Single suggestion by ID
      return await showSingleExplanation(cwd, suggestions[0], opts.json ?? false);
    }

    // Batch mode (by change or type)
    return await showBatchExplanations(cwd, suggestions, opts.json ?? false);
  } catch (err) {
    logger.error(`Explain failed: ${(err as Error).message}`);
    return 1;
  }
}
