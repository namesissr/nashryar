import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/api-helpers';
import { runSchedulerTick } from '@/lib/scheduler';

/** اجرای دستی یک تیک زمان‌بند — برای دکمه «اجرای الان» */
export async function POST() {
  return handle(async () => {
    await requireUser();
    const result = await runSchedulerTick();
    return NextResponse.json({ ok: true, ...result });
  });
}
