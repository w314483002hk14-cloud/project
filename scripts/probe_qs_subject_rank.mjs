const appId = 'B9VSLB5GUV';
const apiKey = 'c5a76d12563aa226198ec3dc8c27fefb';

async function getSubjectHit(subjectQuery) {
  const j = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/live_tu_rankings/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: subjectQuery,
      hitsPerPage: 1,
    }),
  }).then((r) => r.json());
  return j.hits?.[0];
}

async function findRankInField(schoolName, subjectQuery) {
  const hit = await getSubjectHit(subjectQuery);
  if (!hit) return null;

  const search = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/live_tu_rankings/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: schoolName,
      hitsPerPage: 1,
      restrictSearchableAttributes: ['ranking_universities_field'],
      filters: `objectID:${hit.objectID}`,
    }),
  }).then((r) => r.json());

  const field = search.hits?.[0]?._highlightResult?.ranking_universities_field?.value ?? '';
  const plain = field.replace(/<\/?em>/g, '');
  const parts = plain.split('|').map((p) => p.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => p.toLowerCase().includes(schoolName.toLowerCase()));
  console.log(subjectQuery, 'parts', parts.length, 'idx', idx, parts[idx]?.slice(0, 120));
  return idx >= 0 ? idx + 1 : null;
}

await findRankInField('Kyoto University', 'Computer Science and Information Systems 2026');
await findRankInField('Kyoto University', 'Engineering and Technology 2026');
await findRankInField('Massachusetts Institute of Technology', 'Computer Science and Information Systems 2026');
