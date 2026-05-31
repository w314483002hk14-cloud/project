const appId = 'B9VSLB5GUV';
const apiKey = 'c5a76d12563aa226198ec3dc8c27fefb';

const guesses = [
  'live_tu_subject_rankings',
  'live_tu_university_rankings',
  'live_tu_wur_rankings',
  'live_tu_rankings_by_subject',
  'live_tu_profiles',
];

for (const index of guesses) {
  const res = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/${index}/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'Kyoto', hitsPerPage: 1 }),
  });
  console.log(index, res.status, res.status === 200 ? (await res.json()).nbHits : '');
}
