'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  CalendarClock,
  Play,
  Save,
  ChevronUp,
  ChevronDown,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, Button, Badge, Spinner, EmptyState, Select, Input } from '@/components/ui';
import { fetcher, apiCall } from '@/lib/fetcher';
import { faNum, faDateTime, cn, WEEK_DAYS } from '@/lib/utils';

type QueueItem = {
  id: string;
  title: string;
  status: string;
  queuePosition: number | null;
  publishedAt: string | null;
  seoScore: number;
  syncError: string | null;
};

type SitePlan = {
  id: string;
  key: string;
  name: string;
  color: string;
  hasSecret: boolean;
  autoPublishEnabled: boolean;
  autoPerDay: number;
  autoWindowStart: string;
  autoWindowEnd: string;
  autoDays: string;
  autoMode: string;
  autoTimes: string;
  todaySlots: { time: string; passed: boolean }[];
  publishedToday: number;
  queue: QueueItem[];
  scheduled: QueueItem[];
};

export default function SchedulePage() {
  const { data, isLoading, mutate } = useSWR<{ sites: SitePlan[]; serverTime: string }>(
    '/api/admin/schedule',
    fetcher,
    { refreshInterval: 30000 }
  );
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');

  async function runNow() {
    setRunning(true);
    setRunMsg('');
    try {
      const res = await apiCall<{ scheduledPublished: string[]; queuePublished: string[]; errors: string[] }>(
        '/api/admin/schedule/run',
        'POST'
      );
      const total = res.scheduledPublished.length + res.queuePublished.length;
      setRunMsg(
        total > 0
          ? `✅ ${faNum(total)} مقاله منتشر شد${res.errors.length ? ` — ${res.errors.join('، ')}` : ''}`
          : res.errors.length
            ? `⚠️ ${res.errors.join('، ')}`
            : 'چیزی برای انتشار در این لحظه نبود.'
      );
      mutate();
    } catch (err) {
      setRunMsg(err instanceof Error ? err.message : 'خطا');
    } finally {
      setRunning(false);
    }
  }

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">زمان‌بندی انتشار</h1>
          <p className="mt-1 text-sm text-slate-500">
            زمان‌بند هر ۶۰ ثانیه خودکار اجرا می‌شود · ساعت سرور: {faDateTime(data.serverTime)}
          </p>
        </div>
        <Button variant="outline" onClick={runNow} loading={running}>
          <Play size={15} />
          اجرای الان
        </Button>
      </div>
      {runMsg && (
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800">{runMsg}</p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {data.sites.map((s) => (
          <SitePlanCard key={s.id} site={s} onChanged={() => mutate()} />
        ))}
      </div>
    </div>
  );
}

