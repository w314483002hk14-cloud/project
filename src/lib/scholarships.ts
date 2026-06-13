import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ScholarshipDoc = {
  fileurl: string;
  pdffileurl?: string;
  odffileurl?: string;
  expFile: string;
};

export type ScholarshipItem = {
  subject: string;
  dataClassName: string | null;
  pubUnitName: string;
  posterDate: string | null;
  updateDate: string;
  detailContent: string;
  summary: string;
  docs: ScholarshipDoc[];
  images: unknown[];
  videos: unknown[];
};

export type ScholarshipData = {
  synced_at: string;
  source: string;
  items: ScholarshipItem[];
};

export async function getScholarships(): Promise<ScholarshipData> {
  const filePath = path.resolve(__dirname, '../../../../data/scholarships.json');
  if (!fsSync.existsSync(filePath)) {
    return { synced_at: '', source: '', items: [] };
  }
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as ScholarshipData;
}
