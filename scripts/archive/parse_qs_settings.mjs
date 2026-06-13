import fs from 'fs';
const html = fs.readFileSync('c:/Users/user/Desktop/data visual/project/data/qs_page_sample.html', 'utf8');
const match = html.match(/data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
if (!match) {
  console.log('no drupal settings');
  process.exit(1);
}
const settings = JSON.parse(match[1]);
console.log(JSON.stringify(settings, null, 2).slice(0, 8000));
