'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Gauge, ExternalLink } from 'lucide-react';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import { fetcher } from '@/lib/fetcher';
import { faNum, faDateTime, cn } from '@/lib/utils';

type CheckRow = { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; fix?: string };

type Report = {
  checkedAt: string;
  score: number;
  checks: CheckRow[];
  facts: {
    blogUrl: string;
    blogStatus: number | null;
    sitemapUrl: string;
    sitemapStatus: number | null;
    robotsStatus: number | null;
    sampleArticleUrl: string | null;
    sampleTitle: string | null;
    responseMs: number | null;
  };
};

export function SiteSeoReport({ siteId }: { siteId: string }) {
  const { data, isLoading, mutate } = useSWR<{
    site: { name: string; baseUrl: string };
    report: Report | null;
    checkedAt: string | null;
  }>(`/api/admin/sites/${siteId}/seo-report`, fetcher);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    setRunning(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/seo-report`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) setErr(json.error || 'بررسی ناموفق بود');
      await mutate();
    } catch {
      setErr('خطا در اجرای بررسی');
    } finally {
      setRunning(false);
    }
  }

  if (isLoading || !data) return <Spinner />;

  const report = data.report;
  const scoreColor = !report
    ? 'text-slate-400'
    : report.score >= 80
      ? 'text-emerald-600'
      : report.score >= 50
        ? 'text-amber-600'
        : 'text-rose-600';

  const failed = report?.checks.filter((c) => c.status === 'fail') ?? [];
  const warned = report?.checks.filter((c) => c.status === 'warn') ?? [];

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Gauge size={17} className="text-brand-500" />
          گزارش فنی سئوی سایت
        </span>
      }
      action={
        <Button size="sm" variant="outline" onClick={run} loading={running}>
          <RefreshCw size={14} />
          {report ? 'بررسی دوباره' : 'اجرای بررسی'}
        </Button>
      }
    >
      {err && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30">{err}</p>}

      {!report ? (
        <EmptyState
          title="هنوز بررسی‌ای انجام نشده"
          subtitle="با «اجرای بررسی»، نشریار صفحه وبلاگ، نقشه سایت، robots.txt و یک مقاله واقعی این سایت را می‌خواند و وضعیت فنی سئو را گزارش می‌دهد."
        />
      ) : (
        <div className="space-y-4">
          {/* امتیاز و خلاصه */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-[72px] w-[72px] shrink-0">
              <svg viewBox="0 0 36 36" className="h-[72px] w-[72px] -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-slate-100 dark:text-slate-800" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(report.score / 100) * 97.4} 97.4`}
                  className={scoreColor}
                />
              </svg>
              <span className={cn('absolute inset-0 flex items-center justify-center text-lg font-extrabold', scoreColor)}>
                {faNum(report.score)}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold">
                {failed.length === 0 && warned.length === 0
                  ? 'همه بررسی‌ها قبول شد ✅'
                  : `${faNum(failed.length)} ایراد جدی و ${faNum(warned.length)} هشدار`}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">آخرین بررسی: {faDateTime(report.checkedAt)}</p>
              {report.facts.responseMs !== null && (
                <p className="mt-0.5 text-xs text-slate-400">زمان پاسخ صفحه وبلاگ: {faNum(report.facts.responseMs)} میلی‌ثانیه</p>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs">
              {[
                { label: 'صفحه وبلاگ', url: report.facts.blogUrl, status: report.facts.blogStatus },
                { label: 'نقشه سایت', url: report.facts.sitemapUrl, status: report.facts.sitemapStatus },
                { label: 'مقاله نمونه', url: report.facts.sampleArticleUrl, status: null },
              ]
                .filter((x) => x.url)
                .map((x) => (
                  <a
                    key={x.label}
                    href={x.url!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-slate-400 hover:text-brand-600"
                  >
                    <ExternalLink size={11} />
                    {x.label}
                    {x.status !== null && <span className="text-[10px]">({faNum(x.status ?? 0)})</span>}
                  </a>
                ))}
            </div>
          </div>

          {/* فهرست بررسی‌ها */}
          <ul className="space-y-1.5">
            {report.checks.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-5',
                  c.status === 'fail'
                    ? 'bg-rose-50/70 dark:bg-rose-900/15'
                    : c.status === 'warn'
                      ? 'bg-amber-50/70 dark:bg-amber-900/15'
                      : 'bg-slate-50 dark:bg-slate-800/50'
                )}
              >
                {c.status === 'pass' ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                ) : c.status === 'warn' ? (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                ) : (
                  <XCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0">
                  <p className={c.status === 'pass' ? 'text-slate-600 dark:text-slate-300' : 'font-bold'}>
                    {c.label} — <span className="font-normal text-slate-500">{c.detail}</span>
                  </p>
                  {c.fix && c.status !== 'pass' && <p className="mt-0.5 text-slate-500">💡 {c.fix}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
