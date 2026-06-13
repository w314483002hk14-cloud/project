const appId = 'B9VSLB5GUV';
const apiKey = 'c5a76d12563aa226198ec3dc8c27fefb';

async function algolia(index, body) {
  const res = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/${index}/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

const subjectHits = await algolia('live_tu_rankings', {
  query: 'Kyoto University',
  hitsPerPage: 10,
  filters: 'year:2026',
});
for (const hit of subjectHits.hits ?? []) {
  console.log(hit.title, hit.content_path);
  const field = hit.ranking_universities_field ?? '';
  if (field.includes('Kyoto')) console.log('  match:', field.slice(0, 500));
}

const cs = await algolia('live_tu_rankings', {
  query: 'Computer Science',
  hitsPerPage: 5,
  filters: 'year:2026',
});
console.log(
  '\nCS rankings:',
  cs.hits?.map((h) => ({ title: h.title, path: h.content_path })),
);
