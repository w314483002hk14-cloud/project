import fs from 'fs/promises';
import fsSync from 'fs';
import { resolveDataFile } from '@/lib/data-path';

export type School = {
  id: number;
  name: string;
  name_en: string;
  country: string;
  quota_full: string;
  eligibility_full: string;
  language_full: string;
  grade_full: string;
  remarks_full: string;
  lat: number;
  lng: number;
  geo_status: string;
  term_fall: boolean;
  term_spring: boolean;
  quota_fall: string;
  quota_spring: string;
  quota_unit: string;
  gpa_min: number | null;
  gpa_scale: number | null;
  ibt_min: number | null;
  ielts_min: number | null;
  toeic_min: number | null;
  jlpt_min_level: string | null;
  is_pioneer?: boolean;
};

export async function getSchoolData(): Promise<School[]> {
  const filePath = resolveDataFile('nycu_191_clean.json');
  if (!fsSync.existsSync(filePath)) {
    throw new Error(`School data file not found: ${filePath}`);
  }

  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as School[];
}
