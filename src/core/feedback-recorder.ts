/**
 * Feedback Recorder — suggestion feedback loop (v0.6).
 *
 * Records user feedback on suggestions and computes quality metrics.
 * v0.6 adds: effectiveness, accuracy, dismissedReasons, weeklyTrend, calibrationInfo.
 * Storage: .ivy/sessions/cache/suggestion_feedback.json
 */

import path from 'path';
import { ensureDir, fileExists, readFile, writeFile } from '../utils/fs.js';

// ─── Types ───

export type FeedbackAction = 'accepted' | 'dismissed' | 'ignored';

export interface SuggestionFeedback {
  suggestionId: string;
  action: FeedbackAction;
  at: string;
  /** v0.6 — optional dismiss reason */
  dismissedReason?: string;
}

export interface SuggestionQuality {
  total: number;
  accepted: number;
  dismissed: number;
  ignored: number;
  acceptanceRate: number;
  byType: Record<string, { total: number; accepted: number }>;

  // v0.6 quality metrics
  effectiveness: number;                     // accepted / total
  accuracy: number;                          // (accepted + intentional_dismissed) / total
  dismissedReasons: Record<string, number>;  // dismiss reason → count
  weeklyTrend: Array<{
    week: string;
    total: number;
    accepted: number;
    acceptanceRate: number;
  }>;
  calibrationInfo?: {
    calibrationCount: number;
    lastCalibratedAt: string | null;
    mode: 'fixed' | 'adaptive' | 'hybrid';
  };
}

// ─── Storage ───

interface FeedbackStore {
  feedbacks: SuggestionFeedback[];
  byType: Record<string, SuggestionFeedback[]>;
}

function getFeedbackPath(projectPath: string): string {
  return path.join(projectPath, '.ivy', 'sessions', 'cache', 'suggestion_feedback.json');
}

async function readFeedbackStore(projectPath: string): Promise<FeedbackStore> {
  const storePath = getFeedbackPath(projectPath);
  if (!(await fileExists(storePath))) {
    return { feedbacks: [], byType: {} };
  }
  try {
    const raw = await readFile(storePath);
    return JSON.parse(raw) as FeedbackStore;
  } catch {
    return { feedbacks: [], byType: {} };
  }
}

