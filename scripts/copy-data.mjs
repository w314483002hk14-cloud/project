/**
 * Ensure required JSON exists in data/ for Vercel deployment.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');

const files = ['nycu_191_clean.json', 'qs_rankings_2026.json', 'scholarships.json'];

fs.mkdirSync(dataDir, { recursive: true });

for (const file of files) {
  const dest = path.join(dataDir, file);
  if (fs.existsSync(dest)) {
    console.log(`[copy-data] ok ${file}`);
    continue;
  }
  console.warn(`[copy-data] missing ${file}`);
}
