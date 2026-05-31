const url = 'https://oia.nycu.edu.tw/oia/ch/app/data/list?module=nycu0007&id=716';
const html = await fetch(url).then((r) => r.text());
const patterns = [
  /\/oia\/[^"'\s]+/g,
  /module=nycu[^"'\s]+/g,
  /fetch\([^)]+\)/g,
  /axios\.[a-z]+\([^)]+\)/g,
];
for (const p of patterns) {
  const m = [...new Set(html.match(p) ?? [])];
  if (m.length) console.log(p, m.slice(0, 20));
}
