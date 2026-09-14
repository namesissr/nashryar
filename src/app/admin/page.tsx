'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { FileText, Eye, Send, PenLine, Plus, AlertTriangle } from 'lucide-react';
import { Card, Badge, Spinner, EmptyState, Button } from '@/components/ui';
import { fetcher } from '@/lib/fetcher';
import { faNum, faDateTime } from '@/lib/utils';
import { ViewsChart } from '@/components/views-chart';

type Stats = {
  sites: {
    id: string;
    key: string;
    name: string;
    color: string;
    enabled: boolean;
    hasSecret: boolean;
    total: number;
    published: number;
    drafts: number;
    views: number;
  }[];
  byStatus: Record<string, number>;
  topArticles: { id: string; title: string; views: number; seoScore: number; site: { name: string; color: string } }[];
  recentEvents: {
    id: string;
    kind: string;
    detail: string | null;
    createdAt: string;
    articleTitle: string;
    siteName: string;
    siteColor: string;
  }[];
  series: ({ date: string; total: number } & Record<string, number | string>)[];
};

const EVENT_LABEL: Record<string, string> = {
  published: 'انتشار',
  updated: 'به‌روزرسانی',
  unpublished: 'برداشتن از سایت',
  error: 'خطا',
  'stats-sync': 'همگام‌سازی آمار',
};

export default function Dashboard() {
  const { data, isLoading } = useSWR<Stats>('/api/admin/stats', fetcher);

  if (isLoading || !data) return <Spinner />;

  const totalArticles = Object.values(data.byStatus).reduce((a, b) => a + b, 0);
  const totalViews = data.sites.reduce((a, s) => a + s.views, 0);
  const unconfigured = data.sites.filter((s) => !s.hasSecret);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">داشبورد</h1>
          <p className="mt-1 text-sm text-slate-500">نمای کلی محتوای هر چهار سایت</p>
        </div>
        <Link href="/admin/articles/new">
          <Button>
            <Plus size={16} />
            مقاله جدید
          </Button>
        </Link>
      </div>

      {unconfigured.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300">
              اتصال {unconfigured.map((s) => s.name).join('، ')} هنوز پیکربندی نشده است.
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-400">
              از بخش <Link href="/admin/sites" className="underline">سایت‌ها</Link> آدرس API و کلید محرمانه هر سایت را
              وارد کنید تا انتشار فعال شود.
            </p>
          </div>
        </div>
      )}

      {/* کارت‌های خلاصه */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'کل مقاله‌ها', value: totalArticles, icon: FileText, color: 'text-brand-600' },
          { label: 'منتشرشده', value: data.byStatus.PUBLISHED || 0, icon: Send, color: 'text-emerald-600' },
          { label: 'پیش‌نویس', value: data.byStatus.DRAFT || 0, icon: PenLine, color: 'text-amber-600' },
          { label: 'مجموع بازدید', value: totalViews, icon: Eye, color: 'text-violet-600' },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{c.label}</span>
              <c.icon size={18} className={c.color} />
            </div>
            <p className="mt-2 text-2xl font-extrabold">{faNum(c.value)}</p>
          </div>
        ))}
      </div>

      {/* وضعیت سایت‌ها */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.sites.map((s) => (
          <Link
            key={s.id}
            href={`/admin/articles?siteId=${s.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            style={{ borderTopWidth: 3, borderTopColor: s.color }}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold">{s.name}</span>
              <Badge color={s.color}>{s.hasSecret ? 'متصل' : 'پیکربندی نشده'}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="font-extrabold">{faNum(s.published)}</p>
                <p className="text-[11px] text-slate-400">منتشرشده</p>
              </div>
              <div>
                <p className="font-extrabold">{faNum(s.drafts)}</p>
                <p className="text-[11px] text-slate-400">پیش‌نویس</p>
              </div>
              <div>
                <p className="font-extrabold">{faNum(s.views)}</p>
                <p className="text-[11px] text-slate-400">بازدید</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* نمودار بازدید */}
      <Card title="بازدید ۳۰ روز گذشته (به تفکیک سایت)">
        {data.series.some((r) => r.total > 0) ? (
          <ViewsChart series={data.series} sites={data.sites.map((s) => ({ key: s.key, name: s.name, color: s.color }))} />
        ) : (
          <EmptyState
            title="هنوز آماری ثبت نشده"
            subtitle="پس از انتشار مقاله، از بخش سایت‌ها «همگام‌سازی آمار» را بزنید تا بازدیدها از سایت‌ها خوانده شود."
          />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* پربازدیدها */}
        <Card title="پربازدیدترین مقاله‌ها">
          {data.topArticles.length === 0 ? (
            <EmptyState title="هنوز بازدیدی ثبت نشده" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.topArticles.map((a, i) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 text-center text-sm font-extrabold text-slate-400">{faNum(i + 1)}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/articles/${a.id}`} className="block truncate text-sm font-bold hover:text-brand-600">
                      {a.title}
                    </Link>
                    <Badge color={a.site.color} className="mt-0.5">
                      {a.site.name}
                    </Badge>
                  </div>
                  <span className="flex items-center gap-1 text-sm text-slate-500">
                    <Eye size={14} />
                    {faNum(a.views)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* رویدادهای اخیر */}
        <Card title="فعالیت‌های اخیر">
          {data.recentEvents.length === 0 ? (
            <EmptyState title="فعالیتی ثبت نشده" subtitle="با نوشتن و انتشار اولین مقاله شروع کنید." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentEvents.map((e) => (
                <li key={e.id} className="py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge
                      className={
                        e.kind === 'error'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }
                    >
                      {EVENT_LABEL[e.kind] || e.kind}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{e.articleTitle}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{faDateTime(e.createdAt)}</span>
                  </div>
                  {e.detail && <p className="mt-1 pr-1 text-xs text-slate-500">{e.detail}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
