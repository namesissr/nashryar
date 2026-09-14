import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { testSiteConnection } from '@/lib/publisher';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const result = await testSiteConnection(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  });
}
