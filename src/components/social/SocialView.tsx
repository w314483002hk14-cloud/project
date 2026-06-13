'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { School } from '@/lib/nycu';
import { trackComment } from '@/lib/analytics';
import { getRegionByCountry } from '@/lib/regions';

type DiscussionPost = {
  id: string;
  schoolId: number;
  author: string;
  category: '心得' | '問題' | '情報';
  content: string;
  createdAt: string;
};

const storageKey = 'nycu-school-discussion-posts';
const seedFlagKey = 'nycu-discussion-seeds-installed-v1';
/** 正式上線時改為 false，即可不再注入範例留言 */
const ENABLE_SEED_POSTS = true;

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

function readStoredPosts() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as DiscussionPost[]) : [];
  } catch {
    return [];
  }
}

function savePosts(posts: DiscussionPost[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(posts));
}

function getSeedPosts(schools: School[]): DiscussionPost[] {
  const kyushu = schools.find((school) => school.name.includes('Kyushu University'));
  const hokkaido = schools.find((school) => school.name.includes('Hokkaido University'));

  return [
    kyushu
      ? {
          id: 'seed-kyushu-1',
          schoolId: kyushu.id,
          author: '交換心得',
          category: '心得',
          content: '福岡生活機能很方便，九州大學伊都校區離市中心有點距離，建議先研究交通和宿舍位置。',
          createdAt: '範例留言',
        }
      : null,
    hokkaido
      ? {
          id: 'seed-hokkaido-1',
          schoolId: hokkaido.id,
          author: '準備申請中',
          category: '問題',
          content: '想請問 HUSTEP 的課程選擇彈性如何？如果主要想修英文授課課程，需要特別注意哪些限制？',
          createdAt: '範例留言',
        }
      : null,
  ].filter(Boolean) as DiscussionPost[];
}

export default function SocialView({ schools }: { schools: School[] }) {
  const searchParams = useSearchParams();
  const initialSchoolId = Number(searchParams.get('schoolId'));
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number>(schools.some((school) => school.id === initialSchoolId) ? initialSchoolId : (schools[0]?.id ?? 0));
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<DiscussionPost['category']>('問題');
  const [content, setContent] = useState('');
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredPosts();
    if (stored.length > 0) {
      setPosts(stored);
      setReady(true);
      return;
    }

    if (ENABLE_SEED_POSTS && !window.localStorage.getItem(seedFlagKey)) {
      const seeds = getSeedPosts(schools);
      setPosts(seeds);
      savePosts(seeds);
      window.localStorage.setItem(seedFlagKey, '1');
    }

    setReady(true);
  }, [schools]);

  const filteredSchools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return schools
      .filter((school) => {
        const text = `${school.name} ${school.name_en} ${school.country}`.toLowerCase();
        return !normalizedQuery || text.includes(normalizedQuery);
      })
      .sort((a, b) => getDisplayName(a).primary.localeCompare(getDisplayName(b).primary, 'zh-Hant'));
  }, [schools, query]);

  const selectedSchool = schools.find((school) => school.id === selectedId) ?? filteredSchools[0] ?? schools[0];
  const selectedPosts = posts
    .filter((post) => post.schoolId === selectedSchool?.id)
    .sort((a, b) => b.id.localeCompare(a.id));

  const postCounts = useMemo(() => {
    const counts = new Map<number, number>();
    posts.forEach((post) => counts.set(post.schoolId, (counts.get(post.schoolId) ?? 0) + 1));
    return counts;
  }, [posts]);

  function submitPost() {
    if (!selectedSchool || !content.trim()) return;

    const nextPost: DiscussionPost = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      schoolId: selectedSchool.id,
      author: author.trim() || '匿名同學',
      category,
      content: content.trim(),
      createdAt: new Date().toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setPosts((current) => {
      const next = [nextPost, ...current];
      savePosts(next);
      return next;
    });
    trackComment(selectedSchool, getRegionByCountry(selectedSchool.country), category);
    setContent('');
  }

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-sky-50 px-5 py-6 text-slate-950">
      {!ready ? <div className="py-20 text-center text-slate-500">載入討論區…</div> : null}
      <div className={`mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[360px_1fr] ${ready ? '' : 'hidden'}`}>
        <aside className="rounded-3xl border border-sky-100 bg-white p-5 shadow-xl shadow-sky-100/60">
          <h1 className="text-3xl font-bold">社群討論區</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">選擇一間學校，查看交換心得、生活資訊，或提出問題。</p>

          <div className="relative mt-5">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋學校、國家..."
              className="h-12 w-full rounded-2xl border border-sky-100 bg-white px-11 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="mt-5 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {filteredSchools.map((school) => {
              const { primary, secondary } = getDisplayName(school);
              const active = selectedSchool?.id === school.id;
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => setSelectedId(school.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    active ? 'border-sky-300 bg-sky-50 shadow-sm' : 'border-slate-100 bg-white hover:border-sky-200 hover:bg-sky-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{primary}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{secondary}</p>
                      <p className="mt-1 text-xs text-slate-400">{school.country}</p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">{postCounts.get(school.id) ?? 0}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="rounded-3xl border border-sky-100 bg-white p-5 shadow-xl shadow-sky-100/60">
          {selectedSchool ? (
            <>
              <header className="flex flex-col gap-4 border-b border-sky-100 pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-sky-700">{selectedSchool.country}</p>
                  <h2 className="mt-2 text-3xl font-bold">{getDisplayName(selectedSchool).primary}</h2>
                  <p className="mt-1 text-sm text-slate-500">{getDisplayName(selectedSchool).secondary}</p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">{selectedPosts.length} 則留言</div>
              </header>

              <section className="mt-5 rounded-3xl border border-sky-100 bg-sky-50/70 p-4">
                <h3 className="text-lg font-bold">新增留言</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="暱稱（可留空）"
                    className="h-11 rounded-2xl border border-sky-100 bg-white px-4 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as DiscussionPost['category'])}
                    className="h-11 rounded-2xl border border-sky-100 bg-white px-4 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="問題">問題</option>
                    <option value="心得">心得</option>
                    <option value="情報">情報</option>
                  </select>
                </div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="分享交換心得、生活資訊，或提出你想問的問題..."
                  className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-sky-100 bg-white p-4 text-sm leading-6 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={submitPost} className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500">
                    發佈留言
                  </button>
                </div>
              </section>

              <section className="mt-5 space-y-3">
                {selectedPosts.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/60 p-8 text-center text-slate-500">目前還沒有留言，成為第一個發問或分享的人。</div>
                ) : (
                  selectedPosts.map((post) => (
                    <article key={post.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{post.category}</span>
                        <span className="font-semibold text-slate-950">{post.author}</span>
                        <span className="text-xs text-slate-400">{post.createdAt}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{post.content}</p>
                    </article>
                  ))
                )}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
