import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OIA_JSON_URL =
  'https://oia.nycu.edu.tw/oia/ch/app/openData/data/list?module=nycu0007&mserno=0&type=json&id=716';
const outputPath = path.resolve(process.cwd(), '../../data/scholarships.json');

export async function GET() {
  try {
    const shouldSync =
      !fsSync.existsSync(outputPath) ||
      Date.now() - fsSync.statSync(outputPath).mtimeMs > 6 * 60 * 60 * 1000;

    if (shouldSync) {
      const items = await fetch(OIA_JSON_URL).then((r) => r.json());
      const payload = {
        synced_at: new Date().toISOString(),
        source: 'https://oia.nycu.edu.tw/oia/ch/app/data/list?module=nycu0007&id=716',
        items: Array.isArray(items) ? items : [],
      };
      await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    }

    const raw = await fs.readFile(outputPath, 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch (error) {
    return NextResponse.json({ error: String(error), items: [] }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
