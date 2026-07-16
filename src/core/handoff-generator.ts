/**
 * Handoff Generator — context package generation for phase transitions.
 *
 * Generates design-context.json (machine index) and design-context.md
 * (human-readable context) with SHA256 integrity for guard verification.
 */

import path from 'path';
import crypto from 'crypto';
import { ensureDir, writeFile, readFile, fileExists } from '../utils/fs.js';
import { readYaml } from '../utils/yaml.js';
import type { StateYaml } from './lifecycle-projection.js';

export interface HandoffFileEntry {
  path: string;
  role: 'spec' | 'supporting';
  sha256: string;
}

export interface HandoffJson {
  change: string;
  phase: string;
  generatedAt: string;
  context_hash: string;
  files: HandoffFileEntry[];
}

export interface HandoffResult {
  jsonPath: string;
  mdPath: string;
  contextHash: string;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function computeContextHash(sourceFiles: Array<{ path: string; content: string }>): string {
  const hash = crypto.createHash('sha256');
  for (const f of sourceFiles.sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(f.content);
  }
  return hash.digest('hex');
}

export async function generateHandoff(
  cwd: string,
  changeName: string,
  phase: string,
  opts?: { full?: boolean },
): Promise<HandoffResult> {
  const changeDir = path.join(cwd, 'openspec', 'changes', changeName);
  const handoffDir = path.join(changeDir, '.ivy', 'handoff');
  await ensureDir(handoffDir);

  const sourceFiles: Array<{ path: string; content: string; role: 'spec' | 'supporting' }> = [];

  const artifacts = ['proposal.md', 'design.md', 'tasks.md'];
  for (const art of artifacts) {
    const fp = path.join(changeDir, art);
    if (await fileExists(fp)) {
      const content = await readFile(fp);
      sourceFiles.push({ path: art, content, role: 'supporting' });
    }
  }

  const specsDir = path.join(changeDir, 'specs');
  if (await fileExists(specsDir)) {
    const { readDir } = await import('../utils/fs.js');
    const entries = await readDir(specsDir);
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const fp = path.join(specsDir, entry);
        const content = await readFile(fp);
        sourceFiles.push({ path: `specs/${entry}`, content, role: 'spec' });
      }
    }
  }

  const contextHash = computeContextHash(sourceFiles);

  const json: HandoffJson = {
    change: changeName,
    phase,
    generatedAt: new Date().toISOString(),
    context_hash: contextHash,
    files: sourceFiles.map((f) => ({
      path: f.path,
      role: f.role,
      sha256: sha256(f.content),
    })),
  };

  const jsonPath = path.join(handoffDir, `${phase}-context.json`);
  const mdPath = path.join(handoffDir, `${phase}-context.md`);

  await writeFile(jsonPath, JSON.stringify(json, null, 2));

  const maxLines = opts?.full ? Infinity : 80;
  const mdLines: string[] = [];
  mdLines.push(`# ${phase} Context — ${changeName}`);
  mdLines.push('');
  mdLines.push(`Generated-by: ivy-handoff`);
  mdLines.push(`Mode: ${opts?.full ? 'full' : 'compact'}`);
  mdLines.push(`Context-Hash: ${contextHash}`);
  mdLines.push('');

  for (const f of sourceFiles) {
    mdLines.push(`## ${f.path} (${f.role})`);
    mdLines.push(`SHA256: ${sha256(f.content)}`);
    mdLines.push('');
    const lines = f.content.split('\n');
    if (lines.length > maxLines && !opts?.full) {
      mdLines.push(...lines.slice(0, maxLines));
      mdLines.push('');
      mdLines.push(`[TRUNCATED — ${lines.length - maxLines} more lines. Full source: ${f.path}]`);
    } else {
      mdLines.push(...lines);
    }
    mdLines.push('');
  }

  await writeFile(mdPath, mdLines.join('\n'));

  return { jsonPath, mdPath, contextHash };
}

export async function computeHandoffHashOnly(cwd: string, changeName: string): Promise<string> {
  const changeDir = path.join(cwd, 'openspec', 'changes', changeName);
  const sourceContents: Array<{ path: string; content: string }> = [];

  const artifacts = ['proposal.md', 'design.md', 'tasks.md'];
  for (const art of artifacts) {
    const fp = path.join(changeDir, art);
    if (await fileExists(fp)) {
      sourceContents.push({ path: art, content: await readFile(fp) });
    }
  }

  const specsDir = path.join(changeDir, 'specs');
  if (await fileExists(specsDir)) {
    const { readDir } = await import('../utils/fs.js');
    const entries = await readDir(specsDir);
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        sourceContents.push({ path: `specs/${entry}`, content: await readFile(path.join(specsDir, entry)) });
      }
    }
  }

  return computeContextHash(sourceContents);
}
