/** Re-match and patch specific schools after improving qs-match.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchUniversity, normalizeWorldRank, algoliaUniversities } from './qs-match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const schoolsPath = path.join(root, 'data', 'nycu_191_clean.json');
const outputPath = path.join(root, 'data', 'qs_rankings_2026.json');

const FIX_IDS = [92, 136, 141, 165];

const schools = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));
const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

async function exactTitle(title) {
  const hits = await algoliaUniversities(title);
  return hits.find((h) => h.title === title) ?? hits[0] ?? null;
}

for (const id of FIX_IDS) {
  const school = schools.find((s) => s.id === id);
  if (!school) continue;

  let uni = await matchUniversity(school);
  if (id === 92) {
    uni = await exactTitle('The Chinese University of Hong Kong');
    if (!uni || String(uni.title).includes('Shenzhen')) {
      const hits = await algoliaUniversities('Chinese University Hong Kong');
      uni = hits.find((h) => h.title === 'The Chinese University of Hong Kong' && !h.title.includes('Shenzhen')) ?? uni;
    }
  }

  const worldRank = uni ? normalizeWorldRank(uni.wur_rank) : null;
  output.schools[id] = {
    ...output.schools[id],
    world_rank: worldRank,
    world_rank_display: worldRank ? `#${worldRank}` : null,
    qs_title: uni?.title ?? null,
    qs_path: uni?.content_path ?? null,
  };
  console.log(`Patched ${id} ${school.name} -> ${uni?.title ?? 'none'} WUR ${worldRank ?? '未列入'}`);
}

output.synced_at = new Date().toISOString();
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Done');
