const html = await fetch('https://www.topuniversities.com/universities/kyoto-university').then((r) => r.text());
const m = html.match(/data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
const s = JSON.parse(m[1]);
console.log('top keys', Object.keys(s));
for (const [k, v] of Object.entries(s)) {
  const text = JSON.stringify(v);
  if (/subject|wur|ranking/i.test(text)) {
    console.log('\n===', k, '===\n', text.slice(0, 2500));
  }
}
