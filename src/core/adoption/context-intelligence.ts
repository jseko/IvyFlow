import type { OriginProjection, AIOperation } from '../provenance/types.js';
import type { CSIMetrics, ContextDimension, ContextDimensionName } from '../adoption-engine.js';

const REQUIRED_CONTEXT_FILES: Record<AIOperation, number> = {
  GENERATE: 8,
  EDIT: 4,
  DELETE: 2,
};

function estimateAvailableContext(projection: OriginProjection): {
  codebaseContext: number;
  knowledgeContext: number;
  taskContext: number;
} {
  const origins = [...projection.origins.values()];
  const fileSet = new Set<string>();

  for (const origin of origins) {
    for (const artifact of origin.artifacts) {
      fileSet.add(artifact.filePath);
    }
  }

  const codebaseContext = Math.min(fileSet.size, 20);
  const knowledgeContext = Math.min(origins.length * 2, 10);
  const taskContext = Math.min(origins.filter((o) => o.actions.length > 0).length, 5);

  return { codebaseContext, knowledgeContext, taskContext };
}

function inferDominantTaskType(projection: OriginProjection): AIOperation {
  const origins = [...projection.origins.values()];
  const counts: Record<AIOperation, number> = { GENERATE: 0, EDIT: 0, DELETE: 0 };

  for (const origin of origins) {
    for (const action of origin.actions) {
      counts[action.operation] = (counts[action.operation] ?? 0) + 1;
    }
  }

  let max: AIOperation = 'GENERATE';
  let maxCount = 0;
  for (const op of ['GENERATE', 'EDIT', 'DELETE'] as AIOperation[]) {
    if (counts[op] > maxCount) {
      maxCount = counts[op];
      max = op;
    }
  }

  return max;
}

export async function computeCSI(
  projection: OriginProjection,
): Promise<CSIMetrics> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      csi: 0,
      taskType: 'GENERATE',
      confidence: 'low',
      dimensions: [
        { dimension: 'codebaseContext', available: 0, required: REQUIRED_CONTEXT_FILES.GENERATE, ratio: 0 },
        { dimension: 'knowledgeContext', available: 0, required: 2, ratio: 0 },
        { dimension: 'taskContext', available: 0, required: 1, ratio: 0 },
      ],
    };
  }

  const taskType = inferDominantTaskType(projection);
  const requiredFiles = REQUIRED_CONTEXT_FILES[taskType];
  const available = estimateAvailableContext(projection);

  const dimensions: ContextDimension[] = [
    {
      dimension: 'codebaseContext',
      available: available.codebaseContext,
      required: requiredFiles,
      ratio: Math.min(1, available.codebaseContext / requiredFiles),
    },
    {
      dimension: 'knowledgeContext',
      available: available.knowledgeContext,
      required: 2,
      ratio: Math.min(1, available.knowledgeContext / 2),
    },
    {
      dimension: 'taskContext',
      available: available.taskContext,
      required: 1,
      ratio: Math.min(1, available.taskContext / 1),
    },
  ];

  const csi = dimensions.reduce((sum, d) => sum + d.ratio, 0) / dimensions.length;

  return {
    csi: Math.round(csi * 100) / 100,
    taskType,
    confidence: origins.length >= 5 ? 'medium' : 'low',
    dimensions,
  };
}
