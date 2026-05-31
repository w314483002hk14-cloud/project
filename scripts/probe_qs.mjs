const html = await fetch('https://www.topuniversities.com/world-university-rankings/2026').then((r) => r.text());
console.log('length', html.length);
const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (nextData) {
  const data = JSON.parse(nextData[1]);
  console.log('keys', Object.keys(data));
  console.log(JSON.stringify(data.props?.pageProps ?? data, null, 2).slice(0, 5000));
}
const drupal = html.match(/drupalSettings\s*=\s*(\{[\s\S]*?\});/);
if (drupal) console.log('drupal', drupal[1].slice(0, 2000));
