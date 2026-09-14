import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { articleSchema, computeDerived, syncTags, hostOf } from '@/lib/articles';

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const siteId = sp.get('siteId') || undefined;
    const status = sp.get('status') || undefined;
    const q = sp.get('q') || undefined;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const perPage = 20;

    const where = {
      ...(siteId ? { siteId } : {}),
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] } : {}),
    };

    const [total, articles] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          site: { select: { key: true, name: true, color: true, baseUrl: true } },
          category: { select: { name: true } },
          author: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        status: a.status,
        seoScore: a.seoScore,
        wordCount: a.wordCount,
        remoteViews: a.remoteViews,
        publishedAt: a.publishedAt,
        updatedAt: a.updatedAt,
        syncedAt: a.syncedAt,
        syncError: a.syncError,
        remoteSlug: a.remoteSlug,
        site: a.site,
        category: a.category?.name ?? null,
        author: a.author?.name ?? null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / perPage)),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = articleSchema.parse(await req.json());
    const targetSite = await prisma.site.findUnique({ where: { id: body.siteId }, select: { baseUrl: true } });
    const derived = computeDerived(body, targetSite ? hostOf(targetSite.baseUrl) : undefined);

    // اسلاگ تکراری در همان سایت → پسوند عددی
    const base = derived.slug || 'article';
    let slug = base;
    let i = 2;
    while (await prisma.article.findUnique({ where: { siteId_slug: { siteId: body.siteId, slug } } })) {
      slug = `${base}-${i++}`;
    }

    const article = await prisma.article.create({
      data: {
        siteId: body.siteId,
        authorId: user.id,
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
        status: body.status === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT',
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
        wordCount: derived.wordCount,
        readingMinutes: derived.readingMinutes,
        seoScore: derived.seoScore,
      },
    });
    await syncTags(article.id, body.tags);

    return NextResponse.json({ ok: true, id: article.id, slug: article.slug });
  });
}
