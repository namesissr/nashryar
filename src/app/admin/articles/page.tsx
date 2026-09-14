'use client';

import { Suspense, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search, Eye, ExternalLink, AlertCircle } from 'lucide-react';
import { Button, Badge, Spinner, EmptyState } from '@/components/ui';
import { fetcher } from '@/lib/fetcher';
import { faNum, faDate, STATUS_LABELS, STATUS_COLORS, cn } from '@/lib/utils';

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  seoScore: number;
  wordCount: number;
  remoteViews: number;
  publishedAt: string | null;
  updatedAt: string;
  syncedAt: string | null;
  syncError: string | null;
  remoteSlug: string | null;
  site: { key: string; name: string; color: string; baseUrl: string };
  category: string | null;
  author: string | null;
};

type SiteRow = { id: string; name: string; color: string };

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

function ArticlesInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(sp.get('q') || '');
  const siteId = sp.get('siteId') || '';
  const status = sp.get('status') || '';
  const page = sp.get('page') || '1';

  const query = new URLSearchParams();
  if (siteId) query.set('siteId', siteId);
  if (status) query.set('status', status);
  if (sp.get('q')) query.set('q', sp.get('q')!);
  query.set('page', page);

  const { data, isLoading } = useSWR<{ articles: ArticleRow[]; total: number; page: number; pages: number }>(
    `/api/admin/articles?${query}`,
    fetcher
  );
  const { data: sitesData } = useSWR<{ sites: SiteRow[] }>('/api/admin/sites', fetcher);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.push(`/admin/articles?${next}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">مقاله‌ها</h1>
          <p className="mt-1 text-sm text-slate-500">{data ? `${faNum(data.total)} مقاله` : '…'}</p>
        </div>
        <Link href="/admin/articles/new">
          <Button>
            <Plus size={16} />
            مقاله جدید
          </Button>
        </Link>
      </div>

      {/* فیلترها */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', q);
          }}
          className="relative"
        >
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در عنوان…"
            className="w-52 rounded-xl border border-slate-300 bg-white py-2 pr-9 pl-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </form>
        <select
          value={siteId}
          onChange={(e) => setParam('siteId', e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">همه سایت‌ها</option>
          {sitesData?.sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {['', 'DRAFT', 'QUEUED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((st) => (
            <button
              key={st || 'all'}
              onClick={() => setParam('status', st)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold transition',
                status === st
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              {st ? STATUS_LABELS[st] : 'همه'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data || data.articles.length === 0 ? (
        <EmptyState
          title="مقاله‌ای پیدا نشد"
          subtitle="اولین مقاله را بنویسید تا اینجا نمایش داده شود."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-right text-xs text-slate-400 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">عنوان</th>
                  <th className="px-4 py-3 font-medium">سایت</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">سئو</th>
                  <th className="px-4 py-3 font-medium">بازدید</th>
                  <th className="px-4 py-3 font-medium">تاریخ</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.articles.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="max-w-72 px-4 py-3">
                      <Link href={`/admin/articles/${a.id}`} className="block truncate font-bold hover:text-brand-600">
                        {a.title}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        {a.category && <span>{a.category}</span>}
                        <span>{faNum(a.wordCount)} کلمه</span>
                        {a.syncError && (
                          <span className="flex items-center gap-1 text-rose-500" title={a.syncError}>
                            <AlertCircle size={12} />
                            خطای انتشار
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={a.site.color}>{a.site.name}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', STATUS_COLORS[a.status])}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td className={cn('px-4 py-3 font-extrabold', scoreColor(a.seoScore))}>{faNum(a.seoScore)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <span className="flex items-center gap-1">
                        <Eye size={13} />
                        {faNum(a.remoteViews)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{faDate(a.publishedAt || a.updatedAt)}</td>
                    <td className="px-4 py-3">
                      {a.syncedAt && a.status === 'PUBLISHED' && (
                        <a
                          href={`${a.site.baseUrl.replace(/\/$/, '')}/blog/${a.remoteSlug || a.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-brand-600"
                          title="مشاهده روی سایت"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-1 border-t border-slate-100 p-3 dark:border-slate-800">
              {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    const next = new URLSearchParams(sp.toString());
                    next.set('page', String(p));
                    router.push(`/admin/articles?${next}`);
                  }}
                  className={cn(
                    'h-8 w-8 rounded-lg text-sm font-bold',
                    Number(page) === p
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {faNum(p)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ArticlesInner />
    </Suspense>
  );
}
