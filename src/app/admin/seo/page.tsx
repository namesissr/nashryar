'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Sparkles, Copy, Eye, ArrowLeft } from 'lucide-react';
import { Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { fetcher } from '@/lib/fetcher';
import { faNum, cn, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils';

type SiteRow = { id: string; key: string; name: string; color: string };

type Audit = {
  site: SiteRow;
  summary: {
    total: number;
    avgScore: number;
    avgReadability: number;
    weak: number;
    noKeyword: number;
    duplicateKeywordCount: number;
  };
  articles: {
    id: string;
    title: string;
    status: string;
    score: number;
    readability: number;
    wordCount: number;
    views: number;
    focusKeyword: string | null;
    issues: { label: string; status: string }[];
  }[];
  duplicateKeywords: { keyword: string; articles: { id: string; title: string }[] }[];
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

export default function SeoAuditPage() {
  const { data: sitesData } = useSWR<{ sites: SiteRow[] }>('/api/admin/sites', fetcher);
  const [siteId, setSiteId] = useState('');
  const effectiveSiteId = siteId || sitesData?.sites[0]?.id || '';

  const { data, isLoading } = useSWR<Audit>(
    effectiveSiteId ? `/api/admin/seo/audit?siteId=${effectiveSiteId}` : null,
    fetcher
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <Sparkles size={20} className="text-brand-500" />
            ممیزی سئو
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            وضعیت سئوی همه مقاله‌های هر سایت — ضعیف‌ترها اول، تا بدانید سراغ کدام بروید.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sitesData?.sites.map((s) => (
            <button
              key={s.id}
              onClick={() => setSiteId(s.id)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-bold transition',
                effectiveSiteId === s.id
                  ? 'text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              )}
              style={effectiveSiteId === s.id ? { backgroundColor: s.color } : undefined}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          {/* خلاصه */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: 'میانگین امتیاز سئو', value: data.summary.avgScore, color: scoreColor(data.summary.avgScore) },
              {
                label: 'میانگین خوانایی',
                value: data.summary.avgReadability,
                color: scoreColor(data.summary.avgReadability),
              },
              { label: 'مقاله ضعیف (زیر ۵۰)', value: data.summary.weak, color: data.summary.weak > 0 ? 'text-rose-600' : 'text-emerald-600' },
              {
                label: 'بدون کلیدواژه',
                value: data.summary.noKeyword,
                color: data.summary.noKeyword > 0 ? 'text-amber-600' : 'text-emerald-600',
              },
              {
                label: 'کلیدواژه تکراری',
                value: data.summary.duplicateKeywordCount,
                color: data.summary.duplicateKeywordCount > 0 ? 'text-rose-600' : 'text-emerald-600',
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className={cn('mt-1.5 text-2xl font-extrabold', c.color)}>{faNum(c.value)}</p>
              </div>
            ))}
          </div>

          {/* کلیدواژه‌های تکراری */}
          {data.duplicateKeywords.length > 0 && (
            <Card
              title={
                <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <Copy size={16} />
                  کلیدواژه‌های تکراری (هم‌نوع‌خواری سئو)
                </span>
              }
            >
              <p className="mb-3 text-xs text-slate-500">
                وقتی چند مقاله یک کلیدواژه دارند، در گوگل با هم رقابت می‌کنند و هیچ‌کدام رتبه خوب نمی‌گیرد. برای هر
                کدام کلیدواژه متمایزی انتخاب کنید یا مقاله‌ها را ادغام کنید.
              </p>
              <ul className="space-y-2">
                {data.duplicateKeywords.map((d) => (
                  <li key={d.keyword} className="rounded-xl bg-rose-50/60 p-3 text-sm dark:bg-rose-900/10">
                    <p className="font-extrabold text-rose-700 dark:text-rose-300">«{d.keyword}»</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {d.articles.map((a) => (
                        <Link
                          key={a.id}
                          href={`/admin/articles/${a.id}`}
                          className="flex items-center gap-1 text-xs text-slate-600 underline-offset-4 hover:underline dark:text-slate-300"
                        >
                          <ArrowLeft size={11} />
                          {a.title}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* جدول مقاله‌ها */}
          <Card title={`مقاله‌های ${data.site.name} به ترتیب اولویت رسیدگی`}>
            {data.articles.length === 0 ? (
              <EmptyState title="مقاله‌ای برای این سایت نیست" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-right text-xs text-slate-400 dark:border-slate-800">
                      <th className="px-3 py-2.5 font-medium">مقاله</th>
                      <th className="px-3 py-2.5 font-medium">وضعیت</th>
                      <th className="px-3 py-2.5 font-medium">سئو</th>
                      <th className="px-3 py-2.5 font-medium">خوانایی</th>
                      <th className="px-3 py-2.5 font-medium">کلمات</th>
                      <th className="px-3 py-2.5 font-medium">بازدید</th>
                      <th className="px-3 py-2.5 font-medium">مهم‌ترین مشکلات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.articles.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="max-w-60 px-3 py-3">
                          <Link
                            href={`/admin/articles/${a.id}`}
                            className="block truncate font-bold hover:text-brand-600"
                          >
                            {a.title}
                          </Link>
                          {a.focusKeyword ? (
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">🔑 {a.focusKeyword}</p>
                          ) : (
                            <p className="mt-0.5 text-[11px] font-bold text-amber-600">بدون کلیدواژه</p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_COLORS[a.status])}>
                            {STATUS_LABELS[a.status]}
                          </span>
                        </td>
                        <td className={cn('px-3 py-3 text-base font-extrabold', scoreColor(a.score))}>
                          {faNum(a.score)}
                        </td>
                        <td className={cn('px-3 py-3 font-bold', scoreColor(a.readability))}>{faNum(a.readability)}</td>
                        <td className="px-3 py-3 text-slate-500">{faNum(a.wordCount)}</td>
                        <td className="px-3 py-3 text-slate-500">
                          <span className="flex items-center gap-1">
                            <Eye size={12} />
                            {faNum(a.views)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex max-w-72 flex-wrap gap-1">
                            {a.issues.length === 0 ? (
                              <span className="text-xs text-emerald-600">✓ بدون مشکل مهم</span>
                            ) : (
                              a.issues.map((iss, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                                    iss.status === 'fail'
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  )}
                                >
                                  {iss.label}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
