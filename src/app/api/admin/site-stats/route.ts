import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

/**
 * آمار جامع هر سایت — مستقل از بازه گزارش:
 * کل مطالب و بازدیدها، منتشرشده در ماه جاری (شمسی) و هفته اخیر،
 * پربازدیدترین مقاله، محبوب‌ترین مقاله ماه، بهترین امتیاز سئو و…
 */

/** اولین روز ماه جاری شمسی به صورت YYYY-MM-DD میلادی (هم‌خوان با فرمت DailyView) */
function jalaliMonthStart(): { iso: string; date: Date } {
  const now = new Date();
  const day = Number(new Intl.DateTimeFormat('en-US-u-ca-persian', { day: 'numeric' }).format(now));
  const start = new Date(now.getTime() - (day - 1) * 86400000);
  const iso = start.toISOString().slice(0, 10);
  return { iso, date: new Date(`${iso}T00:00:00`) };
}

const ARTICLE_LITE = { id: true, title: true, remoteViews: true, seoScore: true, publishedAt: true } as const;

export async function GET() {
  return handle(async () => {
    await requireUser();

    const monthStart = jalaliMonthStart();
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const iso30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const monthLabel = new Intl.DateTimeFormat('fa-IR', { month: 'long' }).format(new Date());

    const sites = await prisma.site.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, key: true, name: true, color: true, baseUrl: true, hubSecret: true },
    });

    const result = [];
    for (const s of sites) {
      const [byStatus, viewSum, publishedThisMonth, publishedThisWeek, topByViews, bestSeo, lastPublished] =
        await Promise.all([
          prisma.article.groupBy({ by: ['status'], where: { siteId: s.id }, _count: { _all: true } }),
          prisma.article.aggregate({ where: { siteId: s.id }, _sum: { remoteViews: true } }),
          prisma.article.count({
            where: { siteId: s.id, status: 'PUBLISHED', publishedAt: { gte: monthStart.date } },
          }),
          prisma.article.count({ where: { siteId: s.id, status: 'PUBLISHED', publishedAt: { gte: weekAgo } } }),
          prisma.article.findFirst({
            where: { siteId: s.id, status: 'PUBLISHED', remoteViews: { gt: 0 } },
            orderBy: { remoteViews: 'desc' },
            select: ARTICLE_LITE,
          }),
          prisma.article.findFirst({
            where: { siteId: s.id, status: 'PUBLISHED' },
            orderBy: { seoScore: 'desc' },
            select: ARTICLE_LITE,
          }),
          prisma.article.findFirst({
            where: { siteId: s.id, status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
            select: ARTICLE_LITE,
          }),
        ]);

      // بازدید ۳۰ روز اخیر و ماه جاری از دفتر بازدید روزانه
      const [views30Rows, viewsMonthRows] = await Promise.all([
        prisma.dailyView.findMany({
          where: { date: { gte: iso30 }, article: { siteId: s.id } },
          select: { count: true },
        }),
        prisma.dailyView.findMany({
          where: { date: { gte: monthStart.iso }, article: { siteId: s.id } },
          select: { count: true, articleId: true },
        }),
      ]);
      const views30 = views30Rows.reduce((a, r) => a + r.count, 0);
      const viewsThisMonth = viewsMonthRows.reduce((a, r) => a + r.count, 0);

      // محبوب‌ترین مقاله ماه = بیشترین بازدید ثبت‌شده در ماه جاری
      const monthByArticle = new Map<string, number>();
      for (const r of viewsMonthRows) {
        monthByArticle.set(r.articleId, (monthByArticle.get(r.articleId) || 0) + r.count);
      }
      const topMonthEntry = [...monthByArticle.entries()].sort((a, b) => b[1] - a[1])[0];
      const topThisMonth = topMonthEntry
        ? {
            ...(await prisma.article.findUnique({ where: { id: topMonthEntry[0] }, select: ARTICLE_LITE })),
            monthViews: topMonthEntry[1],
          }
        : null;

      const count = (st: string) => byStatus.find((r) => r.status === st)?._count._all || 0;
      const published = count('PUBLISHED');
      const totalViews = viewSum._sum.remoteViews || 0;

      result.push({
        id: s.id,
        key: s.key,
        name: s.name,
        color: s.color,
        baseUrl: s.baseUrl,
        hasSecret: s.hubSecret.length > 0,
        totalArticles: byStatus.reduce((a, r) => a + r._count._all, 0),
        published,
        drafts: count('DRAFT'),
        queued: count('QUEUED'),
        scheduled: count('SCHEDULED'),
        totalViews,
        views30,
        viewsThisMonth,
        publishedThisMonth,
        publishedThisWeek,
        avgViewsPerArticle: published > 0 ? Math.round(totalViews / published) : 0,
        topByViews,
        topThisMonth: topThisMonth && topThisMonth.id ? topThisMonth : null,
        bestSeo,
        lastPublished,
      });
    }

    return NextResponse.json({ monthLabel, sites: result });
  });
}
