/** Shared QS Algolia university matching helpers */

export const APP_ID = 'B9VSLB5GUV';
export const API_KEY = 'c5a76d12563aa226198ec3dc8c27fefb';

export const COUNTRY_TO_QS = {
  法國: 'France',
  美國: 'United States',
  德國: 'Germany',
  日本: 'Japan',
  韓國: 'South Korea',
  大陸地區: 'China (Mainland)',
  香港: 'Hong Kong SAR',
  新加坡: 'Singapore',
  馬來西亞: 'Malaysia',
  泰國: 'Thailand',
  越南: 'Vietnam',
  印尼: 'Indonesia',
  印度: 'India',
  澳洲: 'Australia',
  紐西蘭: 'New Zealand',
  加拿大: 'Canada',
  墨西哥: 'Mexico',
  巴西: 'Brazil',
  阿根廷: 'Argentina',
  智利: 'Chile',
  西班牙: 'Spain',
  義大利: 'Italy',
  荷蘭: 'Netherlands',
  比利時: 'Belgium',
  瑞士: 'Switzerland',
  奧地利: 'Austria',
  瑞典: 'Sweden',
  挪威: 'Norway',
  芬蘭: 'Finland',
  丹麥: 'Denmark',
  波蘭: 'Poland',
  捷克: 'Czech Republic',
  匈牙利: 'Hungary',
  土耳其: 'Turkey',
  以色列: 'Israel',
  南非: 'South Africa',
  埃及: 'Egypt',
  英國: 'United Kingdom',
  愛爾蘭: 'Ireland',
  葡萄牙: 'Portugal',
  希臘: 'Greece',
  立陶宛: 'Lithuania',
  拉脫維亞: 'Latvia',
  愛沙尼亞: 'Estonia',
  烏克蘭: 'Ukraine',
  俄羅斯: 'Russia',
};

/** School id → manual QS rank when Algolia wur_rank is missing but rank is known */
export const QS_MANUAL_RANK_BY_ID = {
  182: {
    world_rank: '701-800',
    qs_title: 'Université du Québec à Montréal (UQAM)',
  },
};

/** Manual overrides when fuzzy match is unreliable (exact Algolia title) */
export const QS_MANUAL_ALIASES = {
  'Institute of Science Tokyo (former Tokyo Tech)': 'Institute of Science Tokyo',
  'Université Toulouse III – Paul Sabatier (UPS)': 'Université Paul Sabatier Toulouse III',
  'University of Rennes 1': 'Université de Rennes',
  'University Paris-Est Créteil (UPEC)': 'Université Paris-Est Créteil Val de Marne',
  'The State University of New York at Stony Brook': 'Stony Brook University, State University of New York',
  'Technical University of Dresden': 'Technische Universität Dresden',
  'Vilnius Gediminas Technical University (VGTU)': 'VILNIUS TECH (Vilnius Gediminas Technical University)',
  'Metropolitan Autonomous University': 'Universidad Autónoma Metropolitana (UAM)',
  'Institut TeknoloiSepuluh Nopember (ITS)': 'Institut Teknologi Sepuluh Nopember (ITS Surabaya)',
  'Universite libre de Bruxelles (ULB)': 'Université libre de Bruxelles',
  'University of Stuttgart': 'Universität Stuttgart',
  'Swiss Federal Institute of Technology in Zurich': 'ETH Zurich',
  'University of Technology of Troyes': 'Université  de Technologie, Troyes (UTT) - France',
  'Université du Québec à Montréal (UQAM)': 'Université du Québec à Montréal (UQAM)',
  'The Chinese University of Hong Kong': 'The Chinese University of Hong Kong',
};

/** School id → exact QS title when name data is truncated or ambiguous */
export const QS_MANUAL_BY_ID = {
  136: 'Université de Technologie de Compiègne (UTC)',
  141: 'Université  de Technologie, Troyes (UTT) - France',
  165: 'ETH Zurich',
};

export function stripAccents(text) {
  return String(text).normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizeName(text) {
  return stripAccents(String(text ?? ''))
    .replace(/Univeristy/gi, 'University')
    .replace(/Univesity/gi, 'University')
    .replace(/Institut Teknoloi/i, 'Institut Teknologi')
    .replace(/[–—‐‑]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(former|前)\s*[:：]?\s*[^)]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, ' ');
}

function tokenSet(text) {
  const stop = new Set([
    'university',
    'université',
    'universite',
    'universitat',
    'universität',
    'of',
    'the',
    'de',
    'la',
    'le',
    'des',
    'du',
    'and',
    'at',
    'in',
    'for',
    'school',
    'institute',
    'institut',
    'college',
  ]);
  return new Set(
    normalizeName(text)
      .split(' ')
      .filter((t) => t.length > 2 && !stop.has(t))
  );
}

