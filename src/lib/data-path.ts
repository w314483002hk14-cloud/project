import fsSync from 'fs';
import path from 'path';

/** Resolve bundled data (Vercel) or monorepo data (local dev). */
export function resolveDataFile(filename: string): string {
  const candidates = [path.join(process.cwd(), 'data', filename)];

  for (const filePath of candidates) {
    if (fsSync.existsSync(filePath)) return filePath;
  }

  return candidates[0];
}

export function isServerlessDeploy() {
  return process.env.VERCEL === '1';
}
