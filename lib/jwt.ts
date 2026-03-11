import { SignJWT, jwtVerify } from 'jose';
import type { UserInfo } from '@/app/context/SessionContext';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-me'
);

const COOKIE_NAME = 'session-token';
const EXPIRES_IN = 90 * 24 * 60 * 60; // 3 months in seconds

export async function signToken(user: UserInfo): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<UserInfo | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return (payload as any).user as UserInfo;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, EXPIRES_IN };
