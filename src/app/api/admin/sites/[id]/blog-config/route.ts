import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { pushBlogConfig, fetchRemoteBlogConfig } from '@/lib/publisher';

const configSchema = z.object({
  blogTitle: z.string().max(120).nullish(),
  blogDescription: z.string().max(300).nullish(),
  postsPerPage: z.number().int().min(1).max(50).nullish(),
  menu: z
    .array(z.object({ label: z.string().min(1, 'عنوان لینک خالی است').max(40), url: z.string().min(1, 'آدرس لینک خالی است').max(300) }))
    .max(10, 'حداکثر ۱۰ لینک منو')
    .default([]),
  categoriesOrder: z.array(z.string()).max(50).default([]),
  showAuthor: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showViews: z.boolean().default(true),
});

/** تنظیمات ذخیره‌شده در هاب + دسته‌های سایت برای مرتب‌سازی */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const site = await prisma.site.findUnique({
      where: { id },
      include: { categories: { orderBy: { name: 'asc' }, select: { name: true } } },
    });
    if (!site) return NextResponse.json({ error: 'سایت یافت نشد.' }, { status: 404 });
    let config: unknown = {};
    try {
      config = JSON.parse(site.blogConfig || '{}');
    } catch {}
    return NextResponse.json({
      config,
      categories: site.categories.map((c) => c.name),
      site: { id: site.id, key: site.key, name: site.name, color: site.color, hasSecret: site.hubSecret.length > 0 },
    });
  });
}

/** ذخیره تنظیمات در هاب (بدون اعمال روی سایت) */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const body = configSchema.parse(await req.json());
    await prisma.site.update({ where: { id }, data: { blogConfig: JSON.stringify(body) } });
    return NextResponse.json({ ok: true });
  });
}

/** اعمال تنظیمات ذخیره‌شده روی سایت مقصد؛ با ?read=1 تنظیمات فعلی خود سایت را می‌خواند */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    if (req.nextUrl.searchParams.get('read') === '1') {
      const result = await fetchRemoteBlogConfig(id);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }
    const result = await pushBlogConfig(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  });
}
