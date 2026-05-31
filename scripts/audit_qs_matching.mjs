/**
 * Audit QS matching gaps and test improved search terms.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const schools = JSON.parse(fs.readFileSync(path.join(root, 'data', 'nycu_191_clean.json'), 'utf8'));
const qs = JSON.parse(fs.readFileSync(path.join(root, 'data', 'qs_rankings_2026.json'), 'utf8'));

const APP_ID = 'B9VSLB5GUV';
const API_KEY = 'c5a76d12563aa226198ec3dc8c27fefb';

function stripAccents(text) {
  return String(text).normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeName(text) {
  return stripAccents(String(text ?? ''))
    .replace(/Univeristy/gi, 'University')
    .replace(/Univesity/gi, 'University')
    .replace(/Universite\b/gi, 'Université')
    .replace(/[–—‐‑]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(former|前)\s*[:：]?\s*[^)]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, ' ');
}

function tokenSet(text) {
  const stop = new Set(['university', 'université', 'universite', 'of', 'the', 'de', 'la', 'le', 'des', 'du', 'and', 'at', 'in']);
  return new Set(
    normalizeName(text)
      .split(' ')
      .filter((t) => t.length > 2 && !stop.has(t))
  );
}

function scoreMatch(schoolNorm, hitTitle) {
  const hitNorm = normalizeName(hitTitle);
  if (schoolNorm === hitNorm) return 100;
  if (hitNorm.includes(schoolNorm) || schoolNorm.includes(hitNorm)) return 85;

  const schoolTokens = tokenSet(schoolNorm);
  const hitTokens = tokenSet(hitTitle);
  if (schoolTokens.size === 0 || hitTokens.size === 0) return 0;

  let overlap = 0;
  for (const t of schoolTokens) {
    if (hitTokens.has(t)) overlap += 1;
  }
  const ratio = overlap / Math.min(schoolTokens.size, hitTokens.size);
  return Math.round(ratio * 80);
}

function getSearchTerms(name, nameEn) {
  const terms = new Set();
  for (const raw of [name, nameEn]) {
    if (!raw || /[\u4e00-\u9fff]/.test(raw)) continue;
    const fixed = raw
      .replace(/Univeristy/gi, 'University')
      .replace(/Univesity/gi, 'University')
      .replace(/Institut Teknoloi/i, 'Institut Teknologi')
      .replace(/\s+/g, ' ')
      .trim();
    terms.add(fixed);
    terms.add(fixed.replace(/[–—‐‑-]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim());
    terms.add(fixed.replace(/\(.*\)/, '').trim());

    const withoutPrefix = fixed.replace(/^(the\s+)?(university|université|universite)\s+of\s+/i, '').trim();
    if (withoutPrefix.length > 4) terms.add(withoutPrefix);

    if (/Paul Sabatier|Toulouse III/i.test(fixed)) {
      terms.add('Université Paul Sabatier Toulouse III');
      terms.add('Paul Sabatier Toulouse');
    }
    if (/Illinois.*Urbana/i.test(fixed)) {
      terms.add('University of Illinois Urbana-Champaign');
    }
    if (/Science Tokyo|Tokyo Tech/i.test(fixed)) {
      terms.add('Institute of Science Tokyo');
      terms.add('Tokyo Institute of Technology');
    }
    if (/Rennes 1/i.test(fixed)) terms.add('University of Rennes');
    if (/Paris-Est Créteil|UPEC/i.test(fixed)) terms.add('Université Paris-Est Créteil Val de Marne');
    if (/Bruxelles|ULB/i.test(fixed)) terms.add('Université libre de Bruxelles');
    if (/Czech Technical/i.test(fixed)) terms.add('Czech Technical University in Prague');
    if (/Kwansei Gakuin|KGU/i.test(fixed)) terms.add('Kwansei Gakuin University');
    if (/UTM\b/i.test(fixed) && /Malaysia/i.test(fixed)) terms.add('Universiti Teknologi Malaysia');
    if (/SUTD/i.test(fixed)) terms.add('Singapore University of Technology and Design');
    if (/KMUTT/i.test(fixed)) terms.add("King Mongkut's University of Technology Thonburi");
    if (/Sepuluh Nopember|ITS/i.test(fixed)) terms.add('Institut Teknologi Sepuluh Nopember');
  }
  return Array.from(terms).filter(Boolean);
}

async function algolia(query) {
  const res = await fetch(`https://${APP_ID}-dsn.algolia.net/1/indexes/live_tu_universities/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': APP_ID,
      'X-Algolia-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, hitsPerPage: 10 }),
  });
  return (await res.json()).hits ?? [];
}

async function findBestMatch(school) {
  const schoolNorm = normalizeName(school.name);
  const terms = getSearchTerms(school.name, school.name_en);
  let best = null;
  let bestScore = 0;

  for (const term of terms) {
    const hits = await algolia(term);
    for (const hit of hits) {
      const score = scoreMatch(schoolNorm, hit.title);
      const rank = hit.wur_rank;
      const hasRank = rank && rank !== '-' && rank !== 'N/A';
      const adjusted = score + (hasRank ? 5 : 0);
      if (adjusted > bestScore && score >= 45) {
        bestScore = adjusted;
        best = hit;
      }
    }
  }
  return { best, bestScore };
}

const unmatched = schools.filter((s) => {
  const r = qs.schools[s.id];
  return !r?.qs_title && !r?.world_rank;
});

console.log(`Unmatched: ${unmatched.length}/${schools.length}\n`);

for (const school of unmatched) {
  const { best, bestScore } = await findBestMatch(school);
  const wur = best?.wur_rank ?? '-';
  console.log(
    `[${school.id}] ${school.name.slice(0, 55)}`,
    `\n  -> ${best ? `${best.title} (score ${bestScore}, WUR ${wur})` : 'NO MATCH'}`
  );
  await new Promise((r) => setTimeout(r, 100));
}
