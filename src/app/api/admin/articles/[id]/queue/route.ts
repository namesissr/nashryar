import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

/** افزودن مقاله به صف انتشار خودکار سایت خودش */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const article = await prisma.article.findUnique({ where: { id }, select: { siteId: true, status: true } });
    if (!article) return NextResponse.json({ error: 'مقاله یافت نشد.' }, { status: 404 });
    if (article.status === 'PUBLISHED') {
      return NextResponse.json({ error: 'مقاله منتشرشده را نمی‌توان به صف افزود.' }, { status: 409 });
    }
    const last = await prisma.article.aggregate({
      where: { siteId: article.siteId, status: 'QUEUED' },
      _max: { queuePosition: true },
    });
    const position = (last._max.queuePosition ?? 0) + 1;
    await prisma.article.update({
      where: { id },
      data: { status: 'QUEUED', queuePosition: position, publishedAt: null, autoPublished: false },
    });
    await prisma.articleEvent.create({
      data: { articleId: id, kind: 'queued', detail: `به صف انتشار خودکار افزوده شد (جایگاه ${position})` },
    });
    return NextResponse.json({ ok: true, position });
  });
}

/** خروج از صف یا لغو زمان‌بندی — بازگشت به پیش‌نویس */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const article = await prisma.article.findUnique({ where: { id }, select: { status: true } });
    if (!article) return NextResponse.json({ error: 'مقاله یافت نشد.' }, { status: 404 });
    if (article.status !== 'QUEUED' && article.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'مقاله در صف یا زمان‌بندی نیست.' }, { status: 409 });
    }
    await prisma.article.update({
      where: { id },
      data: { status: 'DRAFT', queuePosition: null, publishedAt: null },
    });
    await prisma.articleEvent.create({
      data: { articleId: id, kind: 'unqueued', detail: 'از صف/زمان‌بندی خارج شد و به پیش‌نویس برگشت' },
    });
    return NextResponse.json({ ok: true });
  });
}
