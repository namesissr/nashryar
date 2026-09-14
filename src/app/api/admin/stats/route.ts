import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

export async function GET() {
  return handle(async () => {
    await requireUser();

    const [sites, byStatus, topArticles, recentEvents, viewRows] = await Promise.all([
      prisma.site.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { articles: true } } },
      }),
      prisma.article.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.article.findMany({
        where: { remoteViews: { gt: 0 } },
        orderBy: { remoteViews: 'desc' },
        take: 10,
        include: { site: { select: { name: true, color: true, key: true } } },
      }),
      prisma.articleEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { article: { select: { title: true, site: { select: { name: true, color: true } } } } },
      }),
      prisma.dailyView.findMany({
        where: { date: { gte: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) } },
        include: { article: { select: { siteId: true } } },
      }),
    ]);

    // نمای ۳۰ روزه: مجموع بازدید هر روز به تفکیک سایت
    const days: Record<string, Record<string, number>> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days[d] = {};
    }
    for (const row of viewRows) {
      if (!days[row.date]) continue;
      const sid = row.article.siteId;
      days[row.date][sid] = (days[row.date][sid] || 0) + row.count;
    }
    const series = Object.entries(days).map(([date, per]) => ({
      date,
      total: Object.values(per).reduce((a, b) => a + b, 0),
      ...Object.fromEntries(sites.map((s) => [s.key, per[s.id] || 0])),
    }));

    const perSiteArticles = await prisma.article.groupBy({
      by: ['siteId', 'status'],
      _count: { _all: true },
      _sum: { remoteViews: true },
    });

    return NextResponse.json({
      sites: sites.map((s) => {
        const rows = perSiteArticles.filter((r) => r.siteId === s.id);
        return {
          id: s.id,
          key: s.key,
          name: s.name,
          color: s.color,
          enabled: s.enabled,
          hasSecret: s.hubSecret.length > 0,
          total: s._count.articles,
          published: rows.filter((r) => r.status === 'PUBLISHED').reduce((a, r) => a + r._count._all, 0),
          drafts: rows.filter((r) => r.status === 'DRAFT').reduce((a, r) => a + r._count._all, 0),
          views: rows.reduce((a, r) => a + (r._sum.remoteViews || 0), 0),
        };
      }),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      topArticles: topArticles.map((a) => ({
        id: a.id,
        title: a.title,
        views: a.remoteViews,
        seoScore: a.seoScore,
        site: a.site,
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        kind: e.kind,
        detail: e.detail,
        createdAt: e.createdAt,
        articleTitle: e.article.title,
        siteName: e.article.site.name,
        siteColor: e.article.site.color,
      })),
      series,
    });
  });
}
