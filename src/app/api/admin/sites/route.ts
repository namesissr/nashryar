import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

export async function GET() {
  return handle(async () => {
    await requireUser();
    const sites = await prisma.site.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { articles: true, categories: true } } },
    });
    // کلید محرمانه را کامل برنمی‌گردانیم؛ فقط وضعیت تنظیم بودنش
    return NextResponse.json({
      sites: sites.map((s) => ({
        id: s.id,
        key: s.key,
        name: s.name,
        tagline: s.tagline,
        baseUrl: s.baseUrl,
        apiUrl: s.apiUrl,
        color: s.color,
        enabled: s.enabled,
        contentKind: s.contentKind,
        hasSecret: s.hubSecret.length > 0,
        articleCount: s._count.articles,
        categoryCount: s._count.categories,
      })),
    });
  });
}
