const appId = 'B9VSLB5GUV';
const apiKey = 'c5a76d12563aa226198ec3dc8c27fefb';

const j = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/live_tu_rankings/query`, {
  method: 'POST',
  headers: {
    'X-Algolia-Application-Id': appId,
    'X-Algolia-API-Key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'Kyoto University',
    hitsPerPage: 50,
    restrictSearchableAttributes: ['ranking_universities_field'],
  }),
}).then((r) => r.json());

for (const hit of j.hits ?? []) {
  if (!hit.title?.includes('Subject 2026')) continue;
  const field = hit._highlightResult?.ranking_universities_field?.value ?? '';
  const plain = field.replace(/<\/?em>/g, '');
  const parts = plain.split('|').map((p) => p.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => /Kyoto University/i.test(p));
  if (idx >= 0) {
    console.log(hit.title.slice(-60), 'rank position', idx + 1, '/', parts.length, '|', parts[idx]);
  }
}
