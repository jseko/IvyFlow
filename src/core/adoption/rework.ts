import type { OriginProjection } from '../provenance/types.js';
import { runGit, isGitRepo } from '../../utils/git.js';
import type { ReworkMetrics } from '../adoption-engine.js';

export async function computeRework(
  projection: OriginProjection,
  projectPath: string,
): Promise<ReworkMetrics> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      aiGeneratedLines: 0,
      humanModifiedLines: 0,
      reworkRatio: 0,
      modificationCount: 0,
      confidence: 'low',
    };
  }

  const gitOk = await isGitRepo(projectPath);
  if (!gitOk) {
    return {
      aiGeneratedLines: origins.length * 10,
      humanModifiedLines: 0,
      reworkRatio: 0,
      modificationCount: 0,
      confidence: 'low',
    };
  }

  let aiGeneratedLines = 0;
  let humanModifiedLines = 0;
  let modificationCount = 0;

  try {
    for (const origin of origins) {
      for (const artifact of origin.artifacts) {
        aiGeneratedLines += 10;

        try {
          const { stdout: logOutput } = await runGit(
            ['log', '--oneline', '--', artifact.filePath],
            projectPath,
          );
          const commits = logOutput.trim().split('\n').filter(Boolean);

          for (let i = 1; i < commits.length; i++) {
            modificationCount++;
            try {
              const { stdout: diffOutput } = await runGit(
                ['diff', '--shortstat', `${commits[i].split(' ')[0]}~1`, commits[i].split(' ')[0], '--', artifact.filePath],
                projectPath,
              );
              const insertions = parseInt((diffOutput.match(/(\d+) insertion/) ?? ['', '0'])[1], 10);
              const deletions = parseInt((diffOutput.match(/(\d+) deletion/) ?? ['', '0'])[1], 10);
              const changed = Math.max(insertions, deletions);
              humanModifiedLines += Math.min(changed, 10);
            } catch {
              humanModifiedLines += 2;
            }
          }
        } catch {
          humanModifiedLines += 0;
        }
      }
    }
  } catch {
    return {
      aiGeneratedLines: origins.length * 10,
      humanModifiedLines: 0,
      reworkRatio: 0,
      modificationCount: 0,
      confidence: 'low',
    };
  }

  const reworkRatio = aiGeneratedLines > 0 ? humanModifiedLines / aiGeneratedLines : 0;

  return {
    aiGeneratedLines,
    humanModifiedLines,
    reworkRatio: Math.min(1, reworkRatio),
    modificationCount,
    confidence: modificationCount >= 1 ? 'medium' : 'low',
  };
}
