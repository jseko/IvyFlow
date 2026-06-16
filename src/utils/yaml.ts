/**
 * Lightweight YAML I/O helpers for `.ivy.yaml` and `.ivy/project.yaml`.
 *
 * Wraps the `yaml` library so callers don't have to import it directly and
 * so we can swap implementations later without ripple. We deliberately
 * preserve the document structure on partial updates (e.g., writing the
 * `adoption:` block must not strip unrelated top-level keys).
 */

import path from 'path';
import { parse, stringify } from 'yaml';

import { fileExists, ensureDir, readFile, writeFile } from './fs.js';

export type YamlObject = Record<string, unknown>;

export async function readYaml<T extends object = YamlObject>(
  filePath: string,
): Promise<T | null> {
  if (!(await fileExists(filePath))) return null;
  const raw = await readFile(filePath);
  const data = parse(raw);
  if (data === null || data === undefined) return {} as T;
  if (typeof data !== 'object') {
    throw new Error(`Expected a YAML mapping at ${filePath}, got ${typeof data}`);
  }
  return data as T;
}

export async function writeYaml(filePath: string, data: YamlObject): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, stringify(data));
}

/**
 * Merge `patch` into the YAML document at `filePath`. Top-level keys not
 * present in `patch` are preserved verbatim. Creates the file if missing.
 */
export async function patchYaml(filePath: string, patch: YamlObject): Promise<void> {
  const existing = (await readYaml(filePath)) ?? {};
  const merged = { ...existing, ...patch };
  await writeYaml(filePath, merged);
}
