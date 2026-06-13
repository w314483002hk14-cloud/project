'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { School } from '@/lib/nycu';
import type { QsSchoolRanking } from '@/lib/qs';
import { trackFavorite } from '@/lib/analytics';
import { getRegionByCountry, regionCountries } from '@/lib/regions';
import { SchoolMetaBadges } from '@/components/SchoolBadges';

function hasCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function getDisplayName(school: School) {
  if (school.name === 'CY Cergy Paris University-CY Tech') {
    return {
      primary: 'CY塞爾吉-巴黎大學',
      secondary: `${school.name} ${school.name_en}`.trim(),
    };
  }

  const primary = hasCjk(school.name_en) ? school.name_en : school.name;
  const secondary = primary === school.name ? school.name_en : school.name;
  return { primary, secondary };
}

function getTermLabel(school: School) {
  if (school.term_fall && school.term_spring) return '秋 / 春';
  if (school.term_fall) return '秋季';
  if (school.term_spring) return '春季';
  return '未提供';
}

function formatGpa(school: School) {
  const original = school.grade_full.match(/GPA\s*[\d.]+(?:\s*\/\s*[\d.]+)?/i)?.[0];
  if (original) return original.replace(/\s+/g, '');
  return school.gpa_min === null ? '無限制' : `${school.gpa_min.toFixed(1)}+`;
}

function formatLanguage(school: School) {
  const requirements = [
    school.ibt_min !== null ? `TOEFL ${school.ibt_min}` : null,
    school.ielts_min !== null ? `IELTS ${school.ielts_min}` : null,
    school.toeic_min !== null ? `TOEIC ${school.toeic_min}` : null,
    school.jlpt_min_level ? `JLPT ${school.jlpt_min_level}` : null,
  ].filter(Boolean);

  return requirements.length > 0 ? requirements.join('\n') : school.language_full || '無限制';
}

function compactText(text: string, fallback = '無限制') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function truncateText(text: string, maxLength: number) {
  const normalized = compactText(text, '');
  if (!normalized) return '無限制';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

const browserDataCellClass = 'text-sm leading-5 text-stone-700';

function getLinksFromSchool(school: School) {
  const text = `${school.language_full}\n${school.grade_full}\n${school.remarks_full}`;
  return Array.from(new Set(text.match(/https?:\/\/[^\s，,。)）]+/g) ?? []));
}

async function fetchOfficialWebsite(searchTerms: string[]) {
  for (const term of searchTerms) {
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: term,
      language: 'en',
      format: 'json',
      origin: '*',
      limit: '1',
    });
    const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`);
    const searchData = (await searchResponse.json()) as { search?: { id: string }[] };
    const entityId = searchData.search?.[0]?.id;
    if (!entityId) continue;

    const claimParams = new URLSearchParams({
      action: 'wbgetclaims',
      entity: entityId,
      property: 'P856',
      format: 'json',
      origin: '*',
    });
    const claimResponse = await fetch(`https://www.wikidata.org/w/api.php?${claimParams.toString()}`);
    const claimData = (await claimResponse.json()) as {
      claims?: { P856?: { mainsnak?: { datavalue?: { value?: string } } }[] };
    };
    const website = claimData.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (website) return website;
  }

  return null;
}

function OfficialWebsiteButton({ school }: { school: School }) {
  const [loading, setLoading] = useState(false);

  async function openWebsite() {
    setLoading(true);
    try {
      const website = getLinksFromSchool(school)[0] ?? (await fetchOfficialWebsite([school.name, school.name_en].filter(Boolean)));
      if (website) window.open(website, '_blank', 'noreferrer');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openWebsite}
      aria-label="開啟官網"
      title="開啟官網"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-lg font-semibold text-sky-800 transition hover:bg-sky-100"
    >
      {loading ? '…' : '↗'}
    </button>
  );
}

