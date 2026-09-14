import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        articleCount: u._count.articles,
      })),
    });
  });
}

const createSchema = z.object({
  name: z.string().min(2, 'نام دست‌کم ۲ نویسه باشد'),
  email: z.string().email('ایمیل معتبر وارد کنید'),
  password: z.string().min(8, 'رمز عبور دست‌کم ۸ نویسه باشد'),
  role: z.enum(['ADMIN', 'WRITER']),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body = createSchema.parse(await req.json());
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: 'این ایمیل قبلاً ثبت شده است.' }, { status: 409 });
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 12),
      },
    });
    return NextResponse.json({ ok: true, id: user.id });
  });
}
