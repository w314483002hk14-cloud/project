import fs from 'fs';

const html = fs.readFileSync(new URL('../data/qs_full.html', import.meta.url), 'utf8');
const m = html.match(/data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
const s = JSON.parse(m[1]);
for (const [k, v] of Object.entries(s)) {
  if (/rank|qs|react|filter|wur|subject|algolia/i.test(k + JSON.stringify(v).slice(0, 500))) {
    console.log('\n===', k, '===\n', JSON.stringify(v, null, 2).slice(0, 3000));
  }
}