export default function SchoolBrowser({
  schools,
  qsRankings = {},
}: {
  schools: School[];
  qsRankings?: Record<string, QsSchoolRanking>;
}) {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('全部');
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [remarkSchool, setRemarkSchool] = useState<School | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const raw = window.localStorage.getItem('nycu-favorite-school-ids');
    if (raw) setFavoriteIds(new Set(JSON.parse(raw) as number[]));
  }, []);

  function toggleFavorite(schoolId: number) {
    const school = schools.find((item) => item.id === schoolId);
    setFavoriteIds((current) => {
      const next = new Set(current);
      const favorited = !next.has(schoolId);
      if (next.has(schoolId)) {
        next.delete(schoolId);
      } else {
        next.add(schoolId);
      }
      window.localStorage.setItem('nycu-favorite-school-ids', JSON.stringify(Array.from(next)));
      if (school) trackFavorite(school, getRegionByCountry(school.country), favorited);
      return next;
    });
  }

  const groupedCountries = useMemo(
    () =>
      regionCountries
        .map(({ region, countries }) => ({
          region,
          countries: countries.filter((country) => schools.some((school) => school.country === country)),
        }))
        .filter(({ countries }) => countries.length > 0),
    [schools],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return schools
      .filter((school) => {
        const region = getRegionByCountry(school.country);
        const searchable = [
          school.name,
          school.name_en,
          school.country,
          region,
          school.quota_full,
          school.eligibility_full,
          school.language_full,
          school.grade_full,
          school.remarks_full,
        ]
          .join(' ')
          .toLowerCase();

        if (regionFilter !== '全部' && regionFilter !== region && regionFilter !== school.country) return false;
        if (query && !searchable.includes(query)) return false;
        return true;
      })
      .sort((a, b) => getDisplayName(a).primary.localeCompare(getDisplayName(b).primary, 'zh-Hant'));
  }, [schools, search, regionFilter]);

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-sky-50 text-slate-950">
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6">
        <section className="mx-auto mb-5 max-w-[1260px] rounded-[1.75rem] border border-sky-200/70 bg-white/95 p-4 shadow-xl shadow-sky-100/70">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜尋學校名稱、國家、條件..."
                className="h-12 w-full rounded-2xl border border-sky-100 bg-white px-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowRegionFilter((value) => !value)}
              aria-label="地區篩選"
              className={`flex h-12 w-20 items-center justify-center rounded-2xl border shadow-sm transition ${
                showRegionFilter ? 'border-sky-300 bg-sky-100 text-sky-900' : 'border-sky-100 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path
                  d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="10" r="2.25" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <div className="text-sm text-slate-600">
              找到 <span className="font-bold text-sky-700">{filtered.length}</span> 間學校
            </div>
          </div>

          {showRegionFilter ? (
            <div className="mt-4 border-t border-sky-100 pt-4 text-sm">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRegionFilter('全部')}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition ${
                    regionFilter === '全部' ? 'border-sky-400 bg-sky-100 text-sky-900' : 'border-sky-100 bg-white text-slate-700 hover:border-sky-300'
                  }`}
                >
                  全部地區
                </button>
              </div>
              <div className="space-y-4">
                {groupedCountries.map(({ region, countries }) => (
                  <div key={region} className="grid gap-3 md:grid-cols-[86px_1fr]">
                    <button
                      type="button"
                      onClick={() => setRegionFilter(region)}
                      className={`h-fit py-2 text-left font-semibold transition ${regionFilter === region ? 'text-sky-800' : 'text-slate-600 hover:text-sky-700'}`}
                    >
                      {region}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      {countries.map((country) => (
                        <button
                          type="button"
                          key={country}
                          onClick={() => setRegionFilter(country)}
                          className={`rounded-xl border px-3 py-2 text-sm shadow-sm transition ${
                            regionFilter === country ? 'border-sky-400 bg-sky-100 font-semibold text-sky-900' : 'border-sky-100 bg-white text-slate-700 hover:border-sky-300'
                          }`}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white/95 shadow-xl shadow-sky-100/60">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[46px]" />
              <col className="w-[16%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[26%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-sky-100 text-sm font-semibold text-slate-600">
              <tr className="[&>th]:border-b [&>th]:border-stone-200 [&>th]:px-2 [&>th]:py-2 [&>th]:text-left">
                <th>收藏</th>
                <th>學校名稱</th>
                <th>國家 / 地區</th>
                <th>交換學期 / 名額</th>
                <th>年級 / 學院限制</th>
                <th>GPA</th>
                <th>語言要求</th>
                <th>討論區</th>
                <th>官網</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-stone-500">
                    沒有符合條件的學校，請調整搜尋或篩選條件。
                  </td>
                </tr>
              ) : (
                filtered.map((school) => {
                  const { primary, secondary } = getDisplayName(school);
                  return (
                    <tr key={school.id} className="align-top transition hover:bg-sky-50/80">
                      <td className="px-2 py-2 text-lg">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(school.id)}
                          aria-label={favoriteIds.has(school.id) ? '取消收藏' : '加入收藏'}
                          className={`transition ${favoriteIds.has(school.id) ? 'text-red-500' : 'text-slate-400 hover:text-red-400'}`}
                        >
                          {favoriteIds.has(school.id) ? '♥' : '♡'}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-base font-semibold leading-5 text-stone-950">{primary}</div>
                        <div className="mt-0.5 text-sm leading-4 text-stone-500">{secondary}</div>
                        <SchoolMetaBadges
                          isPioneer={school.is_pioneer}
                          ranking={qsRankings[String(school.id)]}
                          maxSubjects={2}
                          wrap
                        />
                      </td>
                      <td className={`px-2 py-2 ${browserDataCellClass}`}>
                        <div className="font-medium text-stone-800">{school.country || '未提供'}</div>
                        <span className="mt-1 inline-flex rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] text-slate-600">{getRegionByCountry(school.country)}</span>
                      </td>
                      <td className={`max-w-0 overflow-hidden px-2 py-2 break-words ${browserDataCellClass}`}>
                        <div>{getTermLabel(school)}</div>
                        <div className="mt-1 text-stone-600">{truncateText(school.quota_full, 28)}</div>
                      </td>
                      <td className={`max-w-0 overflow-hidden px-2 py-2 break-words text-stone-600 ${browserDataCellClass}`}>
                        {truncateText(school.eligibility_full, 190)}
                      </td>
                      <td className={`max-w-0 overflow-hidden px-2 py-2 break-all ${browserDataCellClass}`}>
                        {formatGpa(school)}
                      </td>
                      <td className={`max-w-0 overflow-hidden whitespace-pre-line px-2 py-2 break-words text-stone-600 ${browserDataCellClass}`}>
                        {truncateText(formatLanguage(school), 90)}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/social?schoolId=${school.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-base font-semibold text-sky-800 transition hover:bg-sky-100"
                          aria-label="前往討論區"
                          title="前往討論區"
                        >
                          💬
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <OfficialWebsiteButton school={school} />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setRemarkSchool(school)}
                          aria-label="查看備註"
                          title={school.remarks_full ? '查看備註' : '無備註'}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-800 transition hover:bg-sky-50 disabled:opacity-50"
                          disabled={!school.remarks_full}
                        >
                          <span className="flex gap-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
        {remarkSchool ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
            <div className="max-h-[78vh] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-sky-100 bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-sky-700">備註</p>
                  <h2 className="mt-2 text-2xl font-bold text-stone-950">{getDisplayName(remarkSchool).primary}</h2>
                  <p className="mt-1 text-sm text-stone-500">{getDisplayName(remarkSchool).secondary}</p>
                </div>
                <button type="button" onClick={() => setRemarkSchool(null)} className="rounded-full border border-stone-200 px-3 py-1 text-stone-500 transition hover:bg-stone-50">
                  ×
                </button>
              </div>
              <p className="mt-5 whitespace-pre-line text-sm leading-7 text-stone-700">{compactText(remarkSchool.remarks_full, '無特別備註')}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
