import { SignJWT, jwtVerify } from 'jose';
import type { UserInfo } from '@/app/context/SessionContext';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-me'
);

const COOKIE_NAME = 'session-token';
const EXPIRES_IN = 90 * 24 * 60 * 60; // 3 months in seconds

/** `expiresAt` (epoch seconds) keeps an existing session's expiry when it is re-signed with fresh data. */
export async function signToken(user: UserInfo, expiresAt?: number): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt ?? `${EXPIRES_IN}s`)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<UserInfo | null> {
  return (await verifySession(token))?.user ?? null;
}

/** The session user plus the token's expiry (epoch seconds). */
export async function verifySession(token: string): Promise<{ user: UserInfo; exp: number } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const user = (payload as any).user as UserInfo | undefined;
    return user && payload.exp ? { user, exp: payload.exp } : null;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, EXPIRES_IN };
