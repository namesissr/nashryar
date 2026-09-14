import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { articleSchema, computeDerived, syncTags, hostOf } from '@/lib/articles';
import { deleteRemote } from '@/lib/publisher';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const a = await prisma.article.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, key: true, name: true, color: true, baseUrl: true } },
        category: { select: { id: true, name: true } },
        tags: { include: { tag: { select: { name: true } } } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!a) return NextResponse.json({ error: 'مقاله یافت نشد.' }, { status: 404 });
    return NextResponse.json({
      article: {
        id: a.id,
        siteId: a.siteId,
        site: a.site,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        contentMd: a.contentMd,
        coverUrl: a.coverUrl,
        coverAlt: a.coverAlt,
        categoryId: a.categoryId,
        tags: a.tags.map((t) => t.tag.name),
        focusKeyword: a.focusKeyword,
        seoTitle: a.seoTitle,
        seoDescription: a.seoDescription,
        canonicalUrl: a.canonicalUrl,
        noindex: a.noindex,
        status: a.status,
        publishedAt: a.publishedAt,
        queuePosition: a.queuePosition,
        syncedAt: a.syncedAt,
        syncError: a.syncError,
        remoteSlug: a.remoteSlug,
        remoteViews: a.remoteViews,
        seoScore: a.seoScore,
        wordCount: a.wordCount,
        events: a.events,
      },
    });
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'مقاله یافت نشد.' }, { status: 404 });

    const body = articleSchema.parse(await req.json());
    const targetSite = await prisma.site.findUnique({ where: { id: body.siteId }, select: { baseUrl: true } });
    const derived = computeDerived(body, targetSite ? hostOf(targetSite.baseUrl) : undefined);

    // اگر اسلاگ عوض شده، یکتا بودن در سایت مقصد را بررسی کن
    const base = derived.slug || 'article';
    let slug = base;
    if (slug !== existing.slug || body.siteId !== existing.siteId) {
      let i = 2;
      while (true) {
        const clash = await prisma.article.findUnique({
          where: { siteId_slug: { siteId: body.siteId, slug } },
        });
        if (!clash || clash.id === id) break;
        slug = `${base}-${i++}`;
      }
    }

    await prisma.article.update({
      where: { id },
      data: {
        siteId: body.siteId,
        categoryId: body.categoryId || null,
        title: body.title,
        slug,
        excerpt: body.excerpt || null,
        contentMd: body.contentMd,
        coverUrl: body.coverUrl || null,
        coverAlt: body.coverAlt || null,
        focusKeyword: body.focusKeyword || null,
        seoTitle: body.seoTitle || null,
        seoDescription: body.seoDescription || null,
        canonicalUrl: body.canonicalUrl || null,
        noindex: body.noindex,
        ...(body.status ? { status: body.status } : {}),
        ...(body.publishedAt !== undefined
          ? { publishedAt: body.publishedAt ? new Date(body.publishedAt) : existing.publishedAt }
          : {}),
        wordCount: derived.wordCount,
        readingMinutes: derived.readingMinutes,
        seoScore: derived.seoScore,
      },
    });
    await syncTags(id, body.tags);

    return NextResponse.json({ ok: true, slug });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'مقاله یافت نشد.' }, { status: 404 });

    // اول از سایت مقصد حذف کن (اگر منتشر شده بود)
    const remote = await deleteRemote(id);
    if (!remote.ok) {
      return NextResponse.json(
        { error: `حذف از سایت مقصد ناموفق بود: ${remote.error} — مقاله در هاب نگه داشته شد.` },
        { status: 502 }
      );
    }
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
