/**
 * Enforcement Resolver — v0.15 pure function for enforcement level calculation.
 */

import type { PlatformCapabilities } from './platform-context.js';

export type EnforcementLevel = 'hard' | 'soft' | 'advisory';

export function resolveEnforcementLevel(
  action: 'block' | 'warn' | 'allow',
  caps: PlatformCapabilities,
): EnforcementLevel {
  if (action === 'block' && caps.runtimeIntercept === 'full') return 'hard';
  if (action === 'block' && caps.runtimeIntercept === 'partial') return 'soft';
  if (action === 'block' && caps.runtimeIntercept === 'none') return 'soft';
  if (action === 'warn') return 'soft';
  return 'advisory';
}
