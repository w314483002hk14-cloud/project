const worldRes = await fetch('https://www.topuniversities.com/world-university-rankings/2026');
const cookies = worldRes.headers.getSetCookie?.() ?? [];
const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
console.log('cookies', cookies.length, cookieHeader.slice(0, 200));

const subjectRes = await fetch(
  'https://www.topuniversities.com/university-subject-rankings/computer-science-information-systems',
  {
    headers: {
      Cookie: cookieHeader,
      Referer: 'https://www.topuniversities.com/world-university-rankings/2026',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
);
const html = await subjectRes.text();
console.log('subject len', html.length, 'blocked', html.includes('Just a moment'), 'kyoto', html.includes('Kyoto'));
