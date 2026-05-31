import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { QsRankingData } from '@/lib/qs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function getQsRankings(): Promise<QsRankingData> {
  const filePath = path.resolve(__dirname, '../../../../data/qs_rankings_2026.json');
  if (!fsSync.existsSync(filePath)) {
    return { synced_at: '', source: '', schools: {} };
  }
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as QsRankingData;
}
