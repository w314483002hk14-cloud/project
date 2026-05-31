import fs from 'fs';

const html = await fetch('https://www.topuniversities.com/world-university-rankings/2026').then((r) => r.text());
fs.writeFileSync(new URL('../data/qs_full.html', import.meta.url), html);
console.log('saved', html.length, 'has MIT', html.includes('Massachusetts'));

const appId = 'B9VSLB5GUV';
const apiKey = 'c5a76d12563aa226198ec3dc8c27fefb';
const indexes = await fetch(`https://${appId}-dsn.algolia.net/1/indexes`, {
  headers: { 'X-Algolia-Application-Id': appId, 'X-Algolia-API-Key': apiKey },
}).then((r) => r.json());
console.log('indexes', indexes.items?.map((i) => i.name));
