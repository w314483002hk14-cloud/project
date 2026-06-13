const html = await fetch('https://www.topuniversities.com/subject-rankings/2026').then((r) => r.text());
console.log('len', html.length);
const m = html.match(/data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
if (m) {
  const s = JSON.parse(m[1]);
  console.log(Object.keys(s));
  for (const [k, v] of Object.entries(s)) {
    const t = JSON.stringify(v);
    if (/subject|rank|algolia|core_id/i.test(t)) console.log(k, t.slice(0, 800));
  }
}
