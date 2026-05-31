import fs from 'fs';
const html = await fetch('https://www.topuniversities.com/world-university-rankings/2026').then((r) => r.text());
fs.writeFileSync('c:/Users/user/Desktop/data visual/project/data/qs_page_sample.html', html.slice(0, 50000));
const urls = [...new Set([...html.matchAll(/https?:\/\/[^"'\s]+/g)].map((m) => m[0]))].filter((u) =>
  /rank|api|json|data|graphql|search/i.test(u),
);
console.log(urls.slice(0, 40));
