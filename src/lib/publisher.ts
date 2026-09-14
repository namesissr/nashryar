import 'server-only';
import prisma from './prisma';
import { env } from './env';
import { renderMarkdown } from './markdown';

/**
 * ماژول انتشار — قرارداد یکسان «درگاه دریافت هاب» که در هر چهار سایت پیاده شده:
 *   POST   {apiUrl}/api/hub/blog          ← درج/به‌روزرسانی با هدر X-Hub-Secret
 *   DELETE {apiUrl}/api/hub/blog/{slug}   ← حذف
 *   GET    {apiUrl}/api/hub/blog/stats    ← آمار بازدید
 */

type ArticleWithRelations = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentMd: string;
  coverUrl: string | null;
  coverAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  status: string;
  publishedAt: Date | null;
  remoteSlug: string | null;
  site: { id: string; key: string; apiUrl: string; hubSecret: string; baseUrl: string };
  category: { name: string } | null;
  tags: { tag: { name: string } }[];
  author: { name: string } | null;
};

/** آدرس‌های نسبی آپلود هاب را مطلق می‌کند تا روی سایت مقصد هم نمایش داده شوند */
function absolutize(text: string): string {
  return text.replace(/(\]\(|src=")(\/uploads\/)/g, `$1${env.appUrl}$2`);
}

function absolutizeUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${env.appUrl}${url}` : url;
}

function buildPayload(article: ArticleWithRelations, isPublished: boolean) {
  const md = absolutize(article.contentMd);
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    contentMd: md,
    contentHtml: renderMarkdown(md),
    coverUrl: absolutizeUrl(article.coverUrl),
    coverAlt: article.coverAlt,
    category: article.category?.name ?? null,
    tags: article.tags.map((t) => t.tag.name),
    metaTitle: article.seoTitle,
    metaDescription: article.seoDescription || article.excerpt,
    canonical: article.canonicalUrl,
    authorName: article.author?.name ?? null,
    isPublished,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    noindex: article.noindex,
  };
}

async function hubFetch(site: { apiUrl: string; hubSecret: string }, path: string, init: RequestInit = {}) {
  const url = `${site.apiUrl.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Secret': site.hubSecret,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // پاسخ غیر JSON
  }
  return { res, body };
}

/** علت واقعی خطای شبکه را از undici بیرون می‌کشد (ENOTFOUND، ETIMEDOUT، خطای گواهی و…) */
export function describeNetError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return 'مهلت اتصال به سایت مقصد تمام شد (Timeout)';
    }
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    const detail = cause?.code || cause?.message || err.message || 'خطای ناشناخته';
    return `اتصال به سایت مقصد برقرار نشد (${detail})`;
  }
  return 'اتصال به سایت مقصد برقرار نشد';
}

/** خطای قابل نمایش از پاسخ سایت مقصد می‌سازد */
function errorMessage(status: number, body: unknown): string {
  const b = body as { error?: { message?: string } | string; detail?: string; message?: string } | null;
  const inner =
    (typeof b?.error === 'object' ? b?.error?.message : typeof b?.error === 'string' ? b.error : null) ||
    b?.detail ||
    b?.message;
  return `کد ${status}${inner ? ` — ${inner}` : ''}`;
}

export async function publishArticle(articleId: string, opts: { unpublish?: boolean } = {}) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      site: true,
      category: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
      author: { select: { name: true } },
    },
  });
  if (!article) throw new Error('مقاله یافت نشد.');

  const isPublished = !opts.unpublish;
  const payload = buildPayload(article as unknown as ArticleWithRelations, isPublished);

  try {
    const { res, body } = await hubFetch(article.site, '/api/hub/blog', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = errorMessage(res.status, body);
      await prisma.article.update({ where: { id: articleId }, data: { syncError: msg } });
      await prisma.articleEvent.create({
        data: { articleId, kind: 'error', detail: `انتشار ناموفق: ${msg}` },
      });
      return { ok: false as const, error: msg };
    }

    const data = body as { data?: { slug?: string }; slug?: string };
    const remoteSlug = data?.data?.slug || data?.slug || article.slug;

    await prisma.article.update({
      where: { id: articleId },
      data: {
        syncedAt: new Date(),
        syncError: null,
        remoteSlug,
        ...(isPublished
          ? { status: 'PUBLISHED', publishedAt: article.publishedAt ?? new Date(), queuePosition: null }
          : { status: 'ARCHIVED' }),
      },
    });
    await prisma.articleEvent.create({
      data: {
        articleId,
        kind: isPublished ? (article.syncedAt ? 'updated' : 'published') : 'unpublished',
        detail: isPublished ? `منتشر شد روی ${article.site.name} با اسلاگ ${remoteSlug}` : 'از سایت برداشته شد',
      },
    });
    return { ok: true as const, remoteSlug };
  } catch (err) {
    const msg = describeNetError(err);
    await prisma.article.update({ where: { id: articleId }, data: { syncError: msg } });
    await prisma.articleEvent.create({ data: { articleId, kind: 'error', detail: msg } });
    return { ok: false as const, error: msg };
  }
}

