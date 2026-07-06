'use client';

import { useEffect, useMemo, useState } from 'react';
import type { School } from '@/lib/nycu';
import type { QsSchoolRanking } from '@/lib/qs';
import { trackSchoolView } from '@/lib/analytics';
import { getRegionByLatLng } from '@/lib/regions';
import { SchoolMetaBadges } from '@/components/ui/SchoolBadges';
import { formatQsRankingDetail } from '@/lib/qs-display';
import GlobeComponent from '@/components/map/Globe';

const yearLabels = {
  all: '不限年級',
  yr1: '大一',
  yr2: '大二',
  yr3: '大三',
  yr4: '大四',
  ms1: '碩一',
  ms2: '碩二',
} as const;

type YearFilter = keyof typeof yearLabels;

function hasCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function getSchoolNames(school: School) {
  const primary = hasCjk(school.name_en) ? school.name_en : school.name;
  const secondary = primary === school.name ? school.name_en : school.name;
  return { primary, secondary };
}

function getRegion(lat: number, lng: number) {
  return getRegionByLatLng(lat, lng);
}

function getSchoolTermLabel(school: School) {
  if (school.term_fall && school.term_spring) return '秋季 / 春季';
  if (school.term_fall) return '秋季';
  if (school.term_spring) return '春季';
  return '未提供';
}

function formatGpa(school: School) {
  const original = school.grade_full.match(/GPA\s*[\d.]+(?:\s*\/\s*[\d.]+)?/i)?.[0];
  if (original) return original.replace(/\s+/g, '');
  if (school.gpa_min !== null && school.gpa_scale !== null) {
    return `GPA${school.gpa_min}/${school.gpa_scale}`;
  }
  return school.gpa_min === null ? '無限制' : `${school.gpa_min.toFixed(1)} 以上`;
}

function isGpaGradeText(text: string) {
  return /^GPA\s*[\d.]/i.test(text.trim());
}

function getNonGpaGradeField(school: School) {
  const grade = compactText(school.grade_full, '');
  if (!grade || isGpaGradeText(grade)) return '';
  return grade;
}

function formatLanguage(school: School) {
  const requirements = [
    school.ibt_min !== null ? `TOEFL iBT ${school.ibt_min} 以上` : null,
    school.ielts_min !== null ? `IELTS ${school.ielts_min} 以上` : null,
    school.toeic_min !== null ? `TOEIC ${school.toeic_min} 以上` : null,
    school.jlpt_min_level ? `JLPT ${school.jlpt_min_level}` : null,
  ].filter(Boolean);

  if (requirements.length > 0) return requirements.join('\n');
  return school.language_full || '無限制';
}

function compactText(text: string, fallback = '未提供') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function getAcademyKeywords(academy: string) {
  const aliases: Record<string, string[]> = {
    '全校': ['全校', 'U-wide'],
    '電機院': ['電機院', '電機學院', 'College of ECE'],
    '資訊院': ['資訊院', '資訊學院', 'College of CS', 'College of Computing & Data Science', 'CCDS'],
    '管理學院': ['管理學院', '管院', 'College of Management'],
    '法學院 / 科法院': ['法學院', '科法院', '科法所', 'School of Law'],
    '客家院': ['客家院', 'College of Hakka Studies'],
    '人社院': ['人社院', 'College of Humanities & Social Sciences'],
    '光電學院': ['光電學院', '光電', 'College of Photonics'],
  };

  return aliases[academy] ?? [academy];
}

function hasAcademyRestriction(school: School) {
  const academyPattern =
    /(人社院|客家院|科法院|科法所|理學院|工學院|電機院|電機學院|資訊院|資訊學院|管理學院|管院|醫學院|護理學院|國際半導體產業學院|光電學院|國半|產創院|College of|School of|Faculty of|Department of)/i;

  return school.eligibility_full
    .split(/\n+/)
    .map((line) => compactText(line, ''))
    .some((line) => academyPattern.test(line) && !/(全校|U-wide)/i.test(line));
}

async function fetchOfficialWebsite(searchTerms: string[], signal: AbortSignal) {
  for (const term of searchTerms) {
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: term,
      language: 'en',
      format: 'json',
      origin: '*',
      limit: '1',
    });
    const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`, { signal });
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
    const claimResponse = await fetch(`https://www.wikidata.org/w/api.php?${claimParams.toString()}`, { signal });
    const claimData = (await claimResponse.json()) as {
      claims?: { P856?: { mainsnak?: { datavalue?: { value?: string } } }[] };
    };
    const website = claimData.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (website) return website;
  }

  return null;
}

