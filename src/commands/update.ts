import { logger } from '../utils/logger.js';
import { getLocalVersion } from '../core/version.js';

export interface UpdateOptions {
  check?: boolean;
  cwd?: string;
}

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch('https://registry.npmjs.org/ivyflow-cli/latest');
    if (!res.ok) return null;
    const data = await res.json() as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export async function runUpdate(opts: UpdateOptions = {}): Promise<number> {
  const localVersion = getLocalVersion();
  const remoteVersion = await fetchRemoteVersion();

  if (remoteVersion === null) {
    logger.warn('离线模式，无法检查更新');
    return 0;
  }

  const cmp = semverCompare(remoteVersion, localVersion);

  if (cmp === 0) {
    if (!opts.check) {
      logger.success(`已是最新 v${localVersion}`);
    }
    return 0;
  }

  if (cmp > 0) {
    if (opts.check) {
      return 1;
    }
    logger.warn(`新版本可用：v${localVersion} → v${remoteVersion}`);
    logger.info(`请手动运行：npm install -g ivyflow-cli@${remoteVersion}`);
    return 0;
  }

  // cmp < 0: local is ahead (dev build)
  if (!opts.check) {
    logger.info(`本地版本超前（可能是开发版）：v${localVersion} > v${remoteVersion}`);
  }
  return 0;
}
