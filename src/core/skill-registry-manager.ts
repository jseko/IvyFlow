/**
 * Skill Registry Manager — tracks skill usage and provides registry management.
 *
 * v0.33: Usage tracking for quality metrics.
 */

import path from 'path';
import { fileExists, readFile, writeFile, ensureDir } from '../utils/fs.js';

export interface SkillRegistryEntry {
  name: string;
  version: string;
  status: 'active' | 'deprecated';
  usageCount: number;
  lastUsed: string | null;
  description: string;
}

const REGISTRY_PATH = '.ivy/sessions/cache/skill-usage.json';

export async function loadRegistry(cwd: string): Promise<SkillRegistryEntry[]> {
  const p = path.join(cwd, REGISTRY_PATH);
  if (!(await fileExists(p))) return [];
  try {
    return JSON.parse(await readFile(p)) as SkillRegistryEntry[];
  } catch {
    return [];
  }
}

export async function saveRegistry(cwd: string, entries: SkillRegistryEntry[]): Promise<void> {
  const p = path.join(cwd, REGISTRY_PATH);
  await ensureDir(path.dirname(p));
  await writeFile(p, JSON.stringify(entries, null, 2));
}

export async function trackSkillUsage(cwd: string, skillName: string): Promise<void> {
  const entries = await loadRegistry(cwd);
  const existing = entries.find((e) => e.name === skillName);
  if (existing) {
    existing.usageCount++;
    existing.lastUsed = new Date().toISOString();
  } else {
    entries.push({
      name: skillName,
      version: '1.0.0',
      status: 'active',
      usageCount: 1,
      lastUsed: new Date().toISOString(),
      description: '',
    });
  }
  await saveRegistry(cwd, entries);
}
