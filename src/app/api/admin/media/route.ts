import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export async function GET() {
  return handle(async () => {
    await requireUser();
    const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json({ media });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const form = await req.formData();
    const file = form.get('file');
    const alt = (form.get('alt') as string) || null;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'فایلی ارسال نشده است.' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'فقط تصویر (jpg، png، webp، gif، svg) مجاز است.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'حجم فایل حداکثر ۵ مگابایت باشد.' }, { status: 400 });
    }

    const fileName = `${Date.now()}-${nanoid(8)}.${EXT[file.type]}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(process.cwd(), 'public', 'uploads', fileName), buffer);

    const url = `/uploads/${fileName}`;
    const media = await prisma.media.create({
      data: { fileName, url, mime: file.type, size: file.size, alt },
    });
    return NextResponse.json({ ok: true, media });
  });
}
