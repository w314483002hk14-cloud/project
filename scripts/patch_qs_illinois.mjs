/** Patch QS data for schools with known name typos (e.g. Illinois). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const schoolsPath = path.join(root, 'data', 'nycu_191_clean.json');
const outputPath = path.join(root, 'data', 'qs_rankings_2026.json');

const APP_ID = 'B9VSLB5GUV';
const API_KEY = 'c5a76d12563aa226198ec3dc8c27fefb';

async function algolia(index, body) {
  const res = await fetch(`https://${APP_ID}-dsn.algolia.net/1/indexes/${index}/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': APP_ID,
      'X-Algolia-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function normalizeWorldRank(wur) {
  if (!wur || wur === '-' || wur === 'N/A') return null;
  return String(wur).replace(/^=+/, '');
}

async function fetchSubjects(title) {
  const result = await algolia('live_tu_rankings', {
    query: title,
    hitsPerPage: 100,
    restrictSearchableAttributes: ['ranking_universities_field'],
  });
  const subjects = [];
  for (const hit of result.hits ?? []) {
    if (!String(hit.title ?? '').includes('Subject 2026')) continue;
    const field = hit._highlightResult?.ranking_universities_field?.value;
    if (!field) continue;
    const plain = field.replace(/<\/?em>/g, '');
    const parts = plain.split('|').map((p) => p.trim()).filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase().includes(title.toLowerCase().slice(0, 12)));
    if (idx < 0) continue;
    const subjectName = hit.title?.replace(/^QS World University Rankings by Subject 2026:\s*/i, '').trim();
    subjects.push({ subject: subjectName, rank: idx + 1 });
  }
  subjects.sort((a, b) => a.rank - b.rank);
  return subjects.slice(0, 4);
}

const schools = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));
const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

const targets = schools.filter((s) => s.name.includes('Illinois') || s.id === 189);
for (const school of targets) {
  const j = await algolia('live_tu_universities', {
    query: 'University of Illinois Urbana-Champaign',
    hitsPerPage: 5,
  });
  const uni = j.hits?.find((h) => h.title === 'University of Illinois Urbana-Champaign') ?? j.hits?.[0];
  if (!uni) continue;
  const worldRank = normalizeWorldRank(uni.wur_rank);
  const subjects = await fetchSubjects(uni.title);
  output.schools[school.id] = {
    world_rank: worldRank,
    world_rank_display: worldRank ? `#${worldRank}` : null,
    subjects,
    all_subjects: subjects,
    qs_title: uni.title,
    qs_path: uni.content_path ?? null,
  };
  console.log('Patched', school.id, school.name, 'WUR', worldRank, 'subjects', subjects.length);
}

output.synced_at = new Date().toISOString();
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
