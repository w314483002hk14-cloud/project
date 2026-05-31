const appId = 'B9VSLB5GUV';
const apiKey = 'c5a76d12563aa226198ec3dc8c27fefb';

async function q(body) {
  return fetch(`https://${appId}-dsn.algolia.net/1/indexes/live_tu_rankings/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

const j = await q({ query: 'Computer Science and Information Systems 2026', hitsPerPage: 3 });
console.log('hits', j.nbHits);
for (const hit of j.hits ?? []) {
  console.log('\nTITLE', hit.title, 'year', hit.year);
  for (const [k, v] of Object.entries(hit)) {
    if (k.startsWith('_')) continue;
    const text = typeof v === 'string' ? v : JSON.stringify(v);
    if (text.length < 300) console.log(k, text);
    else console.log(k, text.slice(0, 300) + '...');
  }
}
