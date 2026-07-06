import path from 'path';

/** Resolve bundled JSON under project data/. */
export function resolveDataFile(filename: string): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'data', filename);
}
