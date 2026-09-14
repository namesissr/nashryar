import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

const updateSchema = z.object({
  name: z.string().min(2, 'نام دست‌کم ۲ نویسه باشد').optional(),
  role: z.enum(['ADMIN', 'WRITER']).optional(),
  password: z.string().min(8, 'رمز عبور دست‌کم ۸ نویسه باشد').optional(),
});

/** آخرین مدیر نباید بی‌مدیر شود */
async function wouldRemoveLastAdmin(userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role !== 'ADMIN') return false;
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  return adminCount <= 1;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    if (body.role === 'WRITER') {
      if (id === me.id) {
        return NextResponse.json({ error: 'نمی‌توانید نقش خودتان را پایین بیاورید.' }, { status: 409 });
      }
      if (await wouldRemoveLastAdmin(id)) {
        return NextResponse.json({ error: 'این کاربر آخرین مدیر است.' }, { status: 409 });
      }
    }

    await prisma.user.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.password ? { passwordHash: await bcrypt.hash(body.password, 12) } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireAdmin();
    const { id } = await params;
    if (id === me.id) {
      return NextResponse.json({ error: 'نمی‌توانید حساب خودتان را حذف کنید.' }, { status: 409 });
    }
    if (await wouldRemoveLastAdmin(id)) {
      return NextResponse.json({ error: 'این کاربر آخرین مدیر است و قابل حذف نیست.' }, { status: 409 });
    }
    // مقاله‌های کاربر می‌مانند (authorId → null طبق onDelete: SetNull)
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
