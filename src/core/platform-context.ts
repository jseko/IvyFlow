/**
 * Platform Context — v0.15 platform capability declarations.
 *
 * Each platform declares its capability level: full (runtime intercept available),
 * partial (limited), or none (no support). Experimental platforms default to none.
 */

export type CapabilityLevel = 'full' | 'partial' | 'none';

export interface PlatformCapabilities {
  runtimeIntercept: CapabilityLevel;
  gitHookInstall: CapabilityLevel;
  structuredRuleFile: CapabilityLevel;
}

export interface PlatformContext {
  platformId: string;
  capabilities: PlatformCapabilities;
}

export const PLATFORM_CAPABILITIES: Record<string, PlatformCapabilities> = {
  'windsurf':       { runtimeIntercept: 'full',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'cursor':         { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'claude':         { runtimeIntercept: 'full',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'gemini-cli':     { runtimeIntercept: 'full',  gitHookInstall: 'full',  structuredRuleFile: 'none' },
  'qwen':           { runtimeIntercept: 'none',  gitHookInstall: 'none',  structuredRuleFile: 'none' },
  'kiro':           { runtimeIntercept: 'none',  gitHookInstall: 'none',  structuredRuleFile: 'none' },
  'cline':          { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'roocode':        { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'github-copilot': { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'codebuddy':      { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'trae':           { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'qoder':          { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'amazon-q':       { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'continue':       { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'kilocode':       { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'auggie':         { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'kimi-code':      { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
  'lingma':         { runtimeIntercept: 'none',  gitHookInstall: 'full',  structuredRuleFile: 'full' },
};

export function getPlatformCapabilities(platformId: string): PlatformCapabilities {
  return PLATFORM_CAPABILITIES[platformId] ?? { runtimeIntercept: 'none', gitHookInstall: 'none', structuredRuleFile: 'none' };
}

export function getPlatformContext(platformId: string): PlatformContext {
  return { platformId, capabilities: getPlatformCapabilities(platformId) };
}
