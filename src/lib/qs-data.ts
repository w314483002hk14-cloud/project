import fs from 'fs/promises';
import fsSync from 'fs';
import type { QsRankingData } from '@/lib/qs';
import { resolveDataFile } from '@/lib/data-path';

export async function getQsRankings(): Promise<QsRankingData> {
  const filePath = resolveDataFile('qs_rankings_2026.json');
  if (!fsSync.existsSync(filePath)) {
    return { synced_at: '', source: '', schools: {} };
  }
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as QsRankingData;
}