function getLinksFromSchool(school: School) {
  const text = `${school.language_full}\n${school.grade_full}\n${school.remarks_full}`;
  return Array.from(new Set(text.match(/https?:\/\/[^\s，,。)）]+/g) ?? []));
}

function splitEligibilityInfo(school: School) {
  const lines = school.eligibility_full
    .split(/\n+/)
    .map((line) => compactText(line, ''))
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      yearRequirement: '未提供',
      academyRequirement: getNonGpaGradeField(school) || '無限制',
    };
  }

  const academyPattern =
    /(人社院|客家院|科法院|科法所|理學院|工學院|電機院|電機學院|資訊院|資訊學院|管理學院|管院|醫學院|護理學院|國際半導體產業學院|光電學院|國半|產創院|College of|School of|Faculty of|Department of)/i;
  const uWidePattern = /(全校|U-wide)/i;
  const gradeFromField = getNonGpaGradeField(school);
  const yearLines: string[] = [];
  const academyLines: string[] = [];

  lines.forEach((line) => {
    const academyIndex = line.search(academyPattern);
    if (uWidePattern.test(line) || academyIndex === -1) {
      if (academyIndex > 0 && !uWidePattern.test(line)) {
        yearLines.push(line.slice(0, academyIndex).trim());
        academyLines.push(line.slice(academyIndex).trim());
      } else {
        yearLines.push(line);
      }
      return;
    }

    academyLines.push(line);
  });

  if (yearLines.length === 0 && academyLines.length === 1) {
    const line = academyLines[0];
    const yearMatch = line.match(/(大學部[^ ]*|研究所學生|碩士班學生|UG[^&，,。]*|PG students|Master students)/i);
    if (yearMatch) yearLines.push(yearMatch[0]);
  }

  return {
    yearRequirement: yearLines.filter(Boolean).join('\n') || '未提供',
    academyRequirement: [...academyLines, gradeFromField].filter(Boolean).join('\n') || '無限制',
  };
}

function matchesYear(school: School, year: YearFilter) {
  if (year === 'all') return true;
  const text = `${school.eligibility_full ?? ''} ${school.remarks_full ?? ''}`.toLowerCase();
  const contains = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

  if (year === 'yr1') {
    return contains(['yr.1', 'yr1', 'year 1', '1st year', '大一', '第一年']);
  }
  if (year === 'yr2') {
    return contains(['yr.2', 'yr2', 'year 2', '2nd year', '大二', '第二年']);
  }
  if (year === 'yr3') {
    return contains(['yr.3', 'yr3', 'year 3', '3rd year', '大三', '第三年']);
  }
  if (year === 'yr4') {
    return contains(['yr.4', 'yr4', 'year 4', '4th year', '大四', '第四年', 'final year', 'final-year']);
  }
  if (year === 'ms1') {
    const isPg = contains(['pg', 'graduate', 'master', '碩士', '研究所']);
    const isPg2 = contains(['yr.2', 'yr2', 'year 2', '2nd year', '第二年']);
    return isPg && !isPg2;
  }
  if (year === 'ms2') {
    return contains(['pg', 'graduate', 'master', '碩士', '研究所']) && contains(['yr.2', 'yr2', 'year 2', '2nd year', '第二年']);
  }
  return false;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm">
      <dt className="font-semibold text-stone-950">{label}</dt>
      <dd className="whitespace-pre-line leading-6 text-stone-600">{value}</dd>
    </div>
  );
}