export async function deleteRemote(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { site: true },
  });
  if (!article || !article.syncedAt) return { ok: true as const };
  const slug = article.remoteSlug || article.slug;
  try {
    const { res, body } = await hubFetch(article.site, `/api/hub/blog/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      return { ok: false as const, error: errorMessage(res.status, body) };
    }
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: describeNetError(err) };
  }
}

/** همگام‌سازی آمار بازدید از یک سایت؛ بازدید روزانه = اختلاف با شمارش قبلی */
export async function syncSiteStats(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error('سایت یافت نشد.');

  const { res, body } = await hubFetch(site, '/api/hub/blog/stats', { method: 'GET' });
  if (!res.ok) return { ok: false as const, error: errorMessage(res.status, body) };

  const parsed = body as { posts?: { slug: string; views: number }[]; data?: { posts?: { slug: string; views: number }[] } };
  const posts = parsed?.posts || parsed?.data?.posts || [];
  const bySlug = new Map(posts.map((p) => [p.slug, Number(p.views) || 0]));

  const articles = await prisma.article.findMany({
    where: { siteId, syncedAt: { not: null } },
    select: { id: true, slug: true, remoteSlug: true, remoteViews: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  let updated = 0;
  for (const a of articles) {
    const views = bySlug.get(a.remoteSlug || a.slug);
    if (views === undefined) continue;
    const delta = Math.max(0, views - a.remoteViews);
    await prisma.article.update({ where: { id: a.id }, data: { remoteViews: views } });
    if (delta > 0) {
      await prisma.dailyView.upsert({
        where: { articleId_date: { articleId: a.id, date: today } },
        create: { articleId: a.id, date: today, count: delta },
        update: { count: { increment: delta } },
      });
    }
    updated++;
  }
  return { ok: true as const, updated, total: posts.length };
}

/** اعمال تنظیمات وبلاگ ذخیره‌شده روی سایت مقصد */
export async function pushBlogConfig(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error('سایت یافت نشد.');
  let config: unknown = {};
  try {
    config = JSON.parse(site.blogConfig || '{}');
  } catch {
    config = {};
  }
  try {
    const { res, body } = await hubFetch(site, '/api/hub/blog/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    if (!res.ok) return { ok: false as const, error: errorMessage(res.status, body) };
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: describeNetError(err) };
  }
}

/** خواندن تنظیمات وبلاگ فعلی از خود سایت مقصد */
export async function fetchRemoteBlogConfig(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error('سایت یافت نشد.');
  try {
    const { res, body } = await hubFetch(site, '/api/hub/blog/config', { method: 'GET' });
    if (!res.ok) return { ok: false as const, error: errorMessage(res.status, body) };
    const parsed = body as { config?: unknown; data?: { config?: unknown } };
    return { ok: true as const, config: parsed?.config ?? parsed?.data?.config ?? {} };
  } catch (err) {
    return { ok: false as const, error: describeNetError(err) };
  }
}

/** آزمایش اتصال به یک سایت — بدون تغییر داده */
export async function testSiteConnection(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error('سایت یافت نشد.');
  try {
    const { res, body } = await hubFetch(site, '/api/hub/blog/stats', { method: 'GET' });
    if (res.ok) {
      const parsed = body as { posts?: unknown[]; data?: { posts?: unknown[] } };
      const count = (parsed?.posts || parsed?.data?.posts || []).length;
      return { ok: true as const, message: `اتصال برقرار است — ${count} مطلب روی سایت` };
    }
    if (res.status === 401) return { ok: false as const, error: 'کلید محرمانه اشتباه است (401)' };
    if (res.status === 503) return { ok: false as const, error: 'HUB_SECRET روی سایت مقصد تنظیم نشده است (503)' };
    return { ok: false as const, error: errorMessage(res.status, body) };
  } catch (err) {
    return { ok: false as const, error: describeNetError(err) };
  }
}
