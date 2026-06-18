import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import {
  recordFeedback,
  getSuggestionFeedback,
  getSuggestionQuality,
  type SuggestionFeedback,
  type FeedbackAction,
} from './feedback-recorder.js';

async function mkTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ivyflow-feedback-'));
}

describe('feedback-recorder', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('records and retrieves feedback for a suggestion', async () => {
    await recordFeedback(tmp, 'sugg_st_01', 'accepted');
    const fb = await getSuggestionFeedback(tmp, 'sugg_st_01');
    expect(fb).not.toBeNull();
    expect(fb!.suggestionId).toBe('sugg_st_01');
    expect(fb!.action).toBe('accepted');
    expect(fb!.at).toBeTruthy();
  });

  it('returns null for unknown suggestion', async () => {
    const fb = await getSuggestionFeedback(tmp, 'sugg_unknown');
    expect(fb).toBeNull();
  });

  it('overwrites existing feedback on re-record', async () => {
    await recordFeedback(tmp, 'sugg_st_01', 'accepted');
    await recordFeedback(tmp, 'sugg_st_01', 'dismissed');
    const fb = await getSuggestionFeedback(tmp, 'sugg_st_01');
    expect(fb!.action).toBe('dismissed');
  });

  it('returns empty quality metrics when no feedback', async () => {
    const quality = await getSuggestionQuality(tmp);
    expect(quality.total).toBe(0);
    expect(quality.acceptanceRate).toBe(0);
  });

  it('computes acceptance rate', async () => {
    await recordFeedback(tmp, 'sugg_st_01', 'accepted');
    await recordFeedback(tmp, 'sugg_pr_01', 'accepted');
    await recordFeedback(tmp, 'sugg_rb_01', 'dismissed');
    await recordFeedback(tmp, 'sugg_cl_01', 'ignored');

    const quality = await getSuggestionQuality(tmp);
    expect(quality.total).toBe(4);
    expect(quality.accepted).toBe(2);
    expect(quality.dismissed).toBe(1);
    expect(quality.ignored).toBe(1);
    expect(quality.acceptanceRate).toBe(0.5);
  });

  it('computes by-type breakdown when type map is provided', async () => {
    await recordFeedback(tmp, 'sugg_st_01', 'accepted');
    await recordFeedback(tmp, 'sugg_pr_01', 'dismissed');

    const typeMap = {
      stuck: ['sugg_st_01'],
      phase_review: ['sugg_pr_01'],
    };

    const quality = await getSuggestionQuality(tmp, typeMap);
    expect(quality.byType.stuck.total).toBe(1);
    expect(quality.byType.stuck.accepted).toBe(1);
    expect(quality.byType.phase_review.total).toBe(1);
    expect(quality.byType.phase_review.accepted).toBe(0);
  });

  describe('v0.6 quality metrics', () => {
    it('computes effectiveness = accepted / total', async () => {
      await recordFeedback(tmp, 'sugg_01', 'accepted');
      await recordFeedback(tmp, 'sugg_02', 'accepted');
      await recordFeedback(tmp, 'sugg_03', 'dismissed');

      const quality = await getSuggestionQuality(tmp);
      expect(quality.effectiveness).toBeCloseTo(0.667, 2);
    });

    it('computes accuracy including intentional dismissals', async () => {
      await recordFeedback(tmp, 'sugg_01', 'accepted');
      await recordFeedback(tmp, 'sugg_02', 'accepted');
      await recordFeedback(tmp, 'sugg_03', 'dismissed', 'intentional, already planned');
      await recordFeedback(tmp, 'sugg_04', 'dismissed'); // no reason = not intentional
      await recordFeedback(tmp, 'sugg_05', 'ignored');

      const quality = await getSuggestionQuality(tmp);
      // accuracy = (2 accepted + 1 intentional_dismissed) / 5 = 3/5 = 0.6
      expect(quality.accuracy).toBeCloseTo(0.6, 2);
    });

    it('tracks dismissed reasons distribution', async () => {
      await recordFeedback(tmp, 'sugg_01', 'dismissed', 'false_positive');
      await recordFeedback(tmp, 'sugg_02', 'dismissed', 'already_done');
      await recordFeedback(tmp, 'sugg_03', 'dismissed', 'false_positive');

      const quality = await getSuggestionQuality(tmp);
      expect(quality.dismissedReasons.false_positive).toBe(2);
      expect(quality.dismissedReasons.already_done).toBe(1);
    });

    it('returns empty dismissedReasons when no dismiss reasons given', async () => {
      await recordFeedback(tmp, 'sugg_01', 'dismissed');
      await recordFeedback(tmp, 'sugg_02', 'accepted');

      const quality = await getSuggestionQuality(tmp);
      expect(Object.keys(quality.dismissedReasons)).toHaveLength(0);
    });

    it('returns empty weeklyTrend when no feedback data', async () => {
      const quality = await getSuggestionQuality(tmp);
      expect(quality.weeklyTrend).toEqual([]);
    });

    it('has effectiveness = 0 when total is 0', async () => {
      const quality = await getSuggestionQuality(tmp);
      expect(quality.effectiveness).toBe(0);
      expect(quality.accuracy).toBe(0);
    });

    it('stores dismissedReason in feedback record', async () => {
      await recordFeedback(tmp, 'sugg_01', 'dismissed', 'intentional');
      const fb = await getSuggestionFeedback(tmp, 'sugg_01');
      expect(fb!.dismissedReason).toBe('intentional');
    });

    it('does not set dismissedReason for non-dismiss actions', async () => {
      await recordFeedback(tmp, 'sugg_01', 'accepted');
      const fb = await getSuggestionFeedback(tmp, 'sugg_01');
      expect(fb!.dismissedReason).toBeUndefined();
    });
  });
});