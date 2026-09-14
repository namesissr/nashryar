import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

const schema = z.object({
  name: z.string().min(1, 'نام سایت را وارد کنید').optional(),
  tagline: z.string().nullish(),
  baseUrl: z.string().url('آدرس سایت معتبر نیست').optional(),
  apiUrl: z.string().url('آدرس API معتبر نیست').optional(),
  hubSecret: z.string().optional(), // خالی یعنی دست‌نخورده
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'رنگ باید کد hex باشد')
    .optional(),
  enabled: z.boolean().optional(),
  contentKind: z.enum(['html', 'markdown']).optional(),
  // برنامه انتشار خودکار
  autoPublishEnabled: z.boolean().optional(),
  autoPerDay: z.number().int().min(1, 'حداقل ۱ مقاله در روز').max(24, 'حداکثر ۲۴ مقاله در روز').optional(),
  autoWindowStart: z.string().regex(/^\d{1,2}:\d{2}$/, 'ساعت مثل 09:00 باشد').optional(),
  autoWindowEnd: z.string().regex(/^\d{1,2}:\d{2}$/, 'ساعت مثل 21:00 باشد').optional(),
  autoDays: z.string().regex(/^\d(,\d)*$/, 'روزهای هفته نامعتبر').optional(),
  autoMode: z.enum(['spread', 'times']).optional(),
  autoTimes: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = schema.parse(await req.json());
    const { hubSecret, ...rest } = body;
    await prisma.site.update({
      where: { id },
      data: {
        ...rest,
        ...(hubSecret !== undefined && hubSecret !== '' ? { hubSecret } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  });
}
