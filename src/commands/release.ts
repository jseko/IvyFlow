/**
 * `ivy release` — bundle completed change artifacts for handoff.
 *
 * Only works for changes in ARCHIVE phase. Bundles archive report, knowledge
 * YAML, evidence YAML, and L0 memory into .ivy/releases/<change-name>/.
 */

import path from 'path';
import { cp, rm } from 'fs/promises';

import { fileExists, ensureDir, readDir } from '../utils/fs.js';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { logger } from '../utils/logger.js';

// ─── Types ───

export interface ReleaseOptions {
  cwd?: string;
  change?: string;
  output?: string;
}

interface ProjectYaml {
  changes?: Array<{ name: string; phase: string }>;
  [key: string]: unknown;
}

// ─── Command Entry Point ───

export async function runRelease(opts: ReleaseOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const ivyDir = path.join(cwd, '.ivy');
  const changeName = opts.change;

  if (!changeName) {
    logger.error('--change <name> is required');
    return 1;
  }

  // 1) Verify change is in ARCHIVE phase
  const projectYamlPath = path.join(ivyDir, 'project.yaml');
  const projectYaml = await readYaml<ProjectYaml>(projectYamlPath);
  const changeEntry = projectYaml?.changes?.find((c) => c.name === changeName);

  if (!changeEntry) {
    logger.error(`Change "${changeName}" not found in project.yaml`);
    return 1;
  }

  if (changeEntry.phase !== 'archive') {
    logger.error(`Change "${changeName}" is in "${changeEntry.phase}" phase. Only ARCHIVE can be released.`);
    return 1;
  }

  // 2) Gather artifacts
  const outputDir = opts.output ?? path.join(ivyDir, 'releases', changeName);
  await ensureDir(outputDir);

  const artifacts: Array<{ src: string; label: string }> = [
    { src: path.join(ivyDir, 'archive', `${changeName}-*.md`), label: 'archive report' },
    { src: path.join(ivyDir, 'knowledge', `${changeName}.yaml`), label: 'knowledge' },
    { src: path.join(ivyDir, 'evidence', `${changeName}.yaml`), label: 'evidence' },
    { src: path.join(ivyDir, 'memory', changeName), label: 'L0 memory' },
  ];

  let copied = 0;
  let skipped = 0;

  for (const artifact of artifacts) {
    try {
      const resolved = artifact.src;

      if (resolved.endsWith('*')) {
        // Glob-like: copy from directory
        const dir = path.dirname(resolved);
        const files = await readDir(dir);
        const matching = files.filter((f) => f.startsWith(changeName));
        for (const f of matching) {
          await cp(path.join(dir, f), path.join(outputDir, f), { recursive: true, force: true });
          copied++;
        }
        if (matching.length === 0) skipped++;
      } else {
        if (await fileExists(resolved)) {
          const destName = path.basename(resolved);
          await cp(resolved, path.join(outputDir, destName), { recursive: true, force: true });
          copied++;
        } else {
          skipped++;
        }
      }
    } catch {
      skipped++;
    }
  }

  // 3) Summary
  logger.step(`Release: ${changeName}`);
  logger.success(`Bundled ${copied} artifact(s) to ${outputDir}`);
  if (skipped > 0) logger.dim(`  ${skipped} artifact(s) not found (skipped)`);

  // Write release manifest
  await writeYaml(path.join(outputDir, 'release.yaml'), {
    changeName,
    releaseDate: new Date().toISOString(),
    phase: 'archive',
    artifacts: {
      archiveReport: copied > 0 ? `${changeName}-*.md` : null,
      knowledge: copied > 0 ? `${changeName}.yaml` : null,
      evidence: copied > 0 ? `${changeName}.yaml` : null,
      memory: copied > 0 ? `${changeName}/` : null,
    },
  } as Record<string, unknown>);

  logger.dim(`  Manifest: release.yaml`);

  return 0;
}
