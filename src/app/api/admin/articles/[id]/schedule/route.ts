import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { faDateTime } from '@/lib/utils';

const schema = z.object({
  publishedAt: z.string().min(1, 'زمان انتشار را تعیین کنید'),
});

/** زمان‌بندی انتشار مقاله برای تاریخ و ساعت مشخص */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const body = schema.parse(await req.json());
    const when = new Date(body.publishedAt);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'تاریخ نامعتبر است.' }, { status: 400 });
    }
    if (when.getTime() < Date.now() - 60000) {
      return NextResponse.json({ error: 'زمان انتشار باید در آینده باشد.' }, { status: 400 });
    }
    const article = await prisma.article.findUnique({
      where: { id },
      select: { status: true, site: { select: { hubSecret: true, name: true } } },
    });
    if (!article) return NextResponse.json({ error: 'مقاله یافت نشد.' }, { status: 404 });
    if (article.status === 'PUBLISHED') {
      return NextResponse.json({ error: 'مقاله منتشرشده نیازی به زمان‌بندی ندارد.' }, { status: 409 });
    }
    if (!article.site.hubSecret) {
      return NextResponse.json(
        { error: `اتصال ${article.site.name} پیکربندی نشده؛ زمان‌بندی بدون اتصال منتشر نخواهد شد.` },
        { status: 409 }
      );
    }
    await prisma.article.update({
      where: { id },
      data: { status: 'SCHEDULED', publishedAt: when, queuePosition: null, autoPublished: false },
    });
    await prisma.articleEvent.create({
      data: { articleId: id, kind: 'scheduled', detail: `زمان‌بندی شد برای ${faDateTime(when)}` },
    });
    return NextResponse.json({ ok: true });
  });
}