function SitePlanCard({ site, onChanged }: { site: SitePlan; onChanged: () => void }) {
  const [enabled, setEnabled] = useState(site.autoPublishEnabled);
  const [perDay, setPerDay] = useState(site.autoPerDay);
  const [mode, setMode] = useState(site.autoMode);
  const [windowStart, setWindowStart] = useState(site.autoWindowStart);
  const [windowEnd, setWindowEnd] = useState(site.autoWindowEnd);
  const [times, setTimes] = useState(site.autoTimes);
  const [days, setDays] = useState<number[]>(
    site.autoDays.split(',').map(Number).filter((n) => !Number.isNaN(n))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // با رفرش SWR فرم دست‌نخورده هماهنگ بماند
  useEffect(() => {
    setEnabled(site.autoPublishEnabled);
  }, [site.autoPublishEnabled]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function savePlan() {
    if (days.length === 0) {
      setMsg({ ok: false, text: 'حداقل یک روز هفته را انتخاب کنید.' });
      return;
    }
    if (mode === 'times' && !times.trim()) {
      setMsg({ ok: false, text: 'در حالت ساعت‌های ثابت، دست‌کم یک ساعت وارد کنید (مثل 09:00,14:00).' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await apiCall(`/api/admin/sites/${site.id}`, 'PUT', {
        autoPublishEnabled: enabled,
        autoPerDay: perDay,
        autoMode: mode,
        autoWindowStart: windowStart,
        autoWindowEnd: windowEnd,
        autoTimes: times,
        autoDays: [...days].sort().join(','),
      });
      setMsg({ ok: true, text: 'برنامه ذخیره شد.' });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'خطا' });
    } finally {
      setSaving(false);
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const ids = site.queue.map((q) => q.id);
    const idx = ids.indexOf(id);
    const target = idx + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    await apiCall('/api/admin/schedule/reorder', 'POST', { siteId: site.id, ids });
    onChanged();
  }

  async function removeFromQueue(id: string) {
    await apiCall(`/api/admin/articles/${id}/queue`, 'DELETE');
    onChanged();
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: site.color }} />
          {site.name}
        </span>
      }
      action={
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <span className={enabled ? 'font-bold text-emerald-600' : 'text-slate-400'}>
            {enabled ? 'فعال' : 'خاموش'}
          </span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={cn(
              'relative h-6 w-11 rounded-full transition',
              enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                enabled ? 'left-0.5' : 'left-[22px]'
              )}
            />
          </button>
        </label>
      }
    >
      <div className="space-y-4">
        {!site.hasSecret && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertCircle size={14} />
            اتصال این سایت پیکربندی نشده؛ تا آن زمان انتشار خودکار انجام نمی‌شود.
          </p>
        )}

        {/* تنظیمات برنامه */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="تعداد مقاله در روز"
            type="number"
            min={1}
            max={24}
            value={perDay}
            onChange={(e) => setPerDay(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
          />
          <Select label="نحوه پخش در روز" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="spread">پخش یکنواخت در بازه</option>
            <option value="times">ساعت‌های ثابت</option>
          </Select>
          {mode === 'spread' ? (
            <>
              <Input
                label="از ساعت"
                type="time"
                dir="ltr"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
              <Input
                label="تا ساعت"
                type="time"
                dir="ltr"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
              />
            </>
          ) : (
            <div className="col-span-2">
              <Input
                label="ساعت‌های انتشار (با ویرگول)"
                dir="ltr"
                value={times}
                onChange={(e) => setTimes(e.target.value)}
                placeholder="09:00,14:00,19:30"
                hint={`فقط ${faNum(perDay)} ساعتِ اول استفاده می‌شود.`}
              />
            </div>
          )}
        </div>

        {/* روزهای هفته */}
        <div>
          <p className="mb-1.5 text-sm font-medium">روزهای انتشار</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-bold transition',
                  days.includes(d.value)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <p
            className={cn(
              'rounded-xl px-3 py-2 text-sm',
              msg.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            )}
          >
            {msg.text}
          </p>
        )}

        <Button size="sm" onClick={savePlan} loading={saving}>
          <Save size={14} />
          ذخیره برنامه
        </Button>

        {/* برنامه امروز */}
        {enabled && site.todaySlots.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Clock size={14} />
              برنامه امروز — {faNum(site.publishedToday)} از {faNum(site.todaySlots.length)} منتشر شده
            </p>
            <div className="flex flex-wrap gap-1.5">
              {site.todaySlots.map((slot, i) => {
                const done = i < site.publishedToday;
                return (
                  <span
                    key={i}
                    dir="ltr"
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold',
                      done
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : slot.passed
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {done && <CheckCircle2 size={12} />}
                    {slot.time}
                  </span>
                );
              })}
            </div>
            {site.queue.length === 0 && site.publishedToday < site.todaySlots.length && (
              <p className="mt-1.5 text-xs text-amber-600">صف خالی است — مقاله به صف اضافه کنید تا در نوبت‌های بعدی منتشر شود.</p>
            )}
          </div>
        )}

        {/* زمان‌بندی‌شده‌ها */}
        {site.scheduled.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <CalendarClock size={14} />
              زمان‌بندی‌شده ({faNum(site.scheduled.length)})
            </p>
            <ul className="space-y-1.5">
              {site.scheduled.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl bg-amber-50/60 px-3 py-2 text-sm dark:bg-amber-900/10"
                >
                  <Link href={`/admin/articles/${a.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-600">
                    {a.title}
                  </Link>
                  <span className="shrink-0 text-xs text-amber-700 dark:text-amber-400">{faDateTime(a.publishedAt)}</span>
                  <button
                    onClick={() => removeFromQueue(a.id)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:text-rose-600"
                    title="لغو زمان‌بندی"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* صف */}
        <div>
          <p className="mb-1.5 text-sm font-medium">صف انتشار خودکار ({faNum(site.queue.length)})</p>
          {site.queue.length === 0 ? (
            <EmptyState
              title="صف خالی است"
              subtitle="از ویرایشگر مقاله، «افزودن به صف انتشار خودکار» را بزنید."
            />
          ) : (
            <ul className="space-y-1.5">
              {site.queue.map((a, i) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-extrabold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    {faNum(i + 1)}
                  </span>
                  <Link href={`/admin/articles/${a.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-600">
                    {a.title}
                  </Link>
                  {a.syncError && (
                    <span className="shrink-0 text-rose-500" title={a.syncError}>
                      <AlertCircle size={14} />
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-slate-400">سئو {faNum(a.seoScore)}</span>
                  <div className="flex shrink-0 items-center">
                    <button
                      onClick={() => move(a.id, -1)}
                      disabled={i === 0}
                      className="rounded p-1 text-slate-400 hover:text-brand-600 disabled:opacity-30"
                      title="بالاتر"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => move(a.id, 1)}
                      disabled={i === site.queue.length - 1}
                      className="rounded p-1 text-slate-400 hover:text-brand-600 disabled:opacity-30"
                      title="پایین‌تر"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      onClick={() => removeFromQueue(a.id)}
                      className="rounded p-1 text-slate-400 hover:text-rose-600"
                      title="خروج از صف"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
