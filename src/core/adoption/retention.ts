import type { OriginProjection } from '../provenance/types.js';
import { runGit, isGitRepo } from '../../utils/git.js';
import { computeL0Fingerprint } from '../provenance/fingerprint.js';
import { readFile } from '../../utils/fs.js';
import { join } from 'path';
import type { RetentionMetrics } from '../adoption-engine.js';

export async function computeRetention(
  projection: OriginProjection,
  projectPath: string,
  window: number = 5,
): Promise<RetentionMetrics> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      totalGeneratedLines: 0,
      surviveLines: 0,
      retentionRatio: 1,
      trackedCommits: 0,
      confidence: 'low',
    };
  }

  const gitOk = await isGitRepo(projectPath);
  if (!gitOk) {
    return {
      totalGeneratedLines: origins.length * 10,
      surviveLines: origins.length * 10,
      retentionRatio: 1,
      trackedCommits: 0,
      confidence: 'low',
    };
  }

  let totalGeneratedLines = 0;
  let surviveLines = 0;
  let trackedCommits = 0;

  try {
    const { stdout } = await runGit(['log', '--format=%H', `-${window + 1}`], projectPath);
    const commits = stdout.trim().split('\n').filter(Boolean);
    trackedCommits = Math.min(commits.length, window);

    for (const origin of origins) {
      for (const artifact of origin.artifacts) {
        const absPath = join(projectPath, artifact.filePath);
        totalGeneratedLines += 10;

        try {
          const currentContent = await readFile(absPath);
          const currentFingerprint = computeL0Fingerprint(currentContent);

          if (currentFingerprint === artifact.fingerprint) {
            surviveLines += 10;
          } else {
            const generatedLines = 10;
            const matchingRatio = currentFingerprint === artifact.fingerprint ? 1 : 0.5;
            surviveLines += Math.round(generatedLines * matchingRatio);
          }
        } catch {
          surviveLines += 0;
        }
      }
    }
  } catch {
    return {
      totalGeneratedLines: origins.length * 10,
      surviveLines: origins.length * 10,
      retentionRatio: 1,
      trackedCommits: 0,
      confidence: 'low',
    };
  }

  const retentionRatio = totalGeneratedLines > 0 ? surviveLines / totalGeneratedLines : 1;

  return {
    totalGeneratedLines,
    surviveLines,
    retentionRatio: Math.min(1, Math.max(0, retentionRatio)),
    trackedCommits,
    confidence: trackedCommits >= 3 ? 'medium' : 'low',
  };
}