export default function MapView({
  schools,
  qsRankings = {},
}: {
  schools: School[];
  qsRankings?: Record<string, QsSchoolRanking>;
}) {
  const [termFilter, setTermFilter] = useState<'all' | 'fall' | 'spring'>('all');
  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [gpaFilter, setGpaFilter] = useState(0);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [academyFilter, setAcademyFilter] = useState('不限學院');
  const [countryFilter, setCountryFilter] = useState('不限國家');
  const [languageFilter] = useState('');
  const [toeflFilter, setToeflFilter] = useState(0);
  const [ieltsFilter, setIeltsFilter] = useState(0);
  const [toeicFilter, setToeicFilter] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [officialWebsiteResult, setOfficialWebsiteResult] = useState<{ schoolId: number; website: string | null } | null>(null);

  function resetFilters() {
    setTermFilter('all');
    setYearFilter('all');
    setGpaFilter(0);
    setSchoolQuery('');
    setAcademyFilter('不限學院');
    setCountryFilter('不限國家');
    setToeflFilter(0);
    setIeltsFilter(0);
    setToeicFilter(0);
  }

  const academyOptions = [
    '不限學院',
    '全校',
    '工學院',
    '電機院',
    '資訊院',
    '理學院',
    '醫學院',
    '護理學院',
    '管理學院',
    '法學院 / 科法院',
    '人社院',
    '客家院',
    '國際半導體產業學院',
    '光電學院',
  ];

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    schools.forEach((school) => {
      if (school.country) set.add(school.country);
    });
    return ['不限國家', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'))];
  }, [schools]);

  const filtered = useMemo(
    () =>
      schools
        .filter((school) => {
          const eligibilityText = `${school.eligibility_full ?? ''} ${school.remarks_full ?? ''} ${school.language_full ?? ''}`.toLowerCase();
          const academyKeywords = getAcademyKeywords(academyFilter).map((keyword) => keyword.toLowerCase());
          const query = `${school.name} ${school.name_en}`.toLowerCase();

          if (termFilter === 'fall' && !school.term_fall) return false;
          if (termFilter === 'spring' && !school.term_spring) return false;
          if (!matchesYear(school, yearFilter)) return false;
          if (gpaFilter > 0 && school.gpa_min !== null && school.gpa_min > gpaFilter) return false;
          if (toeflFilter > 0 && (school.ibt_min === null || school.ibt_min > toeflFilter)) return false;
          if (ieltsFilter > 0 && (school.ielts_min === null || school.ielts_min > ieltsFilter)) return false;
          if (toeicFilter > 0 && (school.toeic_min === null || school.toeic_min > toeicFilter)) return false;
          if (countryFilter !== '不限國家' && school.country !== countryFilter) return false;
          if (schoolQuery && !query.includes(schoolQuery.trim().toLowerCase())) return false;
          if (
            academyFilter !== '不限學院' &&
            academyFilter !== '全校' &&
            hasAcademyRestriction(school) &&
            !academyKeywords.some((keyword) => eligibilityText.includes(keyword))
          ) {
            return false;
          }
          if (languageFilter && !eligibilityText.includes(languageFilter.trim().toLowerCase())) return false;

          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
    [schools, termFilter, yearFilter, gpaFilter, toeflFilter, ieltsFilter, toeicFilter, countryFilter, schoolQuery, academyFilter, languageFilter],
  );

  const selectedSchool = filtered.find((school) => school.id === selectedId) ?? null;
  const selectedNames = useMemo(() => (selectedSchool ? getSchoolNames(selectedSchool) : null), [selectedSchool]);
  const selectedLinks = selectedSchool ? getLinksFromSchool(selectedSchool) : [];
  const selectedEligibility = selectedSchool ? splitEligibilityInfo(selectedSchool) : null;
  const selectedRanking = selectedSchool ? qsRankings[String(selectedSchool.id)] : null;

  useEffect(() => {
    if (!selectedSchool) return;
    trackSchoolView(selectedSchool, getRegion(selectedSchool.lat, selectedSchool.lng));
  }, [selectedSchool?.id]);

  useEffect(() => {
    if (!selectedSchool) return;

    const controller = new AbortController();
    const schoolId = selectedSchool.id;
    fetchOfficialWebsite([selectedSchool.name, selectedSchool.name_en].filter(Boolean), controller.signal)
      .then((website) => {
        if (!controller.signal.aborted) setOfficialWebsiteResult({ schoolId, website });
      })
      .catch(() => {
        if (!controller.signal.aborted) setOfficialWebsiteResult({ schoolId, website: null });
      });

    return () => controller.abort();
  }, [selectedSchool]);

  const officialWebsite = selectedSchool && officialWebsiteResult?.schoolId === selectedSchool.id ? officialWebsiteResult.website : null;
  const websiteLoaded = Boolean(selectedSchool && officialWebsiteResult?.schoolId === selectedSchool.id);
  const relatedLinks = officialWebsite ? [officialWebsite, ...selectedLinks.filter((link) => link !== officialWebsite)] : selectedLinks;

  return (
    <div className="h-[calc(100dvh-60px)] overflow-hidden bg-slate-950 text-slate-100">
      <div className="h-full w-full">
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setShowFilterPanel(true)}
            className="fixed left-5 top-1/2 z-50 -translate-y-1/2 rounded-full border border-amber-200/60 bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-2xl shadow-amber-950/40 transition hover:bg-amber-400"
          >
            篩選
          </button>

          {showFilterPanel ? (
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[380px] border-l border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">篩選</p>
                    <h2 className="text-2xl font-semibold text-white">條件篩選</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilterPanel(false)}
                    className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-200 transition hover:bg-slate-800"
                  >
                    關閉
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="space-y-5">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="w-full rounded-2xl border border-amber-300/50 bg-amber-500/15 px-4 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-500/25"
                    >
                      重置篩選條件
                    </button>

                    <div>
                      <label className="text-sm font-medium text-slate-300">年級</label>
                      <select
                        value={yearFilter}
                        onChange={(event) => setYearFilter(event.target.value as typeof yearFilter)}
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        {Object.entries(yearLabels).map(([key, label]) => (
                          <option key={key} value={key} className="bg-slate-950 text-slate-100">
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300">學院 / 系所</label>
                      <select
                        value={academyFilter}
                        onChange={(event) => setAcademyFilter(event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        {academyOptions.map((academy) => (
                          <option key={academy} value={academy} className="bg-slate-950 text-slate-100">
                            {academy}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300">GPA</label>
                      <input
                        type="number"
                        min="0"
                        max="4.3"
                        step="0.1"
                        value={gpaFilter}
                        onChange={(event) => setGpaFilter(Number(event.target.value))}
                        placeholder="例如：3.8"
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                      />
                      <p className="mt-2 text-xs text-slate-500">滿分 4.3</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300">交換學期</label>
                      <select
                        value={termFilter}
                        onChange={(event) => setTermFilter(event.target.value as typeof termFilter)}
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        <option value="all" className="bg-slate-950 text-slate-100">
                          全部學期
                        </option>
                        <option value="fall" className="bg-slate-950 text-slate-100">
                          秋季
                        </option>
                        <option value="spring" className="bg-slate-950 text-slate-100">
                          春季
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300">國家</label>
                      <select
                        value={countryFilter}
                        onChange={(event) => setCountryFilter(event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                      >
                        {countryOptions.map((country) => (
                          <option key={country} value={country} className="bg-slate-950 text-slate-100">
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300">學校名稱 (中 / 英)</label>
                      <input
                        type="search"
                        value={schoolQuery}
                        onChange={(event) => setSchoolQuery(event.target.value)}
                        placeholder="搜尋學校名稱，例如：東京大學 / University"
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-slate-300">TOEFL iBT</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={toeflFilter}
                          onChange={(event) => setToeflFilter(Number(event.target.value))}
                          placeholder="例如：90"
                          className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">IELTS</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={ieltsFilter}
                          onChange={(event) => setIeltsFilter(Number(event.target.value))}
                          placeholder="例如：6.5"
                          className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-300">TOEIC</label>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={toeicFilter}
                        onChange={(event) => setToeicFilter(Number(event.target.value))}
                        placeholder="例如：750"
                        className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                      />
                    </div>

                    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
                      <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">查找到</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{filtered.length} 間學校</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="h-full bg-slate-950">
            <div className="relative h-full overflow-hidden">
              {showGuide ? (
                <div className="absolute right-6 top-6 z-20 w-[320px] rounded-[1.75rem] border border-cyan-400/20 bg-slate-950/95 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">操作指南</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">3 步驟快速上手</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGuide(false)}
                      className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
                    >
                      結束
                    </button>
                  </div>
                  <ol className="mt-5 space-y-3 text-sm text-slate-200">
                    <li className="rounded-2xl border border-white/10 bg-slate-950/80 p-3">
                      <span className="font-semibold text-cyan-200">1.</span> 可以移動地球尋找喜歡的學校。
                    </li>
                    <li className="rounded-2xl border border-white/10 bg-slate-950/80 p-3">
                      <span className="font-semibold text-cyan-200">2.</span> 可以使用左側篩選功能，根據自身資格或者國家尋找學校。
                    </li>
                    <li className="rounded-2xl border border-white/10 bg-slate-950/80 p-3">
                      <span className="font-semibold text-cyan-200">3.</span> 最後點選「結束」關閉導覽。
                    </li>
                  </ol>
                </div>
              ) : null}
              <GlobeComponent
                schools={filtered}
                selectedId={selectedSchool?.id ?? null}
                onSchoolClick={(school) => {
                  setSelectedId(school.id);
                  setShowDetailPanel(false);
                  setShowGuide(false);
                }}
              />
              {selectedSchool && selectedNames ? (
                <div className="absolute bottom-5 left-6 z-30 w-[min(400px,calc(100%-3rem))] rounded-[1.1rem] border border-sky-200/30 bg-sky-950/80 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">{selectedNames.primary}</h2>
                      <p className="mt-1 text-sm text-sky-100/80">{selectedNames.secondary}</p>
                      <SchoolMetaBadges isPioneer={selectedSchool.is_pioneer} ranking={selectedRanking} maxSubjects={2} />
                    </div>
                    <div className="flex items-center gap-2 text-xl text-sky-100/80">
                      <button type="button" aria-label="收藏" className="transition hover:text-white">
                        ♡
                      </button>
                      <button
                        type="button"
                        aria-label="關閉基本資訊"
                        onClick={() => {
                          setSelectedId(null);
                          setShowDetailPanel(false);
                        }}
                        className="transition hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-sky-100/30 px-3 py-1 text-xs font-semibold">{selectedSchool.country}</span>
                    <span className="rounded-full border border-sky-100/30 px-3 py-1 text-xs font-semibold">{getRegion(selectedSchool.lat, selectedSchool.lng)}</span>
                  </div>
                  <div className="mt-3 border-t border-sky-100/20 pt-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <button
                        type="button"
                        onClick={() => {
                          setShowFilterPanel(false);
                          setShowDetailPanel(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-100/30 bg-white/10 px-3 py-2.5 text-sm font-bold transition hover:bg-white/15"
                      >
                        <span className="text-base">ⓘ</span>
                        詳細資訊
                      </button>
                      {officialWebsite ? (
                        <a
                          href={officialWebsite}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="開啟大學官網"
                          title={officialWebsite}
                          className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2.5 text-lg transition hover:bg-white/15"
                        >
                          ↗
                        </a>
                      ) : (
                        <button
                          type="button"
                          aria-label="尚未取得大學官網"
                          title={websiteLoaded ? '未找到可驗證的官方網站' : '正在查詢大學官網'}
                          disabled
                          className="rounded-xl bg-white/5 px-3 py-2.5 text-lg text-white/40"
                        >
                          ↗
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              {selectedSchool && selectedNames && showDetailPanel ? (
                <aside className="absolute inset-y-0 right-0 z-40 w-full max-w-[400px] overflow-y-auto border-l border-stone-200 bg-white p-6 text-stone-900 shadow-2xl shadow-black/30">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600">資料已更新</p>
                      <h2 className="mt-8 text-2xl font-bold">{selectedNames.primary}</h2>
                      <p className="mt-2 text-sm text-stone-500">{selectedNames.secondary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDetailPanel(false)}
                      aria-label="關閉詳細資訊"
                      className="rounded-lg border border-stone-200 px-3 py-1 text-xl text-stone-500 transition hover:bg-stone-50"
                    >
                      ×
                    </button>
                  </div>

                  <section className="mt-8">
                    <h3 className="text-lg font-bold">基本資訊</h3>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                      <DetailRow label="國家" value={selectedSchool.country || '未提供'} />
                      <DetailRow label="地區" value={getRegion(selectedSchool.lat, selectedSchool.lng)} />
                      <DetailRow label="交換學期" value={getSchoolTermLabel(selectedSchool)} />
                      <DetailRow label="名額" value={compactText(selectedSchool.quota_full)} />
                      <div className="col-span-2">
                        <DetailRow label="GPA 要求" value={formatGpa(selectedSchool)} />
                      </div>
                      <div className="col-span-2">
                        <DetailRow label="排名" value={formatQsRankingDetail(selectedRanking)} />
                      </div>
                    </dl>
                  </section>

                  <section className="mt-8 border-t border-stone-200 pt-6">
                    <h3 className="text-lg font-bold">申請資格</h3>
                    <dl className="mt-4 space-y-5">
                      <DetailRow label="年級限制" value={selectedEligibility?.yearRequirement ?? '未提供'} />
                      <DetailRow label="學院 / 系所限制" value={selectedEligibility?.academyRequirement ?? '無限制'} />
                      <DetailRow label="語言要求" value={formatLanguage(selectedSchool)} />
                    </dl>
                  </section>

                  <section className="mt-8 border-t border-stone-200 pt-6">
                    <h3 className="text-lg font-bold">相關連結</h3>
                    {relatedLinks.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {relatedLinks.map((link) => (
                          <a key={link} href={link} target="_blank" rel="noreferrer" className="block break-words rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-200 hover:bg-sky-50">
                            {link}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-7 text-stone-600">原始 CSV / JSON 僅標示 Link，沒有保留實際網址。</p>
                    )}
                  </section>

                  <section className="mt-8 border-t border-stone-200 pt-6">
                    <h3 className="text-lg font-bold">備註</h3>
                    <p className="mt-4 whitespace-pre-line text-sm leading-7 text-stone-600">{compactText(selectedSchool.remarks_full, '無特別備註')}</p>
                  </section>
                </aside>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
