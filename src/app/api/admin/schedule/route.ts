import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { todaysPlan } from '@/lib/scheduler';

/** نمای کامل زمان‌بندی: برنامه هر سایت + صف + مقاله‌های زمان‌بندی‌شده */
export async function GET() {
  return handle(async () => {
    await requireUser();

    const sites = await prisma.site.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        articles: {
          where: { status: { in: ['QUEUED', 'SCHEDULED'] } },
          orderBy: [{ queuePosition: 'asc' }, { publishedAt: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            status: true,
            queuePosition: true,
            publishedAt: true,
            seoScore: true,
            syncError: true,
          },
        },
      },
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = [];
    for (const s of sites) {
      const publishedToday = await prisma.article.count({
        where: { siteId: s.id, autoPublished: true, publishedAt: { gte: startOfDay } },
      });
      result.push({
        id: s.id,
        key: s.key,
        name: s.name,
        color: s.color,
        hasSecret: s.hubSecret.length > 0,
        autoPublishEnabled: s.autoPublishEnabled,
        autoPerDay: s.autoPerDay,
        autoWindowStart: s.autoWindowStart,
        autoWindowEnd: s.autoWindowEnd,
        autoDays: s.autoDays,
        autoMode: s.autoMode,
        autoTimes: s.autoTimes,
        todaySlots: todaysPlan(s),
        publishedToday,
        queue: s.articles.filter((a) => a.status === 'QUEUED'),
        scheduled: s.articles.filter((a) => a.status === 'SCHEDULED'),
      });
    }

    return NextResponse.json({ sites: result, serverTime: new Date().toISOString() });
  });
}
