import { promises as fs } from 'fs';
import path from 'path';

async function resolveSymlinkPath(filePath: string): Promise<string> {
  try {
    return await fs.realpath(filePath);
  } catch {
    const dir = path.dirname(filePath);
    if (dir === filePath) return filePath;

    const resolvedDir = await resolveSymlinkPath(dir);
    const base = path.basename(filePath);

    try {
      const stat = await fs.lstat(path.join(resolvedDir, base));
      if (stat.isSymbolicLink()) {
        const target = await fs.readlink(path.join(resolvedDir, base));
        return path.resolve(resolvedDir, target);
      }
    } catch {
      /* segment doesn't exist — fall through */
    }

    return path.join(resolvedDir, base);
  }
}

export async function ensureDir(dir: string): Promise<void> {
  const resolved = await resolveSymlinkPath(dir);
  await fs.mkdir(resolved, { recursive: true });
}

export async function copyFile(src: string, dest: string): Promise<void> {
  const resolvedDest = await resolveSymlinkPath(dest);
  await ensureDir(path.dirname(resolvedDest));
  await fs.copyFile(src, resolvedDest);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string, options?: { flag?: string }): Promise<void> {
  const resolved = await resolveSymlinkPath(filePath);
  await ensureDir(path.dirname(resolved));
  await fs.writeFile(resolved, content, { encoding: 'utf-8', flag: options?.flag });
}

export async function appendFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, { flag: 'a' });
}

export async function readDir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return [];
    }
    throw error;
  }
}

export async function chmod(filePath: string, mode: number): Promise<void> {
  await fs.chmod(filePath, mode);
}