export function scoreMatch(schoolName, hitTitle) {
  const schoolNorm = normalizeName(schoolName);
  const hitNorm = normalizeName(hitTitle);
  if (schoolNorm === hitNorm) return 100;
  if (hitNorm.includes(schoolNorm) || schoolNorm.includes(hitNorm)) return 85;

  const schoolTokens = tokenSet(schoolName);
  const hitTokens = tokenSet(hitTitle);
  if (schoolTokens.size === 0 || hitTokens.size === 0) return 0;

  let overlap = 0;
  for (const t of schoolTokens) {
    if (hitTokens.has(t)) overlap += 1;
  }
  return Math.round((overlap / Math.min(schoolTokens.size, hitTokens.size)) * 80);
}

export function scoreHit(school, hit) {
  let score = scoreMatch(school.name, hit.title);

  const qsCountry = COUNTRY_TO_QS[school.country];
  if (qsCountry && hit.campus_country) {
    if (hit.campus_country === qsCountry) score += 12;
    else if (school.country && score < 95) score -= 40;
  }

  const rank = hit.wur_rank;
  const hasRank = rank && rank !== '-' && rank !== 'N/A';
  if (hasRank) score += 5;

  if (QS_MANUAL_BY_ID[school.id] === hit.title) score = 120;

  return score;
}

export function extractParenAcronym(name) {
  const m = String(name).match(/\(([A-Z][A-Za-z0-9-]{1,12})\)/);
  return m?.[1] ?? null;
}

export function getSearchTerms(name, nameEn, schoolId) {
  const terms = new Set();

  if (schoolId && QS_MANUAL_BY_ID[schoolId]) terms.add(QS_MANUAL_BY_ID[schoolId]);
  if (QS_MANUAL_ALIASES[name]) terms.add(QS_MANUAL_ALIASES[name]);

  for (const raw of [name, nameEn]) {
    if (!raw || /[\u4e00-\u9fff]/.test(raw)) continue;
    const fixed = raw
      .replace(/Univeristy/gi, 'University')
      .replace(/Univesity/gi, 'University')
      .replace(/Institut Teknoloi/i, 'Institut Teknologi')
      .replace(/\s+/g, ' ')
      .trim();
    terms.add(fixed);
    terms.add(fixed.replace(/[–—‐‑-]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim());
    terms.add(fixed.replace(/\(.*\)/, '').trim());

    const acronym = extractParenAcronym(fixed);
    if (acronym && acronym.length >= 2) terms.add(acronym);

    const withoutPrefix = fixed.replace(/^(the\s+)?(university|université|universite)\s+of\s+/i, '').trim();
    if (withoutPrefix.length > 4) terms.add(withoutPrefix);

    if (/Paul Sabatier|Toulouse III/i.test(fixed)) {
      terms.add('Université Paul Sabatier Toulouse III');
    }
    if (/Illinois.*Urbana/i.test(fixed)) terms.add('University of Illinois Urbana-Champaign');
    if (/Science Tokyo|Tokyo Tech/i.test(fixed)) terms.add('Institute of Science Tokyo');
    if (/Politecnico di Milano|Polimi/i.test(fixed)) terms.add('Politecnico di Milano');
    if (/Stony Brook/i.test(fixed)) terms.add('Stony Brook University');
    if (/Dresden/i.test(fixed)) terms.add('Technische Universität Dresden');
    if (/Compi[eè]gne|UTC/i.test(fixed) || /Compi[eè]gne/i.test(String(nameEn))) {
      terms.add('Université de Technologie de Compiègne');
    }
    if (/Troyes/i.test(fixed) || /Troyes/i.test(String(nameEn))) {
      terms.add('Université de Technologie Troyes');
    }
  }

  if (/\bof\s*$/i.test(name) && nameEn && !/[\u4e00-\u9fff]/.test(nameEn)) {
    terms.add(`${name} ${nameEn}`.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim());
  }

  return Array.from(terms).filter(Boolean);
}

export function normalizeWorldRank(wur) {
  if (wur === null || wur === undefined || wur === '' || wur === '-' || wur === 'N/A') return null;
  return String(wur).replace(/^=+/, '');
}

export async function algoliaUniversities(query) {
  const res = await fetch(`https://${APP_ID}-dsn.algolia.net/1/indexes/live_tu_universities/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': APP_ID,
      'X-Algolia-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, hitsPerPage: 12 }),
  });
  if (!res.ok) throw new Error(`Algolia error ${res.status}`);
  return (await res.json()).hits ?? [];
}

export async function matchUniversity(school) {
  const terms = getSearchTerms(school.name, school.name_en, school.id);
  let best = null;
  let bestScore = 0;

  for (const term of terms) {
    const hits = await algoliaUniversities(term);
    for (const hit of hits) {
      const score = scoreHit(school, hit);
      if (score > bestScore && score >= 45) {
        bestScore = score;
        best = hit;
      }
    }
  }

  return best;
}
