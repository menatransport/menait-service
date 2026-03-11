import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/jwt';

// GET: Read user from cookie
export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    const res = NextResponse.json({ user: null }, { status: 401 });
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  return NextResponse.json({ user });
}

// DELETE: Clear cookie (logout)
export async function DELETE() {
  const res = NextResponse.json({ message: 'Logged out' });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
