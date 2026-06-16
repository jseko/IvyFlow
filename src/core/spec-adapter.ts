/**
 * SpecAdapter abstraction.
 *
 * v0.1 ships with a single implementation (`OpenSpecAdapter`) that delegates
 * to `core/openspec.ts`. The interface is reserved as an extension seam so
 * future versions can plug in alternative spec engines (e.g., a homegrown
 * IvySpec, or AutoSpec) without touching the CLI surface.
 *
 * Reserved env var: `IVY_SPEC_ADAPTER`
 *   - v0.1: NO-OP. Reading it is allowed but the value is ignored;
 *     `defaultSpecAdapter` always returns the OpenSpec adapter.
 *   - v0.2+: will dispatch to a registry of adapters keyed by name.
 */

import { ensureOpenSpecCli, installOpenSpec } from './openspec.js';
import type { InstallScope } from './types.js';

export interface SpecAdapter {
  /** Stable identifier (e.g. 'openspec'). */
  readonly name: string;

  /**
   * Install or upgrade the adapter's CLI dependency. Returns true if the CLI
   * is usable after this call, false otherwise.
   */
  ensureCli(scope: InstallScope, projectPath: string): Promise<boolean>;

  /**
   * Initialize the spec engine in `projectPath` against the given platform
   * tool ids. Implementations SHOULD be idempotent.
   */
  init(
    projectPath: string,
    toolIds: string[],
    scope: InstallScope,
  ): Promise<'installed' | 'failed' | 'skipped'>;
}

export class OpenSpecAdapter implements SpecAdapter {
  readonly name = 'openspec';

  ensureCli(scope: InstallScope, projectPath: string): Promise<boolean> {
    return ensureOpenSpecCli(scope, projectPath);
  }

  init(
    projectPath: string,
    toolIds: string[],
    scope: InstallScope,
  ): Promise<'installed' | 'failed' | 'skipped'> {
    return installOpenSpec(projectPath, toolIds, scope);
  }
}

/**
 * Default SpecAdapter singleton.
 *
 * v0.1 always returns OpenSpecAdapter regardless of `IVY_SPEC_ADAPTER`.
 * The env var is read here only to surface a deprecation notice during the
 * v0.2 transition window; the value is otherwise ignored.
 */
export const defaultSpecAdapter: SpecAdapter = new OpenSpecAdapter();