async function writeFeedbackStore(projectPath: string, store: FeedbackStore): Promise<void> {
  const storePath = getFeedbackPath(projectPath);
  await ensureDir(path.dirname(storePath));
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

// ─── Public API ───

/**
 * Record a feedback action for a suggestion.
 */
export async function recordFeedback(
  projectPath: string,
  suggestionId: string,
  action: FeedbackAction,
  dismissedReason?: string,
): Promise<void> {
  const store = await readFeedbackStore(projectPath);

  // Remove any existing feedback for this suggestionId
  store.feedbacks = store.feedbacks.filter((f) => f.suggestionId !== suggestionId);

  const feedback: SuggestionFeedback = {
    suggestionId,
    action,
    at: new Date().toISOString(),
    dismissedReason: action === 'dismissed' ? dismissedReason : undefined,
  };
  store.feedbacks.push(feedback);

  // Update byType index
  if (!store.byType[action]) store.byType[action] = [];
  store.byType[action] = store.byType[action].filter((f) => f.suggestionId !== suggestionId);
  store.byType[action].push(feedback);

  await writeFeedbackStore(projectPath, store);
}

/**
 * Get feedback for a specific suggestion, or null if none exists.
 */
export async function getSuggestionFeedback(
  projectPath: string,
  suggestionId: string,
): Promise<SuggestionFeedback | null> {
  const store = await readFeedbackStore(projectPath);
  return store.feedbacks.find((f) => f.suggestionId === suggestionId) ?? null;
}

/**
 * Build quality metrics from all recorded feedback.
 * v0.6 adds: effectiveness, accuracy, dismissedReasons, weeklyTrend, calibrationInfo.
 */
export async function getSuggestionQuality(
  projectPath: string,
  suggestionTypes?: Record<string, string[]>, // suggestionId → [type]
): Promise<SuggestionQuality> {
  const store = await readFeedbackStore(projectPath);
  const feedbacks = store.feedbacks;

  const total = feedbacks.length;
  const accepted = feedbacks.filter((f) => f.action === 'accepted').length;
  const dismissed = feedbacks.filter((f) => f.action === 'dismissed').length;
  const ignored = feedbacks.filter((f) => f.action === 'ignored').length;

  // By-type breakdown
  const byType: Record<string, { total: number; accepted: number }> = {};
  if (suggestionTypes) {
    for (const [type, ids] of Object.entries(suggestionTypes)) {
      const typeFeedbacks = feedbacks.filter((f) => ids.includes(f.suggestionId));
      byType[type] = {
        total: typeFeedbacks.length,
        accepted: typeFeedbacks.filter((f) => f.action === 'accepted').length,
      };
    }
  }

  // v0.6: effectiveness = accepted / total
  const effectiveness = total > 0 ? accepted / total : 0;

  // v0.6: accuracy = (accepted + intentional_dismissed) / total
  // intentional dismissals are those with a reason filled in
  const intentionalDismissed = feedbacks.filter(
    (f) => f.action === 'dismissed' && typeof f.dismissedReason === 'string' && f.dismissedReason.length > 0,
  ).length;
  const accuracy = total > 0 ? (accepted + intentionalDismissed) / total : 0;

  // v0.6: dismissedReasons distribution
  const dismissedReasons: Record<string, number> = {};
  for (const f of feedbacks) {
    if (f.action === 'dismissed' && f.dismissedReason) {
      const reason = f.dismissedReason;
      dismissedReasons[reason] = (dismissedReasons[reason] ?? 0) + 1;
    }
  }

  // v0.6: weekly trend (last 8 weeks)
  const weeklyTrend = computeWeeklyTrend(feedbacks);

  // v0.6: calibration info
  let calibrationInfo: SuggestionQuality['calibrationInfo'] = undefined;
  try {
    const { readCalibrationProfile } = await import('./quality-calibrator.js');
    const profile = await readCalibrationProfile(projectPath);
    if (profile) {
      calibrationInfo = {
        calibrationCount: profile.calibrationCount,
        lastCalibratedAt: profile.lastCalibratedAt,
        mode: profile.mode,
      };
    }
  } catch {
    // quality-calibrator not available
  }

  return {
    total,
    accepted,
    dismissed,
    ignored,
    acceptanceRate: total > 0 ? accepted / total : 0,
    byType,
    effectiveness,
    accuracy,
    dismissedReasons,
    weeklyTrend,
    calibrationInfo,
  };
}

/**
 * Compute weekly acceptance trend from feedback data.
 * Groups by ISO week for the last 8 weeks.
 */
function computeWeeklyTrend(
  feedbacks: SuggestionFeedback[],
): Array<{ week: string; total: number; accepted: number; acceptanceRate: number }> {
  const now = Date.now();
  const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now - EIGHT_WEEKS_MS);

  const recent = feedbacks.filter((f) => new Date(f.at).getTime() >= cutoff.getTime());

  // Group by ISO week string (YYYY-Www)
  const byWeek: Record<string, { total: number; accepted: number }> = {};
  for (const f of recent) {
    const d = new Date(f.at);
    const week = getIsoWeek(d);
    if (!byWeek[week]) byWeek[week] = { total: 0, accepted: 0 };
    byWeek[week].total++;
    if (f.action === 'accepted') byWeek[week].accepted++;
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, counts]) => ({
      week,
      total: counts.total,
      accepted: counts.accepted,
      acceptanceRate: counts.total > 0 ? counts.accepted / counts.total : 0,
    }));
}

/**
 * Get ISO week string (e.g., "2026-W25").
 */
function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
