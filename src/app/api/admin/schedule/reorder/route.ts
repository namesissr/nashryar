import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

const schema = z.object({
  siteId: z.string().min(1),
  ids: z.array(z.string()).min(1),
});

/** بازچینش صف انتشار خودکار یک سایت */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = schema.parse(await req.json());
    for (let i = 0; i < body.ids.length; i++) {
      await prisma.article.updateMany({
        where: { id: body.ids[i], siteId: body.siteId, status: 'QUEUED' },
        data: { queuePosition: i + 1 },
      });
    }
    return NextResponse.json({ ok: true });
  });
}
