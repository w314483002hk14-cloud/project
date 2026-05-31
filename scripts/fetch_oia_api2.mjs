const url = 'https://oia.nycu.edu.tw/oia/ch/app/data/list?module=nycu0007&id=716';
const html = await fetch(url).then((r) => r.text());
const keywords = ['listData', 'getData', 'queryData', 'ajax', 'fetch(', 'axios', 'xml', 'json', 'pageSize', 'rows', 'total'];
for (const k of keywords) {
  const idx = html.indexOf(k);
  if (idx >= 0) console.log('\n===', k, '===\n', html.slice(Math.max(0, idx - 120), idx + 200));
}
