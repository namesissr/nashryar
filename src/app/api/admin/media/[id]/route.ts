import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return NextResponse.json({ error: 'فایل یافت نشد.' }, { status: 404 });
    await prisma.media.delete({ where: { id } });
    await unlink(path.join(process.cwd(), 'public', 'uploads', media.fileName)).catch(() => null);
    return NextResponse.json({ ok: true });
  });
}
