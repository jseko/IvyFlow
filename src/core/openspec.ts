/**
 * OpenSpec CLI integration.
 *
 * Ported from Comet (`src/core/openspec.ts`) and trimmed for IvyFlow v0.1:
 *   - Single platform (Claude Code), so the opencode-specific path migration
 *     has been removed.
 *   - Public surface kept compatible with Comet so future SpecAdapter
 *     implementations can swap in cleanly.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { PLATFORMS } from './platforms.js';
import { printCommandErrorDetails } from './command-error.js';
import type { InstallScope } from './types.js';

const VALID_TOOL_IDS = new Set(PLATFORMS.map((p) => p.openspecToolId));

const ALL_OPENSPEC_WORKFLOWS = [
  'propose',
  'explore',
  'new',
  'continue',
  'apply',
  'ff',
  'sync',
  'archive',
  'bulk-archive',
  'verify',
  'onboard',
] as const;

export function getNpmExecutable(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function buildOpenSpecInitInvocation(
  projectPath: string,
  toolIds: string[],
  scope: InstallScope,
  homeDir = os.homedir(),
  includeProfileFlag = true,
): { command: string; args: string[] } {
  const targetPath = scope === 'global' ? homeDir : projectPath;
  const args = ['init', targetPath, '--tools', toolIds.join(',')];
  if (includeProfileFlag) {
    args.push('--profile', 'custom');
  }
  return { command: 'openspec', args };
}

const ALL_WORKFLOWS_CONFIG =
  JSON.stringify(
    {
      featureFlags: {},
      profile: 'custom',
      delivery: 'both',
      workflows: [...ALL_OPENSPEC_WORKFLOWS],
    },
    null,
    2,
  ) + '\n';



function createOpenSpecAllWorkflowsEnv(): { env: NodeJS.ProcessEnv; configHome: string } {
  const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ivyflow-openspec-profile-'));
  try {
    const openspecConfigDir = path.join(configHome, 'openspec');
    fs.mkdirSync(openspecConfigDir, { recursive: true });
    fs.writeFileSync(path.join(openspecConfigDir, 'config.json'), ALL_WORKFLOWS_CONFIG, 'utf-8');

    return {
      configHome,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
      },
    };
  } catch (error) {
    fs.rmSync(configHome, { recursive: true, force: true });
    throw error;
  }
}

export function isCommandAvailable(command: string): boolean {
  try {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(checker, [command], { stdio: 'ignore', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureOpenSpecCli(
  scope: InstallScope,
  projectPath: string,
): Promise<boolean> {
  const alreadyInstalled = isCommandAvailable('openspec');
  const label = alreadyInstalled ? 'Upgrading' : 'Installing';
  console.warn(`    ${label} OpenSpec CLI...`);
  try {
    const npmArgs =
      scope === 'global'
        ? ['install', '-g', '@fission-ai/openspec@latest']
        : ['install', '@fission-ai/openspec@latest'];
    execFileSync(getNpmExecutable(), npmArgs, {
      cwd: projectPath,
      stdio: 'inherit',
      timeout: 120_000,
      shell: process.platform === 'win32',
    });
    return isCommandAvailable('openspec');
  } catch (error) {
    if (alreadyInstalled) {
      console.warn(
        `    OpenSpec upgrade failed, using existing version: ${(error as Error).message}`,
      );
      return true;
    }
    console.error(`    Failed to install OpenSpec CLI: ${(error as Error).message}`);
    printCommandErrorDetails(error);
    return false;
  }
}

export async function installOpenSpec(
  projectPath: string,
  toolIds: string[],
  scope: InstallScope,
): Promise<'installed' | 'failed' | 'skipped'> {
  const cliReady = await ensureOpenSpecCli(scope, projectPath);
  if (!cliReady) {
    console.error(
      `    OpenSpec CLI not available. Install manually: npm install -g @fission-ai/openspec@latest`,
    );
    return 'failed';
  }

  const unknownIds = toolIds.filter((id) => !VALID_TOOL_IDS.has(id));
  if (unknownIds.length > 0) {
    throw new Error(`Unknown tool IDs: ${unknownIds.join(', ')}`);
  }

  let configHome: string | undefined;
  try {
    const openspecEnv = createOpenSpecAllWorkflowsEnv();
    configHome = openspecEnv.configHome;

    const invocation = buildOpenSpecInitInvocation(projectPath, toolIds, scope);
    try {
      execFileSync(invocation.command, invocation.args, {
        cwd: projectPath,
        env: openspecEnv.env,
        stdio: ['inherit', 'inherit', 'pipe'],
        timeout: 120_000,
        shell: process.platform === 'win32',
      });
    } catch (firstError) {
      const stderrText = (firstError as { stderr?: Buffer }).stderr?.toString() ?? '';
      if (stderrText.includes('unknown option') && stderrText.includes('--profile')) {
        console.warn('    OpenSpec does not support --profile flag, retrying without it...');
        const fallbackInvocation = buildOpenSpecInitInvocation(
          projectPath,
          toolIds,
          scope,
          os.homedir(),
          false,
        );
        execFileSync(fallbackInvocation.command, fallbackInvocation.args, {
          cwd: projectPath,
          env: openspecEnv.env,
          stdio: 'inherit',
          timeout: 120_000,
          shell: process.platform === 'win32',
        });
      } else {
        throw firstError;
      }
    }

    return 'installed';
  } catch (error) {
    console.error(`    OpenSpec init failed: ${(error as Error).message}`);
    printCommandErrorDetails(error);
    return 'failed';
  } finally {
    if (configHome) {
      fs.rmSync(configHome, { recursive: true, force: true });
    }
  }
}
