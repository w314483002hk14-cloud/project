'use client';

import { useEffect, useMemo, useState } from 'react';
import type { School } from '@/lib/nycu';

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

function compactText(text: string, fallback = '無限制') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

export default function WishlistView({ schools }: { schools: School[] }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const raw = window.localStorage.getItem('nycu-favorite-school-ids');
    if (raw) setFavoriteIds(new Set(JSON.parse(raw) as number[]));
  }, []);

  const favoriteSchools = useMemo(() => schools.filter((school) => favoriteIds.has(school.id)), [schools, favoriteIds]);

  function removeFavorite(schoolId: number) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      next.delete(schoolId);
      window.localStorage.setItem('nycu-favorite-school-ids', JSON.stringify(Array.from(next)));
      return next;
    });
  }

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-sky-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-6 shadow-xl shadow-sky-100/60">
          <p className="text-sm font-semibold text-sky-700">收藏清單</p>
          <h1 className="mt-2 text-3xl font-bold">我的收藏學校</h1>
          <p className="mt-2 text-slate-500">共 {favoriteSchools.length} 間學校</p>
        </div>

        {favoriteSchools.length === 0 ? (
          <div className="rounded-3xl border border-sky-100 bg-white p-10 text-center text-slate-500 shadow-lg shadow-sky-100/50">尚未收藏任何學校，請回到瀏覽學校頁點選愛心加入收藏。</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {favoriteSchools.map((school) => {
              const { primary, secondary } = getDisplayName(school);
              return (
                <article key={school.id} className="rounded-3xl border border-sky-100 bg-white p-5 shadow-lg shadow-sky-100/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-950">{primary}</h2>
                      <p className="mt-1 text-sm text-slate-500">{secondary}</p>
                    </div>
                    <button type="button" onClick={() => removeFavorite(school.id)} className="text-2xl text-red-500" aria-label="取消收藏">
                      ♥
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-900">國家：</span>
                      {school.country}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">名額：</span>
                      {compactText(school.quota_full, '未提供')}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">資格：</span>
                      {compactText(school.eligibility_full, '未提供')}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
