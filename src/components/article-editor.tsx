'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  Image as ImageIcon,
  Send,
  Save,
  Trash2,
  CloudOff,
  CalendarClock,
  ListPlus,
  ListX,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/markdown-editor';
import Link from 'next/link';
import { Button, Card, Input, Textarea, Select, Badge, Spinner } from '@/components/ui';
import { MediaPicker } from '@/components/media-picker';
import { SeoPanel, SerpPreview } from '@/components/seo-panel';
import { fetcher, apiCall } from '@/lib/fetcher';
import { slugify, faNum, faDateTime, cn, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils';

type SiteRow = { id: string; key: string; name: string; color: string; baseUrl: string; hasSecret: boolean };
type CategoryRow = { id: string; name: string };

type ArticleData = {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentMd: string;
  coverUrl: string | null;
  coverAlt: string | null;
  categoryId: string | null;
  tags: string[];
  focusKeyword: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  status: string;
  publishedAt: string | null;
  queuePosition: number | null;
  syncedAt: string | null;
  syncError: string | null;
  remoteSlug: string | null;
  remoteViews: number;
  events: { id: string; kind: string; detail: string | null; createdAt: string }[];
};

export function ArticleEditor({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const isNew = !articleId;

  const { data: sitesData } = useSWR<{ sites: SiteRow[] }>('/api/admin/sites', fetcher);
  const { data: articleData, mutate: mutateArticle } = useSWR<{ article: ArticleData }>(
    articleId ? `/api/admin/articles/${articleId}` : null,
    fetcher
  );

  // ---- state فرم ----
  const [siteId, setSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverAlt, setCoverAlt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [noindex, setNoindex] = useState(false);

  const [scheduleAt, setScheduleAt] = useState('');
  const [picker, setPicker] = useState<null | 'content' | 'cover'>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const mdRef = useRef<MarkdownEditorHandle>(null);

  const article = articleData?.article;

  // پر کردن فرم هنگام بارگذاری مقاله موجود
  useEffect(() => {
    if (article && !loaded) {
      setSiteId(article.siteId);
      setTitle(article.title);
      setSlug(article.slug);
      setSlugTouched(true);
      setExcerpt(article.excerpt || '');
      setContentMd(article.contentMd);
      setCoverUrl(article.coverUrl || '');
      setCoverAlt(article.coverAlt || '');
      setCategoryId(article.categoryId || '');
      setTags(article.tags.join('، '));
      setFocusKeyword(article.focusKeyword || '');
      setSeoTitle(article.seoTitle || '');
      setSeoDescription(article.seoDescription || '');
      setCanonicalUrl(article.canonicalUrl || '');
      setNoindex(article.noindex);
      setLoaded(true);
    }
  }, [article, loaded]);

  // انتخاب پیش‌فرض اولین سایت برای مقاله جدید
  useEffect(() => {
    if (isNew && !siteId && sitesData?.sites.length) {
      setSiteId(sitesData.sites[0].id);
    }
  }, [isNew, siteId, sitesData]);

  const { data: catsData } = useSWR<{ categories: CategoryRow[] }>(
    siteId ? `/api/admin/categories?siteId=${siteId}` : null,
    fetcher
  );

  const site = sitesData?.sites.find((s) => s.id === siteId);
  const effectiveSlug = slugTouched && slug ? slug : slugify(title);

  // ابعاد واقعی تصویر شاخص برای راهنمایی نویسنده
  const [coverDims, setCoverDims] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!coverUrl) {
      setCoverDims(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setCoverDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setCoverDims(null);
    img.src = coverUrl;
  }, [coverUrl]);

  const siteHost = useMemo(() => {
    try {
      return site ? new URL(site.baseUrl).host.replace(/^www\./, '') : undefined;
    } catch {
      return undefined;
    }
  }, [site]);

  const seoInput = useMemo(
    () => ({
      title,
      slug: effectiveSlug,
      excerpt,
      contentMd,
      focusKeyword,
      seoTitle,
      seoDescription,
      coverUrl,
      coverAlt,
      siteHost,
    }),
    [title, effectiveSlug, excerpt, contentMd, focusKeyword, seoTitle, seoDescription, coverUrl, coverAlt, siteHost]
  );

  // بررسی تکراری نبودن کلیدواژه کانونی در همان سایت
  const { data: kwDup } = useSWR<{ duplicates: { id: string; title: string }[] }>(
    focusKeyword.trim().length >= 2 && siteId
      ? `/api/admin/seo/keyword-check?siteId=${siteId}&keyword=${encodeURIComponent(focusKeyword.trim())}${articleId ? `&excludeId=${articleId}` : ''}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  function markDirty() {
    setDirty(true);
    setMessage(null);
  }

  function payload() {
    return {
      siteId,
      title,
      slug: effectiveSlug,
      excerpt: excerpt || null,
      contentMd,
      coverUrl: coverUrl || null,
      coverAlt: coverAlt || null,
      categoryId: categoryId || null,
      tags: tags
        .split(/[,،]/)
        .map((t) => t.trim())
        .filter(Boolean),
      focusKeyword: focusKeyword || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      canonicalUrl: canonicalUrl || null,
      noindex,
    };
  }

  async function save(): Promise<string | null> {
    if (!title.trim() || !siteId) {
      setMessage({ type: 'err', text: 'عنوان و سایت مقصد الزامی است.' });
      return null;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (isNew) {
        const res = await apiCall<{ id: string }>('/api/admin/articles', 'POST', payload());
        setDirty(false);
        router.replace(`/admin/articles/${res.id}`);
        return res.id;
      } else {
        await apiCall(`/api/admin/articles/${articleId}`, 'PUT', payload());
        setDirty(false);
        await mutateArticle();
        setMessage({ type: 'ok', text: 'ذخیره شد.' });
        return articleId!;
      }
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'ذخیره ناموفق بود' });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndPublish(unpublish = false) {
    const id = await save();
    if (!id) return;
    setPublishing(true);
    setMessage(null);
    try {
      await apiCall(`/api/admin/articles/${id}/publish`, 'POST', { unpublish });
      await mutateArticle();
      setMessage({
        type: 'ok',
        text: unpublish ? 'مقاله از سایت برداشته شد.' : `مقاله با موفقیت روی ${site?.name || 'سایت'} منتشر شد. 🎉`,
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'انتشار ناموفق بود' });
    } finally {
      setPublishing(false);
    }
  }

  async function queueToggle(add: boolean) {
    const id = add ? await save() : articleId;
    if (!id) return;
    try {
      const res = await apiCall<{ position?: number }>(`/api/admin/articles/${id}/queue`, add ? 'POST' : 'DELETE');
      await mutateArticle();
      setMessage({
        type: 'ok',
        text: add ? `به صف انتشار خودکار ${site?.name || ''} افزوده شد (جایگاه ${faNum(res.position || 1)}).` : 'به پیش‌نویس برگشت.',
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'خطا' });
    }
  }

  async function scheduleForDate() {
    if (!scheduleAt) {
      setMessage({ type: 'err', text: 'ابتدا تاریخ و ساعت انتشار را انتخاب کنید.' });
      return;
    }
    const id = await save();
    if (!id) return;
    try {
      await apiCall(`/api/admin/articles/${id}/schedule`, 'POST', {
        publishedAt: new Date(scheduleAt).toISOString(),
      });
      await mutateArticle();
      setMessage({ type: 'ok', text: 'زمان‌بندی شد؛ در زمان تعیین‌شده خودکار منتشر می‌شود. ⏰' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'خطا در زمان‌بندی' });
    }
  }

  async function remove() {
    if (!articleId) return;
    if (!confirm('مقاله هم از هاب و هم از سایت مقصد حذف می‌شود. مطمئن هستید؟')) return;
    try {
      await apiCall(`/api/admin/articles/${articleId}`, 'DELETE');
      router.push('/admin/articles');
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'حذف ناموفق بود' });
    }
  }

  if (!isNew && !article) return <Spinner />;

  return (
    <div className="space-y-5">
      {/* هدر */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/articles"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowRight size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold">{isNew ? 'مقاله جدید' : 'ویرایش مقاله'}</h1>
            {article && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={cn('rounded-full px-2 py-0.5 font-bold', STATUS_COLORS[article.status])}>
                  {STATUS_LABELS[article.status]}
                </span>
                {article.syncedAt && (
                  <span className="text-slate-400">آخرین انتشار: {faDateTime(article.syncedAt)}</span>
                )}
                {article.remoteViews > 0 && <span className="text-slate-400">{faNum(article.remoteViews)} بازدید</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && article?.status === 'PUBLISHED' && (
            <>
              {site && (
                <a
                  href={`${site.baseUrl.replace(/\/$/, '')}/blog/${article.remoteSlug || article.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink size={14} />
                    مشاهده روی سایت
                  </Button>
                </a>
              )}
              <Button variant="outline" size="sm" onClick={() => saveAndPublish(true)} loading={publishing}>
                <CloudOff size={14} />
                برداشتن از سایت
              </Button>
            </>
          )}
          {!isNew && (
            <Button variant="danger" size="sm" onClick={remove}>
              <Trash2 size={14} />
              حذف
            </Button>
          )}
          <Button variant="outline" onClick={save} loading={saving}>
            <Save size={15} />
            ذخیره
          </Button>
          <Button onClick={() => saveAndPublish(false)} loading={publishing || saving} disabled={!site?.hasSecret}>
            <Send size={15} />
            {article?.status === 'PUBLISHED' ? 'به‌روزرسانی روی سایت' : 'انتشار'}
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium',
            message.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
          )}
        >
          {message.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {article?.syncError && !message && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          <AlertCircle size={16} />
          آخرین خطای انتشار: {article.syncError}
        </div>
      )}

      {site && !site.hasSecret && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          اتصال {site.name} پیکربندی نشده؛ از بخش{' '}
          <Link href="/admin/sites" className="font-bold underline">
            سایت‌ها
          </Link>{' '}
          کلید محرمانه را وارد کنید. فعلاً فقط می‌توانید پیش‌نویس ذخیره کنید.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {/* ستون اصلی */}
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="space-y-4">
              <Input
                label="عنوان مقاله"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                placeholder="مثلاً: راهنمای کامل خرید بیت‌کوین برای مبتدی‌ها"
                className="text-lg font-bold"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="نشانی (اسلاگ)"
                  value={slugTouched ? slug : effectiveSlug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                    markDirty();
                  }}
                  hint={site ? `${site.baseUrl.replace(/^https?:\/\//, '')}/blog/${effectiveSlug || '…'}` : undefined}
                />
                <Input
                  label="برچسب‌ها (با ویرگول جدا کنید)"
                  value={tags}
                  onChange={(e) => {
                    setTags(e.target.value);
                    markDirty();
                  }}
                  placeholder="بیت‌کوین، آموزش، ارز دیجیتال"
                />
              </div>
              <Textarea
                label="خلاصه (برای فهرست وبلاگ و توضیحات متا)"
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  markDirty();
                }}
                rows={2}
              />
            </div>
          </Card>

          {/* ویرایشگر متن */}
          <MarkdownEditor
            ref={mdRef}
            value={contentMd}
            onChange={(v) => {
              setContentMd(v);
              markDirty();
            }}
            onImageRequest={() => setPicker('content')}
            onSave={save}
          />

          {/* تصویر شاخص */}
          <Card
            title="تصویر شاخص"
            action={
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                اندازه دقیق: ۱۲۰۰ × ۶۳۰ پیکسل
              </span>
            }
          >
            <div className="flex flex-wrap items-start gap-4">
              <button
                type="button"
                onClick={() => setPicker('cover')}
                className="relative flex h-32 w-56 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800"
                style={{ aspectRatio: '1200 / 630' }}
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt={coverAlt} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-xs">
                    <ImageIcon size={22} />
                    انتخاب تصویر
                    <span className="text-[10px] text-slate-400" dir="ltr">
                      1200 × 630
                    </span>
                  </span>
                )}
              </button>
              <div className="min-w-52 flex-1 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <p className="font-bold text-slate-600 dark:text-slate-300">راهنمای نویسنده:</p>
                  <p>
                    اندازه دقیق <b dir="ltr">۱۲۰۰ × ۶۳۰</b> پیکسل (نسبت ۱٫۹۱ به ۱) — این اندازه استاندارد اشتراک‌گذاری
                    در گوگل، تلگرام و شبکه‌های اجتماعی است و در هر چهار سایت درست نمایش داده می‌شود. فرمت JPG یا WebP،
                    حداکثر ۵ مگابایت.
                  </p>
                </div>
                {coverUrl && coverDims && <CoverSizeCheck dims={coverDims} />}
                <Input
                  label="متن جایگزین تصویر (alt)"
                  value={coverAlt}
                  onChange={(e) => {
                    setCoverAlt(e.target.value);
                    markDirty();
                  }}
                  hint="برای سئوی تصویر و دسترس‌پذیری مهم است."
                />
                {coverUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCoverUrl('');
                      markDirty();
                    }}
                  >
                    حذف تصویر شاخص
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* تاریخچه */}
          {article && article.events.length > 0 && (
            <Card title="تاریخچه این مقاله">
              <ul className="space-y-2 text-xs">
                {article.events.map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        e.kind === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
                      )}
                    />
                    <div>
                      <span className="text-slate-500">{faDateTime(e.createdAt)}</span>
                      {e.detail && <p className="text-slate-700 dark:text-slate-300">{e.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* ستون کناری */}
        <div className="space-y-5">
          <Card title="انتشار">
            <div className="space-y-4">
              <Select
                label="سایت مقصد"
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  setCategoryId('');
                  markDirty();
                }}
                disabled={!isNew && article?.status === 'PUBLISHED'}
              >
                {sitesData?.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.hasSecret ? '' : '(پیکربندی نشده)'}
                  </option>
                ))}
              </Select>
              {site && (
                <div className="flex items-center gap-2">
                  <Badge color={site.color}>{site.name}</Badge>
                  <span className="text-xs text-slate-400" dir="ltr">
                    {site.baseUrl.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              )}
              <Select
                label="دسته‌بندی"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  markDirty();
                }}
              >
                <option value="">بدون دسته</option>
                {catsData?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {/* زمان‌بندی و صف خودکار */}
              <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <CalendarClock size={14} />
                  انتشار خودکار
                </p>
                {article?.status === 'QUEUED' ? (
                  <>
                    <p className="text-sm">
                      در <span className="font-bold text-violet-600 dark:text-violet-400">صف انتشار خودکار</span> —
                      جایگاه {faNum(article.queuePosition ?? 1)}
                    </p>
                    <p className="text-xs text-slate-400">
                      طبق برنامه سایت (بخش «زمان‌بندی») به‌صورت خودکار منتشر می‌شود.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => queueToggle(false)}>
                      <ListX size={14} />
                      خروج از صف
                    </Button>
                  </>
                ) : article?.status === 'SCHEDULED' ? (
                  <>
                    <p className="text-sm">
                      زمان‌بندی‌شده برای{' '}
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {faDateTime(article.publishedAt)}
                      </span>
                    </p>
                    <Button variant="outline" size="sm" onClick={() => queueToggle(false)}>
                      <ListX size={14} />
                      لغو زمان‌بندی
                    </Button>
                  </>
                ) : article?.status === 'PUBLISHED' ? (
                  <p className="text-xs text-slate-400">مقاله منتشر شده؛ زمان‌بندی لازم ندارد.</p>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => queueToggle(true)}
                      disabled={!site?.hasSecret}
                    >
                      <ListPlus size={14} />
                      افزودن به صف انتشار خودکار
                    </Button>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-slate-500">یا در زمان مشخص:</label>
                        <input
                          type="datetime-local"
                          dir="ltr"
                          value={scheduleAt}
                          onChange={(e) => setScheduleAt(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scheduleForDate}
                        disabled={!site?.hasSecret || !scheduleAt}
                      >
                        زمان‌بندی
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {dirty && <p className="text-xs font-bold text-amber-600">تغییرات ذخیره‌نشده دارید.</p>}
            </div>
          </Card>

          <Card title="سئو">
            <div className="space-y-4">
              <Input
                label="کلیدواژه کانونی"
                value={focusKeyword}
                onChange={(e) => {
                  setFocusKeyword(e.target.value);
                  markDirty();
                }}
                placeholder="مثلاً: خرید بیت‌کوین"
              />
              <div>
                <Input
                  label="عنوان سئو"
                  value={seoTitle}
                  onChange={(e) => {
                    setSeoTitle(e.target.value);
                    markDirty();
                  }}
                  placeholder={title || 'پیش‌فرض: عنوان مقاله'}
                />
                <LengthBar value={(seoTitle || title).length} min={30} max={65} />
              </div>
              <div>
                <Textarea
                  label="توضیحات متا"
                  value={seoDescription}
                  onChange={(e) => {
                    setSeoDescription(e.target.value);
                    markDirty();
                  }}
                  rows={3}
                  placeholder={excerpt || 'پیش‌فرض: خلاصه مقاله'}
                />
                <LengthBar value={(seoDescription || excerpt).length} min={70} max={160} />
              </div>
              {site && (
                <SerpPreview
                  title={seoTitle || title}
                  description={seoDescription || excerpt}
                  baseUrl={site.baseUrl}
                  slug={effectiveSlug}
                />
              )}
              <details className="text-sm">
                <summary className="cursor-pointer font-bold text-slate-500">تنظیمات پیشرفته</summary>
                <div className="mt-3 space-y-3">
                  <Input
                    label="آدرس Canonical (اختیاری)"
                    dir="ltr"
                    value={canonicalUrl}
                    onChange={(e) => {
                      setCanonicalUrl(e.target.value);
                      markDirty();
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={noindex}
                      onChange={(e) => {
                        setNoindex(e.target.checked);
                        markDirty();
                      }}
                      className="h-4 w-4 rounded"
                    />
                    noindex — از موتورهای جستجو پنهان شود
                  </label>
                </div>
              </details>
            </div>
          </Card>

          <Card title="تحلیل سئو (زنده)">
            <SeoPanel input={seoInput} duplicateKeywords={kwDup?.duplicates} />
          </Card>
        </div>
      </div>

      {picker && (
        <MediaPicker
          onClose={() => setPicker(null)}
          onSelect={(m) => {
            if (picker === 'cover') {
              setCoverUrl(m.url);
              if (m.alt && !coverAlt) setCoverAlt(m.alt);
            } else {
              mdRef.current?.insert(`![${m.alt || 'توضیح تصویر'}](${m.url})`);
            }
            setPicker(null);
            markDirty();
          }}
        />
      )}
    </div>
  );
}

/** بررسی ابعاد واقعی تصویر شاخص و راهنمایی نویسنده */
function CoverSizeCheck({ dims }: { dims: { w: number; h: number } }) {
  const ratio = dims.w / dims.h;
  const exact = dims.w === 1200 && dims.h === 630;
  const ratioOk = ratio >= 1.85 && ratio <= 1.97;
  const bigEnough = dims.w >= 1200;

  let status: 'ok' | 'warn';
  let text: string;
  if (exact) {
    status = 'ok';
    text = 'عالی! اندازه تصویر دقیقاً ۱۲۰۰ × ۶۳۰ است.';
  } else if (bigEnough && ratioOk) {
    status = 'ok';
    text = `اندازه مناسب است (${faNum(dims.w)} × ${faNum(dims.h)})؛ نسبت تصویر استاندارد است.`;
  } else if (!bigEnough) {
    status = 'warn';
    text = `تصویر کوچک است (${faNum(dims.w)} × ${faNum(dims.h)}) — عرض دست‌کم ۱۲۰۰ پیکسل باشد وگرنه در اشتراک‌گذاری تار می‌شود.`;
  } else {
    status = 'warn';
    text = `نسبت تصویر (${faNum(dims.w)} × ${faNum(dims.h)}) استاندارد نیست — در پیش‌نمایش شبکه‌های اجتماعی برش می‌خورد؛ نسبت ۱٫۹۱ به ۱ (مثل ۱۲۰۰ × ۶۳۰) بهتر است.`;
  }

  return (
    <p
      className={cn(
        'flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs leading-5',
        status === 'ok'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
      )}
    >
      {status === 'ok' ? (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      )}
      {text}
    </p>
  );
}

function LengthBar({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = Math.min(100, (value / (max * 1.2)) * 100);
  const ok = value >= min && value <= max;
  return (
    <div className="mt-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn('h-full rounded-full transition-all', ok ? 'bg-emerald-500' : value === 0 ? '' : 'bg-amber-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {faNum(value)} نویسه — مناسب: {faNum(min)} تا {faNum(max)}
      </p>
    </div>
  );
}
