import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

/**
 * گزارش بازه‌ای (روزانه/هفتگی/ماهانه/دلخواه) — کل سایت‌ها یا یک سایت.
 * پارامترها: from=YYYY-MM-DD  to=YYYY-MM-DD  siteId=(اختیاری)
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const siteId = sp.get('siteId') || undefined;

    const today = new Date().toISOString().slice(0, 10);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('from') || '') ? sp.get('from')! : today;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('to') || '') ? sp.get('to')! : today;
    if (from > to) return NextResponse.json({ error: 'تاریخ شروع بعد از پایان است.' }, { status: 400 });

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59.999`);
    // حداکثر ۳۷۰ روز
    if (toDate.getTime() - fromDate.getTime() > 370 * 86400000) {
      return NextResponse.json({ error: 'بازه گزارش حداکثر یک سال است.' }, { status: 400 });
    }

    const sites = await prisma.site.findMany({
      where: siteId ? { id: siteId } : {},
      orderBy: { sortOrder: 'asc' },
      select: { id: true, key: true, name: true, color: true },
    });
    if (sites.length === 0) return NextResponse.json({ error: 'سایت یافت نشد.' }, { status: 404 });
    const siteIds = sites.map((s) => s.id);

    // بازدیدهای روزانه در بازه
    const viewRows = await prisma.dailyView.findMany({
      where: { date: { gte: from, lte: to }, article: { siteId: { in: siteIds } } },
      include: { article: { select: { id: true, siteId: true } } },
    });

    // سری روزانه — مستقیم روی رشته تاریخ، تا تبدیل منطقه زمانی روزها را جابه‌جا نکند
    const addDay = (s: string) => {
      const d = new Date(`${s}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    const days: string[] = [];
    for (let d = from; d <= to && days.length <= 371; d = addDay(d)) {
      days.push(d);
    }
    const perDay = new Map<string, Record<string, number>>(days.map((d) => [d, {}]));
    const perArticle = new Map<string, number>();
    const perSiteViews = new Map<string, number>();
    for (const row of viewRows) {
      const day = perDay.get(row.date);
      if (!day) continue;
      const sid = row.article.siteId;
      day[sid] = (day[sid] || 0) + row.count;
      perArticle.set(row.article.id, (perArticle.get(row.article.id) || 0) + row.count);
      perSiteViews.set(sid, (perSiteViews.get(sid) || 0) + row.count);
    }
    const series = days.map((date) => {
      const d = perDay.get(date)!;
      return {
        date,
        total: Object.values(d).reduce((a, b) => a + b, 0),
        ...Object.fromEntries(sites.map((s) => [s.key, d[s.id] || 0])),
      };
    });

    // مقاله‌های منتشرشده در بازه
    const publishedInRange = await prisma.article.findMany({
      where: {
        siteId: { in: siteIds },
        status: 'PUBLISHED',
        publishedAt: { gte: fromDate, lte: toDate },
      },
      select: { id: true, siteId: true, seoScore: true, autoPublished: true },
    });

    // پربازدیدهای بازه
    const topIds = [...perArticle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topArticlesRaw = topIds.length
      ? await prisma.article.findMany({
          where: { id: { in: topIds.map(([id]) => id) } },
          select: {
            id: true,
            title: true,
            seoScore: true,
            remoteViews: true,
            site: { select: { name: true, color: true } },
          },
        })
      : [];
    const topArticles = topIds.map(([id, rangeViews]) => {
      const a = topArticlesRaw.find((x) => x.id === id)!;
      return { ...a, rangeViews };
    });

    // ردیف‌های هر سایت
    const perSite = sites.map((s) => {
      const pubs = publishedInRange.filter((p) => p.siteId === s.id);
      return {
        ...s,
        views: perSiteViews.get(s.id) || 0,
        published: pubs.length,
        autoPublished: pubs.filter((p) => p.autoPublished).length,
        avgSeo: pubs.length ? Math.round(pubs.reduce((sum, p) => sum + p.seoScore, 0) / pubs.length) : 0,
      };
    });

    const totalViews = [...perSiteViews.values()].reduce((a, b) => a + b, 0);
    return NextResponse.json({
      from,
      to,
      sites,
      series,
      perSite,
      topArticles,
      summary: {
        totalViews,
        published: publishedInRange.length,
        autoPublished: publishedInRange.filter((p) => p.autoPublished).length,
        avgSeo: publishedInRange.length
          ? Math.round(publishedInRange.reduce((s, p) => s + p.seoScore, 0) / publishedInRange.length)
          : 0,
        bestDay: series.reduce((best, r) => (r.total > best.total ? r : best), { date: from, total: 0 }),
      },
    });
  });
}
