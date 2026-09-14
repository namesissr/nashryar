import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { slugify } from '@/lib/utils';

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const siteId = req.nextUrl.searchParams.get('siteId') || undefined;
    const categories = await prisma.category.findMany({
      where: siteId ? { siteId } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } }, site: { select: { name: true, color: true } } },
    });
    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        siteId: c.siteId,
        name: c.name,
        slug: c.slug,
        articleCount: c._count.articles,
        siteName: c.site.name,
        siteColor: c.site.color,
      })),
    });
  });
}

const createSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1, 'نام دسته را وارد کنید'),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = createSchema.parse(await req.json());
    const slug = slugify(body.name);
    const exists = await prisma.category.findFirst({
      where: { siteId: body.siteId, OR: [{ slug }, { name: body.name }] },
    });
    if (exists) return NextResponse.json({ error: 'این دسته در این سایت وجود دارد.' }, { status: 409 });
    const cat = await prisma.category.create({ data: { siteId: body.siteId, name: body.name, slug } });
    return NextResponse.json({ ok: true, id: cat.id });
  });
}
