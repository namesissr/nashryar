import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { publishArticle } from '@/lib/publisher';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { unpublish?: boolean };
    const result = await publishArticle(id, { unpublish: !!body.unpublish });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  });
}
