import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { analyzeSeo } from '@/lib/seo';
import { hostOf } from '@/lib/articles';

/**
 * ممیزی سئوی همه مقاله‌های یک سایت:
 * امتیاز تازه هر مقاله + مهم‌ترین مشکلاتش + کلیدواژه‌های تکراری.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const siteId = req.nextUrl.searchParams.get('siteId') || '';
    if (!siteId) return NextResponse.json({ error: 'siteId لازم است.' }, { status: 400 });

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return NextResponse.json({ error: 'سایت یافت نشد.' }, { status: 404 });
    const host = hostOf(site.baseUrl);

    const articles = await prisma.article.findMany({
      where: { siteId, status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        excerpt: true,
        contentMd: true,
        focusKeyword: true,
        seoTitle: true,
        seoDescription: true,
        coverUrl: true,
        coverAlt: true,
        remoteViews: true,
      },
    });

    const rows = articles.map((a) => {
      const r = analyzeSeo({
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt || '',
        contentMd: a.contentMd,
        focusKeyword: a.focusKeyword || '',
        seoTitle: a.seoTitle || '',
        seoDescription: a.seoDescription || '',
        coverUrl: a.coverUrl || '',
        coverAlt: a.coverAlt || '',
        siteHost: host,
      });
      const issues = r.checks
        .filter((c) => c.status !== 'pass')
        .sort((x, y) => (y.status === 'fail' ? y.weight + 10 : y.weight) - (x.status === 'fail' ? x.weight + 10 : x.weight))
        .slice(0, 3)
        .map((c) => ({ label: c.label, status: c.status }));
      return {
        id: a.id,
        title: a.title,
        status: a.status,
        score: r.score,
        readability: r.readability,
        wordCount: r.wordCount,
        views: a.remoteViews,
        focusKeyword: a.focusKeyword?.trim() || null,
        issues,
      };
    });

    // کلیدواژه‌های تکراری
    const byKeyword = new Map<string, { keyword: string; articles: { id: string; title: string }[] }>();
    for (const a of articles) {
      const k = (a.focusKeyword || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim();
      if (!k) continue;
      const entry = byKeyword.get(k) || { keyword: a.focusKeyword!.trim(), articles: [] };
      entry.articles.push({ id: a.id, title: a.title });
      byKeyword.set(k, entry);
    }
    const duplicateKeywords = [...byKeyword.values()].filter((e) => e.articles.length > 1);

    const summary = {
      total: rows.length,
      avgScore: rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0,
      avgReadability: rows.length ? Math.round(rows.reduce((s, r) => s + r.readability, 0) / rows.length) : 0,
      weak: rows.filter((r) => r.score < 50).length,
      noKeyword: rows.filter((r) => !r.focusKeyword).length,
      duplicateKeywordCount: duplicateKeywords.length,
    };

    return NextResponse.json({
      site: { id: site.id, key: site.key, name: site.name, color: site.color },
      summary,
      // ضعیف‌ترها اول تا اولویت رسیدگی مشخص باشد
      articles: rows.sort((a, b) => a.score - b.score),
      duplicateKeywords,
    });
  });
}
