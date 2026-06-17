import path from 'path';
import { promises as fs, type Dirent } from 'fs';

import { fileExists } from '../utils/fs.js';
import { getPlatformSkillsDir, type Platform } from './platforms.js';
import type { InstallScope } from './types.js';

export interface SecurityCheckOptions {
  cwd: string;
  platforms: Platform[];
  scope: InstallScope;
}

export interface SecurityWarning {
  type: 'missing-rule' | 'sensitive-file';
  message: string;
}

export interface SecurityResult {
  warnings: SecurityWarning[];
}

const SENSITIVE_FILENAMES = [
  '.env',
  '.envrc',
  'credentials.json',
  'credentials.toml',
  'secrets.yaml',
  'id_rsa',
  'id_ed25519',
  'service-account.json',
  'terraform.tfvars',
];

const SENSIVE_PATTERNS = [
  /^\.env\.?.*$/,        // .env, .env.local, .env.production
  /^.*\.pem$/,           // *.pem
  /^.*\.key$/,           // *.key
  /^firebase-.*\.json$/, // firebase-*.json
  /^\.aws\/credentials$/, // .aws/credentials
];

function isSensitiveFilename(name: string): boolean {
  if (SENSITIVE_FILENAMES.includes(name)) return true;
  return SENSIVE_PATTERNS.some((p) => p.test(name));
}

async function scanDirectory(dir: string, warnings: SecurityWarning[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(fullPath, warnings);
    } else if (isSensitiveFilename(entry.name)) {
      warnings.push({
        type: 'sensitive-file',
        message: `敏感文件 detected: ${path.relative(dir, fullPath)}`,
      });
    }
  }
}

export async function runSecurityCheck(opts: SecurityCheckOptions): Promise<SecurityResult> {
  const warnings: SecurityWarning[] = [];

  // 1. Check rule presence per platform
  for (const platform of opts.platforms) {
    if (!platform.rulesFormat) continue;
    const skillsDir = getPlatformSkillsDir(platform, opts.scope);
    const rulesDir = platform.rulesDir ?? 'rules';
    const ext = platform.rulesFormat === 'mdc' ? '.mdc' : '.md';
    const rulePath = path.join(opts.cwd, skillsDir, rulesDir, `ivy-security${ext}`);
    if (!(await fileExists(rulePath))) {
      warnings.push({
        type: 'missing-rule',
        message: `security rule not installed on ${platform.name}, run ivy init --overwrite`,
      });
    }
  }

  // 2. Scan for sensitive filenames (only filenames, never read content)
  await scanDirectory(opts.cwd, warnings);

  return { warnings };
}
