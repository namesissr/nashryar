'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  SlidersHorizontal,
  Save,
  UploadCloud,
  DownloadCloud,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, Button, Input, Textarea, Spinner } from '@/components/ui';
import { fetcher, apiCall } from '@/lib/fetcher';
import { faNum, cn } from '@/lib/utils';

type SiteRow = { id: string; key: string; name: string; color: string };

type BlogConfig = {
  blogTitle?: string | null;
  blogDescription?: string | null;
  postsPerPage?: number | null;
  menu?: { label: string; url: string }[];
  categoriesOrder?: string[];
  showAuthor?: boolean;
  showDate?: boolean;
  showViews?: boolean;
};

type ConfigResponse = {
  config: BlogConfig;
  categories: string[];
  site: { id: string; key: string; name: string; color: string; hasSecret: boolean };
};

export default function BlogSettingsPage() {
  const { data: sitesData } = useSWR<{ sites: SiteRow[] }>('/api/admin/sites', fetcher);
  const [siteId, setSiteId] = useState('');
  const effectiveSiteId = siteId || sitesData?.sites[0]?.id || '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <SlidersHorizontal size={20} className="text-brand-500" />
            تنظیمات وبلاگ سایت‌ها
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            عنوان، توضیحات، منو و نمایش وبلاگ هر سایت را از همین‌جا تنظیم و با یک دکمه روی سایت اعمال کنید.
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

      {effectiveSiteId ? <SiteBlogConfig key={effectiveSiteId} siteId={effectiveSiteId} /> : <Spinner />}
    </div>
  );
}

