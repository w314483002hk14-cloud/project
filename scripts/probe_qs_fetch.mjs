const urls = [
  'https://www.topuniversities.com/university-subject-rankings/computer-science-information-systems',
  'https://www.topuniversities.com/university-subject-rankings/engineering-technology',
  'https://www.topuniversities.com/world-university-rankings/2026',
];

for (const url of urls) {
  const html = await fetch(url).then((r) => r.text());
  console.log(url, html.length, html.includes('Just a moment'), html.includes('Kyoto University'));
}
