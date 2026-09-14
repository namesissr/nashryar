import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

/** آیا کلیدواژه کانونی در مقاله دیگری از همان سایت استفاده شده؟ (Keyword Cannibalization) */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const siteId = sp.get('siteId') || '';
    const keyword = (sp.get('keyword') || '').trim();
    const excludeId = sp.get('excludeId') || undefined;
    if (!siteId || !keyword) return NextResponse.json({ duplicates: [] });

    const normalized = keyword.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').toLowerCase();
    const articles = await prisma.article.findMany({
      where: { siteId, focusKeyword: { not: null }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, title: true, focusKeyword: true },
    });
    const duplicates = articles
      .filter(
        (a) => (a.focusKeyword || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').toLowerCase().trim() === normalized
      )
      .map((a) => ({ id: a.id, title: a.title }));
    return NextResponse.json({ duplicates });
  });
}
