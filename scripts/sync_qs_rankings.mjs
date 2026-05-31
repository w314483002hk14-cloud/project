/**
 * Sync QS World University Rankings 2026 + Subject Rankings from TopUniversities Algolia API.
 * Source: https://www.topuniversities.com/world-university-rankings
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  matchUniversity,
  normalizeName,
  normalizeWorldRank,
  QS_MANUAL_RANK_BY_ID,
  APP_ID,
  API_KEY,
} from './qs-match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const schoolsPath = path.join(root, 'data', 'nycu_191_clean.json');
const outputPath = path.join(root, 'data', 'qs_rankings_2026.json');

const KEY_SUBJECTS = [
  'Engineering & Technology',
  'Computer Science and Information Systems',
  'Engineering - Electrical and Electronic',
  'Business and Management Studies',
  'Medicine',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  if (!res.ok) throw new Error(`Algolia error ${res.status}`);
  return res.json();
}

function parseSubjectRank(fieldValue, schoolTitle) {
  const plain = String(fieldValue).replace(/<\/?em>/g, '');
  const parts = plain.split('|').map((p) => p.trim()).filter(Boolean);
  const schoolNorm = normalizeName(schoolTitle);
  const idx = parts.findIndex((part) => {
    const partNorm = normalizeName(part.split('-')[0]);
    return partNorm.includes(schoolNorm) || schoolNorm.includes(partNorm);
  });
  if (idx < 0) return null;
  const label = parts[idx].split(',').pop()?.trim() ?? parts[idx];
  return { rank: idx + 1, subject: label.replace(/\s+$/, '') };
}

async function fetchSubjectRanks(schoolTitle) {
  const result = await algolia('live_tu_rankings', {
    query: schoolTitle,
    hitsPerPage: 100,
    restrictSearchableAttributes: ['ranking_universities_field'],
  });

  const subjects = [];
  for (const hit of result.hits ?? []) {
    if (!String(hit.title ?? '').includes('Subject 2026')) continue;
    if (String(hit.year ?? '') !== '2026') continue;
    const field = hit._highlightResult?.ranking_universities_field?.value;
    if (!field) continue;
    const parsed = parseSubjectRank(field, schoolTitle);
    if (!parsed) continue;
    const subjectName =
      hit.title?.replace(/^QS World University Rankings by Subject 2026:\s*/i, '').trim() ?? parsed.subject;
    subjects.push({ subject: subjectName, rank: parsed.rank });
  }

  subjects.sort((a, b) => a.rank - b.rank);
  return subjects;
}

function pickHighlightSubjects(allSubjects) {
  const picked = [];
  for (const key of KEY_SUBJECTS) {
    const match = allSubjects.find((s) => s.subject.toLowerCase().includes(key.toLowerCase().split(' ')[0]));
    if (match && !picked.some((p) => p.subject === match.subject)) picked.push(match);
  }
  const top = allSubjects.slice(0, 3);
  for (const item of top) {
    if (!picked.some((p) => p.subject === item.subject)) picked.push(item);
  }
  return picked.slice(0, 4);
}

const schools = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));
const output = {
  synced_at: new Date().toISOString(),
  source: 'https://www.topuniversities.com/world-university-rankings/2026',
  schools: {},
};

for (let i = 0; i < schools.length; i++) {
  const school = schools[i];
  process.stdout.write(`[${i + 1}/${schools.length}] ${school.name} ... `);

  try {
    const uni = await matchUniversity(school);
    if (!uni) {
      output.schools[school.id] = { world_rank: null, subjects: [], qs_title: null };
      console.log('no match');
      continue;
    }

    const subjects = await fetchSubjectRanks(uni.title);
    const manual = QS_MANUAL_RANK_BY_ID[school.id];
    const worldRank = manual?.world_rank ?? normalizeWorldRank(uni.wur_rank);
    output.schools[school.id] = {
      world_rank: worldRank,
      world_rank_display: worldRank ? `#${worldRank}` : null,
      subjects: pickHighlightSubjects(subjects),
      all_subjects: subjects,
      qs_title: manual?.qs_title ?? uni.title,
      qs_path: uni.content_path ?? null,
    };
    console.log(`WUR ${worldRank ?? '未列入'}, subjects ${subjects.length}, qs: ${uni.title}`);
    await sleep(120);
  } catch (error) {
    output.schools[school.id] = { world_rank: null, subjects: [], qs_title: null, error: String(error) };
    console.log('error', error.message);
    await sleep(300);
  }
}

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\nSaved ${outputPath}`);
