'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ScholarshipItem } from '@/lib/scholarships';

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractLinks(html: string) {
  const links: { href: string; text: string }[] = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = regex.exec(html);
  while (match) {
    links.push({ href: match[1], text: stripHtml(match[2]) || match[1] });
    match = regex.exec(html);
  }
  return links;
}

export default function ScholarshipsView({ initialItems, syncedAt, source }: {
  initialItems: ScholarshipItem[];
  syncedAt: string;
  source: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const [lastSynced, setLastSynced] = useState(syncedAt);
  const [refreshing, setRefreshing] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.dataClassName) set.add(item.dataClassName);
    });
    return ['全部', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== '全部' && item.dataClassName !== category) return false;
      if (!q) return true;
      const text = `${item.subject} ${item.detailContent} ${item.pubUnitName}`.toLowerCase();
      return text.includes(q);
    });
  }, [items, category, query]);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/scholarships/sync', { method: 'POST' });
      const data = (await res.json()) as { items: ScholarshipItem[]; synced_at: string };
      setItems(data.items ?? []);
      setLastSynced(data.synced_at ?? new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const sixHours = 6 * 60 * 60 * 1000;
    if (!lastSynced || Date.now() - new Date(lastSynced).getTime() > sixHours) {
      refresh();
    }
  }, []);

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-sky-50 text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-sky-700/80">NYCU OIA</p>
            <h1 className="text-3xl font-bold tracking-tight">出國獎學金</h1>
            <p className="mt-2 text-sm text-slate-600">
              資料來源：
              <a href={source} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                國際事務處獎學金公告
              </a>
              {lastSynced ? ` · 更新 ${new Date(lastSynced).toLocaleString('zh-TW')}` : null}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
          >
            {refreshing ? '更新中…' : '立即更新'}
          </button>
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋獎學金標題或內容…"
            className="h-11 rounded-xl border border-sky-100 px-4 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-xl border border-sky-100 px-4 text-sm outline-none focus:border-sky-400"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {filtered.map((item, index) => {
            const inlineLinks = extractLinks(item.detailContent);
            return (
              <article key={`${item.subject}-${index}`} className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{item.updateDate}</span>
                  {item.dataClassName ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">{item.dataClassName}</span>
                  ) : null}
                  <span>{item.pubUnitName}</span>
                </div>
                <h2 className="mt-2 text-xl font-bold text-slate-900">{item.subject}</h2>
                <div
                  className="prose prose-sm mt-3 max-w-none whitespace-pre-line text-slate-700"
                  dangerouslySetInnerHTML={{ __html: item.detailContent }}
                />
                {(inlineLinks.length > 0 || item.docs.length > 0) && (
                  <div className="mt-4 border-t border-sky-100 pt-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">相關連結</p>
                    <ul className="space-y-1 text-sm">
                      {inlineLinks.map((link) => (
                        <li key={link.href}>
                          <a href={link.href} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                            {link.text}
                          </a>
                        </li>
                      ))}
                      {item.docs.map((doc) => (
                        <li key={doc.fileurl}>
                          <a href={doc.fileurl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                            {doc.expFile || '附件'}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-white p-10 text-center text-slate-500">
              找不到符合條件的獎學金公告
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
