import 'server-only';
import { NextResponse } from 'next/server';
import { AuthError } from './auth';
import { ZodError } from 'zod';

/** اجرای هندلر با مدیریت یکدست خطاها */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'ورودی نامعتبر است.' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'خطای داخلی سرور.' }, { status: 500 });
  }
}
