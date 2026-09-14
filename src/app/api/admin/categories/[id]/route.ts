import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const count = await prisma.article.count({ where: { categoryId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: `این دسته ${count} مقاله دارد؛ ابتدا دسته مقاله‌ها را عوض کنید.` },
        { status: 409 }
      );
    }
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
