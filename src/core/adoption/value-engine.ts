import type { OriginProjection } from '../provenance/types.js';
import type { ValueIndex, BusinessImpactType } from '../adoption-engine.js';
import { computeRetention } from './retention.js';
import { computeRework } from './rework.js';
import { computeAbandonment } from './abandonment.js';

const BUSINESS_IMPACT_RULES: Array<{ pattern: RegExp; type: BusinessImpactType; weight: number }> = [
  { pattern: /\/payment\/|\/billing\//, type: 'payment', weight: 2.0 },
  { pattern: /\/auth\/|\/security\//, type: 'security', weight: 2.0 },
  { pattern: /\/core\/|\/domain\/|\/service\//, type: 'core_business', weight: 1.5 },
  { pattern: /\/pipeline\/|\/etl\//, type: 'data_pipeline', weight: 1.2 },
  { pattern: /\/infra\/|\/config\//, type: 'infrastructure', weight: 1.0 },
  { pattern: /\/controller\/|\/handler\/|\/router\//, type: 'crud', weight: 0.5 },
  { pattern: /\/gateway\/|\/proxy\//, type: 'api_gateway', weight: 0.8 },
];

function classifyBusinessImpact(filePaths: string[]): { type: BusinessImpactType; weight: number } {
  let maxWeight = 1.0;
  let maxType: BusinessImpactType = 'unknown';

  for (const fp of filePaths) {
    for (const rule of BUSINESS_IMPACT_RULES) {
      if (rule.pattern.test(fp) && rule.weight > maxWeight) {
        maxWeight = rule.weight;
        maxType = rule.type;
      }
    }
  }

  return { type: maxType, weight: maxWeight };
}

export async function computeValueIndex(
  projection: OriginProjection,
  projectPath: string,
  retentionWindow: number = 5,
): Promise<ValueIndex> {
  const origins = [...projection.origins.values()];
  if (origins.length === 0) {
    return {
      valueIndex: 0,
      qualityFactor: 0,
      businessImpactType: 'unknown',
      businessImpactWeight: 1.0,
      retentionRatio: 0,
      reworkCost: 0,
      abandonmentRate: 0,
    };
  }

  const filePaths = origins.flatMap((o) => o.artifacts.map((a) => a.filePath));
  const { type: businessImpactType, weight: businessImpactWeight } = classifyBusinessImpact(filePaths);

  const [retention, rework, abandonment] = await Promise.all([
    computeRetention(projection, projectPath, retentionWindow),
    computeRework(projection, projectPath),
    Promise.resolve(computeAbandonment(projection, projectPath)),
  ]);

  const retentionRatio = retention.retentionRatio;
  const reworkCost = rework.reworkRatio;
  const abandonmentRate = abandonment.abandonmentRate;

  const qualityFactor = 1 - (reworkCost + abandonmentRate) / 2;
  const valueIndex = retentionRatio * Math.max(0, qualityFactor) * businessImpactWeight;

  return {
    valueIndex,
    qualityFactor: Math.max(0, Math.min(1, qualityFactor)),
    businessImpactType,
    businessImpactWeight,
    retentionRatio,
    reworkCost,
    abandonmentRate,
  };
}
