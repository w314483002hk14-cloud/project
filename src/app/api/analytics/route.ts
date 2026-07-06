import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { isServerlessDeploy } from '@/lib/data-path';
import { isValidEventType, isValidSchoolId, sanitizeText } from '@/lib/security';

export const runtime = 'nodejs';

type AnalyticsBody = {
  event_type: 'view' | 'favorite' | 'unfavorite' | 'comment';
  school_id: number;
  school_name: string;
  country: string;
  region: string;
  extra?: string;
};

const analyticsDir = path.resolve(process.cwd(), 'data/analytics');
const analyticsFile = path.join(analyticsDir, 'nycu_analytics.xlsx');

const headers = ['時間', '事件類型', '區域', '國家', '學校ID', '學校名稱', '備註'];

async function ensureWorkbook() {
  await fs.mkdir(analyticsDir, { recursive: true });
  if (!fsSync.existsSync(analyticsFile)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, 'events');
    XLSX.writeFile(wb, analyticsFile);
  }
}

function eventLabel(type: AnalyticsBody['event_type']) {
  if (type === 'view') return '點擊查看';
  if (type === 'favorite') return '收藏';
  if (type === 'unfavorite') return '取消收藏';
  return '留言';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyticsBody;
    if (!isValidEventType(body?.event_type) || !isValidSchoolId(body?.school_id)) {
      return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });
    }

    if (isServerlessDeploy()) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const safeBody: AnalyticsBody = {
      event_type: body.event_type,
      school_id: body.school_id,
      school_name: sanitizeText(body.school_name, 120),
      country: sanitizeText(body.country, 40),
      region: sanitizeText(body.region, 20),
      extra: sanitizeText(body.extra, 80),
    };

    await ensureWorkbook();
    const wb = XLSX.readFile(analyticsFile);
    const ws = wb.Sheets.events;
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    const now = new Date();
    const timestamp = now.toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' });

    rows.push([
      timestamp,
      eventLabel(safeBody.event_type),
      safeBody.region ?? '',
      safeBody.country ?? '',
      String(safeBody.school_id),
      safeBody.school_name ?? '',
      safeBody.extra ?? '',
    ]);

    const nextSheet = XLSX.utils.aoa_to_sheet(rows);
    wb.Sheets.events = nextSheet;
    XLSX.writeFile(wb, analyticsFile);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
