import type { OriginProjection, Origin } from '../provenance/types.js';
import type { FeedbackType, FeedbackEntry, FeedbackLoopSummary } from '../adoption-engine.js';
import { runGit, isGitRepo } from '../../utils/git.js';

const ACCEPTED_AND_KEPT_THRESHOLD = 30;
const ACCEPTED_THEN_MODIFIED_THRESHOLD = 10;
const ACCEPTED_THEN_DELETED_THRESHOLD = 5;

async function inferFeedbackForOrigin(
  origin: Origin,
  projectPath: string,
): Promise<FeedbackEntry> {
  const filePath = origin.artifacts[0]?.filePath;
  if (!filePath) {
    return { originId: origin.id, type: 'unknown', confidence: 'low', commitsSince: 0 };
  }

  try {
    const { stdout: logOutput } = await runGit(
      ['log', '--oneline', '--', filePath],
      projectPath,
    );
    const commits = logOutput.trim().split('\n').filter(Boolean);
    const commitsSince = commits.length;

    try {
      const { stdout: revertOutput } = await runGit(
        ['log', '--oneline', '--grep=revert', '-i', `--since=${new Date(origin.createdAt).toISOString()}`, '--', filePath],
        projectPath,
      );
      if (revertOutput.trim()) {
        return { originId: origin.id, type: 'rejected_outright', confidence: 'medium', commitsSince };
      }
    } catch {
      // no revert found, continue
    }

    if (commitsSince >= ACCEPTED_AND_KEPT_THRESHOLD) {
      return { originId: origin.id, type: 'accepted_and_kept', confidence: 'medium', commitsSince };
    }

    if (commitsSince >= ACCEPTED_THEN_MODIFIED_THRESHOLD) {
      return { originId: origin.id, type: 'accepted_then_modified', confidence: 'low', commitsSince };
    }

    if (commitsSince >= ACCEPTED_THEN_DELETED_THRESHOLD) {
      return { originId: origin.id, type: 'accepted_then_deleted', confidence: 'low', commitsSince };
    }

    return { originId: origin.id, type: 'unknown', confidence: 'low', commitsSince };
  } catch {
    return { originId: origin.id, type: 'unknown', confidence: 'low', commitsSince: 0 };
  }
}

export async function inferFeedback(
  projection: OriginProjection,
  projectPath: string,
): Promise<FeedbackLoopSummary> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      entries: [],
      summary: {
        acceptedAndKept: 0,
        acceptedThenModified: 0,
        acceptedThenDeleted: 0,
        rejectedOutright: 0,
        unknown: 0,
      },
    };
  }

  const gitOk = await isGitRepo(projectPath);
  if (!gitOk) {
    const entries = origins.map((o) => ({
      originId: o.id,
      type: 'unknown' as FeedbackType,
      confidence: 'low' as const,
      commitsSince: 0,
    }));
    return {
      entries,
      summary: {
        acceptedAndKept: 0,
        acceptedThenModified: 0,
        acceptedThenDeleted: 0,
        rejectedOutright: 0,
        unknown: entries.length,
      },
    };
  }

  const entries = await Promise.all(
    origins.map((o) => inferFeedbackForOrigin(o, projectPath)),
  );

  const summary = {
    acceptedAndKept: entries.filter((e) => e.type === 'accepted_and_kept').length,
    acceptedThenModified: entries.filter((e) => e.type === 'accepted_then_modified').length,
    acceptedThenDeleted: entries.filter((e) => e.type === 'accepted_then_deleted').length,
    rejectedOutright: entries.filter((e) => e.type === 'rejected_outright').length,
    unknown: entries.filter((e) => e.type === 'unknown').length,
  };

  return { entries, summary };
}
