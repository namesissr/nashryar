import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';
import prisma from './prisma';
import { env } from './env';

/**
 * نشست ساده مبتنی بر JWT در کوکی httpOnly.
 * پنل تک‌نفره/تیم کوچک است؛ ابطال فوری نشست لازم نیست.
 */

const ALG = 'HS256';

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + env.sessionDays * 24 * 60 * 60 * 1000);
  const jwt = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  const store = await cookies();
  store.set(env.cookieName, jwt, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(env.cookieName);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const value = store.get(env.cookieName)?.value;
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, secretKey(), { algorithms: [ALG] });
    const uid = payload.uid as string;
    if (!uid) return null;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, name: true, role: true },
    });
    return user;
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('برای ادامه باید وارد شوید.', 401);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new AuthError('این عملیات فقط برای مدیر مجاز است.', 403);
  return user;
}
