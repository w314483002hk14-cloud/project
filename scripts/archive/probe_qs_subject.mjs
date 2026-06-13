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

const rankings = await algolia('live_tu_rankings', {
  query: 'Subject',
  hitsPerPage: 20,
  filters: 'year:2026',
});
console.log(
  rankings.hits?.map((h) => ({ title: h.title, path: h.content_path, year: h.year })),
);

const kyoto = await algolia('live_tu_universities', { query: 'Kyoto University', hitsPerPage: 1 });
const path = kyoto.hits?.[0]?.content_path;
console.log('path', path);

const html = await fetch(`https://www.topuniversities.com${path}/rankings`, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'text/html',
  },
}).then((r) => r.text());
console.log('rankings html len', html.length, 'status snippet', html.slice(0, 100));
const rankMatch = html.match(/Computer Science[^<]{0,80}/gi);
console.log('cs matches', rankMatch?.slice(0, 5));