function SiteBlogConfig({ siteId }: { siteId: string }) {
  const { data, isLoading, mutate } = useSWR<ConfigResponse>(`/api/admin/sites/${siteId}/blog-config`, fetcher);

  const [blogTitle, setBlogTitle] = useState('');
  const [blogDescription, setBlogDescription] = useState('');
  const [postsPerPage, setPostsPerPage] = useState(12);
  const [menu, setMenu] = useState<{ label: string; url: string }[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [showAuthor, setShowAuthor] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showViews, setShowViews] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function fill(c: BlogConfig, categories: string[]) {
    setBlogTitle(c.blogTitle || '');
    setBlogDescription(c.blogDescription || '');
    setPostsPerPage(c.postsPerPage || 12);
    setMenu(c.menu || []);
    const saved = c.categoriesOrder || [];
    // دسته‌های تازه که در ترتیب ذخیره‌شده نیستند، به انتها اضافه می‌شوند
    setOrder([...saved.filter((n) => categories.includes(n)), ...categories.filter((n) => !saved.includes(n))]);
    setShowAuthor(c.showAuthor ?? true);
    setShowDate(c.showDate ?? true);
    setShowViews(c.showViews ?? true);
  }

  useEffect(() => {
    if (data && !loaded) {
      fill(data.config, data.categories);
      setLoaded(true);
    }
  }, [data, loaded]);

  function payload(): BlogConfig {
    return {
      blogTitle: blogTitle || null,
      blogDescription: blogDescription || null,
      postsPerPage,
      menu: menu.filter((m) => m.label.trim() && m.url.trim()),
      categoriesOrder: order,
      showAuthor,
      showDate,
      showViews,
    };
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setMsg(null);
    try {
      await apiCall(`/api/admin/sites/${siteId}/blog-config`, 'PUT', payload());
      setMsg({ ok: true, text: 'در هاب ذخیره شد. برای دیده شدن روی سایت، «اعمال روی سایت» را بزنید.' });
      mutate();
      return true;
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'خطا' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndPush() {
    if (!(await save())) return;
    setPushing(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/blog-config`, { method: 'POST' });
      const json = await res.json();
      setMsg(
        json.ok
          ? { ok: true, text: `تنظیمات با موفقیت روی ${data?.site.name} اعمال شد. 🎉` }
          : { ok: false, text: json.error || 'اعمال ناموفق بود' }
      );
    } catch {
      setMsg({ ok: false, text: 'خطا در اتصال' });
    } finally {
      setPushing(false);
    }
  }

  async function readFromSite() {
    setReading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/blog-config?read=1`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        fill(json.config || {}, data?.categories || []);
        setMsg({ ok: true, text: 'تنظیمات فعلی سایت خوانده شد؛ برای ذخیره در هاب «ذخیره» را بزنید.' });
      } else {
        setMsg({ ok: false, text: json.error || 'خواندن ناموفق بود' });
      }
    } catch {
      setMsg({ ok: false, text: 'خطا در اتصال' });
    } finally {
      setReading(false);
    }
  }

  function moveCat(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= order.length) return;
    const next = [...order];
    [next[i], next[t]] = [next[t], next[i]];
    setOrder(next);
  }

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <Card title="هویت وبلاگ">
          <div className="space-y-4">
            {!data.site.hasSecret && (
              <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertCircle size={14} />
                اتصال این سایت پیکربندی نشده؛ ذخیره در هاب ممکن است ولی «اعمال روی سایت» کار نمی‌کند.
              </p>
            )}
            <Input
              label="عنوان وبلاگ (H1 صفحه وبلاگ سایت)"
              value={blogTitle}
              onChange={(e) => setBlogTitle(e.target.value)}
              placeholder={`مثلاً: مجله ${data.site.name}`}
            />
            <Textarea
              label="توضیحات وبلاگ (زیر عنوان + متا دیسکریپشن صفحه وبلاگ)"
              value={blogDescription}
              onChange={(e) => setBlogDescription(e.target.value)}
              rows={2}
              placeholder="مثلاً: آموزش‌ها، تحلیل‌ها و آخرین اخبار…"
            />
            <div className="w-40">
              <Input
                label="تعداد مقاله در هر صفحه"
                type="number"
                min={1}
                max={50}
                value={postsPerPage}
                onChange={(e) => setPostsPerPage(Math.max(1, Math.min(50, Number(e.target.value) || 12)))}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">نمایش در کارت‌ها و صفحه مقاله</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {(
                  [
                    ['نویسنده', showAuthor, setShowAuthor],
                    ['تاریخ', showDate, setShowDate],
                    ['بازدید', showViews, setShowViews],
                  ] as const
                ).map(([label, val, set]) => (
                  <label key={label} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="h-4 w-4 rounded" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="منوی وبلاگ (لینک‌های بالای صفحه وبلاگ سایت)">
          <div className="space-y-2">
            {menu.length === 0 && (
              <p className="text-xs text-slate-400">لینکی اضافه نشده — مثلاً «صفحه اصلی»، «تعرفه‌ها»، «تماس با ما».</p>
            )}
            {menu.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={m.label}
                  onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="عنوان"
                  className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  value={m.url}
                  onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  placeholder="/pricing یا https://…"
                  dir="ltr"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  onClick={() => setMenu(menu.filter((_, j) => j !== i))}
                  className="rounded-lg p-2 text-slate-400 hover:text-rose-600"
                  title="حذف"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            {menu.length < 10 && (
              <Button variant="outline" size="sm" onClick={() => setMenu([...menu, { label: '', url: '' }])}>
                <Plus size={14} />
                افزودن لینک
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="ترتیب نمایش دسته‌بندی‌ها در وبلاگ سایت">
          {order.length === 0 ? (
            <p className="text-sm text-slate-400">
              این سایت هنوز دسته‌ای ندارد — از بخش{' '}
              <Link href="/admin/categories" className="font-bold text-brand-600 underline-offset-4 hover:underline">
                دسته‌بندی‌ها
              </Link>{' '}
              دسته جدید بسازید.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {order.map((name, i) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-500 dark:bg-slate-800">
                    {faNum(i + 1)}
                  </span>
                  <span className="flex-1 font-medium">{name}</span>
                  <button
                    onClick={() => moveCat(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1 text-slate-400 hover:text-brand-600 disabled:opacity-30"
                    title="بالاتر"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    onClick={() => moveCat(i, 1)}
                    disabled={i === order.length - 1}
                    className="rounded p-1 text-slate-400 hover:text-brand-600 disabled:opacity-30"
                    title="پایین‌تر"
                  >
                    <ChevronDown size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            دسته جدید از بخش «دسته‌بندی‌ها» ساخته می‌شود و با اولین ذخیره، اینجا هم می‌آید. خود دسته‌ها با انتشار
            مقاله‌ها روی سایت ظاهر می‌شوند؛ این ترتیب فقط چینش چیپ‌های وبلاگ سایت را کنترل می‌کند.
          </p>
        </Card>

        {msg && (
          <p
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium',
              msg.ok
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            )}
          >
            {msg.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {msg.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveAndPush} loading={pushing || saving} disabled={!data.site.hasSecret}>
            <UploadCloud size={15} />
            ذخیره و اعمال روی سایت
          </Button>
          <Button variant="outline" onClick={save} loading={saving}>
            <Save size={15} />
            فقط ذخیره در هاب
          </Button>
          <Button variant="outline" onClick={readFromSite} loading={reading} disabled={!data.site.hasSecret}>
            <DownloadCloud size={15} />
            خواندن تنظیمات فعلی سایت
          </Button>
        </div>
      </div>
    </div>
  );
}
