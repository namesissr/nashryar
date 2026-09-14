import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { runSiteSeoReport } from '@/lib/site-seo';

/** آخرین گزارش ذخیره‌شده */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true, name: true, color: true, baseUrl: true, lastSeoReport: true, lastSeoReportAt: true },
    });
    if (!site) return NextResponse.json({ error: 'سایت یافت نشد.' }, { status: 404 });
    let report: unknown = null;
    try {
      const parsed = JSON.parse(site.lastSeoReport || '{}');
      report = parsed && Object.keys(parsed).length ? parsed : null;
    } catch {
      report = null;
    }
    return NextResponse.json({
      site: { id: site.id, name: site.name, color: site.color, baseUrl: site.baseUrl },
      report,
      checkedAt: site.lastSeoReportAt,
    });
  });
}

/** اجرای بررسی تازه روی خود سایت */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const site = await prisma.site.findUnique({ where: { id }, select: { id: true, baseUrl: true } });
    if (!site) return NextResponse.json({ error: 'سایت یافت نشد.' }, { status: 404 });

    // تازه‌ترین مقاله منتشرشده به عنوان نمونه بررسی صفحه
    const sample = await prisma.article.findFirst({
      where: { siteId: id, status: 'PUBLISHED', syncedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { slug: true, remoteSlug: true },
    });

    const report = await runSiteSeoReport(site.baseUrl, sample?.remoteSlug || sample?.slug || null);
    await prisma.site.update({
      where: { id },
      data: { lastSeoReport: JSON.stringify(report), lastSeoReportAt: new Date() },
    });
    return NextResponse.json({ ok: true, report });
  });
}
