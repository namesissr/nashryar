'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Eye,
  Download,
  TrendingUp,
  Send,
  Bot,
  Sparkles,
  Trophy,
  Flame,
  ExternalLink,
  FileText,
  CalendarDays,
} from 'lucide-react';
import { Card, Badge, Spinner, EmptyState, Button } from '@/components/ui';
import { fetcher } from '@/lib/fetcher';
import { faNum, faDate, cn } from '@/lib/utils';
import { ViewsChart } from '@/components/views-chart';

type SiteRow = { id: string; key: string; name: string; color: string };

type Report = {
  from: string;
  to: string;
  sites: SiteRow[];
  series: ({ date: string; total: number } & Record<string, number | string>)[];
  perSite: (SiteRow & { views: number; published: number; autoPublished: number; avgSeo: number })[];
  topArticles: {
    id: string;
    title: string;
    seoScore: number;
    remoteViews: number;
    rangeViews: number;
    site: { name: string; color: string };
  }[];
  summary: {
    totalViews: number;
    published: number;
    autoPublished: number;
    avgSeo: number;
    bestDay: { date: string; total: number };
  };
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ArticleLite = {
  id: string;
  title: string;
  remoteViews: number;
  seoScore: number;
  publishedAt: string | null;
} | null;

type SiteStats = {
  id: string;
  key: string;
  name: string;
  color: string;
  baseUrl: string;
  hasSecret: boolean;
  totalArticles: number;
  published: number;
  drafts: number;
  queued: number;
  scheduled: number;
  totalViews: number;
  views30: number;
  viewsThisMonth: number;
  publishedThisMonth: number;
  publishedThisWeek: number;
  avgViewsPerArticle: number;
  topByViews: ArticleLite;
  topThisMonth: (NonNullable<ArticleLite> & { monthViews: number }) | null;
  bestSeo: ArticleLite;
  lastPublished: ArticleLite;
};

function SiteStatsSection() {
  const { data, isLoading } = useSWR<{ monthLabel: string; sites: SiteStats[] }>('/api/admin/site-stats', fetcher);

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold">آمار کلی هر سایت</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        {data.sites.map((s) => (
          <Card
            key={s.id}
            title={
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
            }
            action={
              s.lastPublished?.publishedAt ? (
                <span className="text-xs text-slate-400">آخرین انتشار: {faDate(s.lastPublished.publishedAt)}</span>
              ) : (
                <span className="text-xs text-slate-400">هنوز انتشاری نداشته</span>
              )
            }
          >
            <div className="space-y-4">
              {/* شمارنده‌ها */}
              <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                {[
                  { label: 'کل منتشرشده', value: s.published, icon: Send, color: 'text-emerald-600' },
                  { label: 'بازدید کل', value: s.totalViews, icon: Eye, color: 'text-violet-600' },
                  { label: `انتشار ${data.monthLabel}`, value: s.publishedThisMonth, icon: CalendarDays, color: 'text-brand-600' },
                  { label: `بازدید ${data.monthLabel}`, value: s.viewsThisMonth, icon: TrendingUp, color: 'text-sky-600' },
                  { label: 'بازدید ۳۰ روز', value: s.views30, icon: Flame, color: 'text-orange-600' },
                  { label: 'میانگین بازدید/مقاله', value: s.avgViewsPerArticle, icon: FileText, color: 'text-slate-500' },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                    <c.icon size={15} className={cn('mx-auto', c.color)} />
                    <p className="mt-1 text-base font-extrabold leading-5">{faNum(c.value)}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{c.label}</p>
                  </div>
                ))}
              </div>

              {/* وضعیت‌های در جریان */}
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {faNum(s.drafts)} پیش‌نویس
                </span>
                <span className="rounded-full bg-violet-100 px-2.5 py-1 font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {faNum(s.queued)} در صف
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {faNum(s.scheduled)} زمان‌بندی‌شده
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {faNum(s.publishedThisWeek)} انتشار هفته اخیر
                </span>
              </div>

              {/* مقاله‌های شاخص */}
              <div className="space-y-1.5">
                <StatArticleRow
                  icon={<Trophy size={14} className="text-amber-500" />}
                  label="پربازدیدترین مقاله"
                  article={s.topByViews}
                  metric={s.topByViews ? `${faNum(s.topByViews.remoteViews)} بازدید` : undefined}
                />
                <StatArticleRow
                  icon={<Flame size={14} className="text-orange-500" />}
                  label={`محبوب‌ترین مقاله ${data.monthLabel}`}
                  article={s.topThisMonth}
                  metric={s.topThisMonth ? `${faNum(s.topThisMonth.monthViews)} بازدید در ماه` : undefined}
                />
                <StatArticleRow
                  icon={<Sparkles size={14} className="text-brand-500" />}
                  label="بهترین امتیاز سئو"
                  article={s.bestSeo}
                  metric={s.bestSeo ? `امتیاز ${faNum(s.bestSeo.seoScore)}` : undefined}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatArticleRow({
  icon,
  label,
  article,
  metric,
}: {
  icon: React.ReactNode;
  label: string;
  article: ArticleLite | (NonNullable<ArticleLite> & { monthViews: number }) | null;
  metric?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
      <span className="shrink-0">{icon}</span>
      <span className="w-40 shrink-0 text-xs text-slate-400">{label}</span>
      {article ? (
        <>
          <Link
            href={`/admin/articles/${article.id}`}
            className="min-w-0 flex-1 truncate font-bold hover:text-brand-600"
          >
            {article.title}
          </Link>
          {metric && <span className="shrink-0 text-xs font-bold text-slate-500">{metric}</span>}
          <Link href={`/admin/articles/${article.id}`} className="shrink-0 text-slate-300 hover:text-brand-600">
            <ExternalLink size={13} />
          </Link>
        </>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  );
}

const PERIODS = [
  { key: 'today', label: 'امروز' },
  { key: '7d', label: '۷ روز اخیر' },
  { key: '30d', label: '۳۰ روز اخیر' },
  { key: '90d', label: '۹۰ روز اخیر' },
  { key: 'custom', label: 'بازه دلخواه' },
] as const;

export default function ReportsPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('30d');
  const [customFrom, setCustomFrom] = useState(iso(new Date(Date.now() - 6 * 86400000)));
  const [customTo, setCustomTo] = useState(iso(new Date()));
  const [siteId, setSiteId] = useState('');

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (period === 'today') return { from: iso(now), to: iso(now) };
    if (period === '7d') return { from: iso(new Date(now.getTime() - 6 * 86400000)), to: iso(now) };
    if (period === '30d') return { from: iso(new Date(now.getTime() - 29 * 86400000)), to: iso(now) };
    if (period === '90d') return { from: iso(new Date(now.getTime() - 89 * 86400000)), to: iso(now) };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const { data: sitesData } = useSWR<{ sites: SiteRow[] }>('/api/admin/sites', fetcher);
  const { data, isLoading } = useSWR<Report>(
    `/api/admin/reports?from=${from}&to=${to}${siteId ? `&siteId=${siteId}` : ''}`,
    fetcher,
    { keepPreviousData: true }
  );

  function exportCsv() {
    if (!data) return;
    const rows = [
      ['گزارش نشریار', `${data.from} تا ${data.to}`],
      [],
      ['سایت', 'بازدید بازه', 'منتشرشده در بازه', 'انتشار خودکار', 'میانگین سئو'],
      ...data.perSite.map((s) => [s.name, s.views, s.published, s.autoPublished, s.avgSeo]),
      [],
      ['تاریخ', 'مجموع بازدید', ...data.sites.map((s) => s.name)],
      ...data.series.map((r) => [r.date, r.total, ...data.sites.map((s) => r[s.key] ?? 0)]),
    ];
    const csv = '﻿' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nashryar-report-${data.from}-to-${data.to}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">گزارش و آمار</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `${faDate(data.from)} تا ${faDate(data.to)}` : '…'}
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!data}>
          <Download size={15} />
          خروجی CSV
        </Button>
      </div>

      {/* آمار کلی هر سایت */}
      <SiteStatsSection />

      <h2 className="pt-2 text-lg font-extrabold">گزارش بازه‌ای</h2>

      {/* فیلترها */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
              period === p.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <span className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              dir="ltr"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
            تا
            <input
              type="date"
              dir="ltr"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </span>
        )}
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={() => setSiteId('')}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
            !siteId
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          همه سایت‌ها
        </button>
        {sitesData?.sites.map((s) => (
          <button
            key={s.id}
            onClick={() => setSiteId(s.id)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
              siteId === s.id
                ? 'text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            )}
            style={siteId === s.id ? { backgroundColor: s.color } : undefined}
          >
            {s.name}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <Spinner />
      ) : !data ? null : (
        <>
          {/* خلاصه */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: 'بازدید در بازه', value: faNum(data.summary.totalViews), icon: Eye, color: 'text-violet-600' },
              { label: 'مقاله منتشرشده', value: faNum(data.summary.published), icon: Send, color: 'text-emerald-600' },
              { label: 'انتشار خودکار', value: faNum(data.summary.autoPublished), icon: Bot, color: 'text-brand-600' },
              { label: 'میانگین امتیاز سئو', value: faNum(data.summary.avgSeo), icon: Sparkles, color: 'text-amber-600' },
              {
                label: 'بهترین روز',
                value: data.summary.bestDay.total > 0 ? `${faDate(data.summary.bestDay.date)} (${faNum(data.summary.bestDay.total)})` : '—',
                icon: TrendingUp,
                color: 'text-emerald-600',
                small: true,
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{c.label}</span>
                  <c.icon size={16} className={c.color} />
                </div>
                <p className={cn('mt-2 font-extrabold', c.small ? 'text-sm leading-6' : 'text-2xl')}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* نمودار */}
          <Card title="روند بازدید در بازه انتخابی">
            {data.series.some((r) => r.total > 0) ? (
              <ViewsChart series={data.series} sites={data.sites.map((s) => ({ key: s.key, name: s.name, color: s.color }))} />
            ) : (
              <EmptyState
                title="در این بازه بازدیدی ثبت نشده"
                subtitle="از بخش سایت‌ها «همگام‌سازی آمار» را بزنید تا بازدیدهای تازه از سایت‌ها خوانده شود."
              />
            )}
          </Card>

          {/* جدول سایت‌ها */}
          <Card title="عملکرد سایت‌ها در بازه">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-right text-xs text-slate-400 dark:border-slate-800">
                    <th className="px-4 py-2.5 font-medium">سایت</th>
                    <th className="px-4 py-2.5 font-medium">بازدید</th>
                    <th className="px-4 py-2.5 font-medium">منتشرشده</th>
                    <th className="px-4 py-2.5 font-medium">انتشار خودکار</th>
                    <th className="px-4 py-2.5 font-medium">میانگین سئو</th>
                    <th className="px-4 py-2.5 font-medium">سهم بازدید</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.perSite.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <Badge color={s.color}>{s.name}</Badge>
                      </td>
                      <td className="px-4 py-3 font-bold">{faNum(s.views)}</td>
                      <td className="px-4 py-3">{faNum(s.published)}</td>
                      <td className="px-4 py-3">{faNum(s.autoPublished)}</td>
                      <td className="px-4 py-3">{s.published > 0 ? faNum(s.avgSeo) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${data.summary.totalViews > 0 ? (s.views / data.summary.totalViews) * 100 : 0}%`,
                                backgroundColor: s.color,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">
                            {data.summary.totalViews > 0 ? faNum(Math.round((s.views / data.summary.totalViews) * 100)) : faNum(0)}٪
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* پربازدیدهای بازه */}
          <Card title="پربازدیدترین مقاله‌های بازه">
            {data.topArticles.length === 0 ? (
              <EmptyState title="در این بازه بازدیدی ثبت نشده" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.topArticles.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold',
                        i === 0
                          ? 'bg-amber-100 text-amber-700'
                          : i === 1
                            ? 'bg-slate-200 text-slate-600'
                            : i === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                      )}
                    >
                      {faNum(i + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/articles/${a.id}`} className="block truncate font-bold hover:text-brand-600">
                        {a.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <Badge color={a.site.color}>{a.site.name}</Badge>
                        <span>امتیاز سئو: {faNum(a.seoScore)}</span>
                        <span>بازدید کل: {faNum(a.remoteViews)}</span>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                      <Eye size={14} />
                      {faNum(a.rangeViews)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
