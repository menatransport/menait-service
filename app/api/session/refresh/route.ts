import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, signToken, verifySession } from '@/lib/jwt';
import { buildSessionUser, diffSessionUser } from '@/lib/session-user';

/**
 * POST /api/session/refresh — re-read the signed-in user from ncacdb and re-sign the cookie when anything changed,
 * so a moved department / new position / removed finance right takes effect without a new login.
 *
 * The employee_id comes from the verified cookie only. Fails open: if ncacdb is slow or down the session stays
 * as it is. Only an explicit "User not found" or a non-Active status ends the session.
 *
 * → { status: 'unchanged' | 'updated' | 'unavailable', user, diff? } · { status: 'inactive', reason } · 401 no session
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const current = token ? await verifySession(token) : null;
  if (!current) return NextResponse.json({ status: 'none', user: null }, { status: 401 });

  const unchanged = (status: 'unchanged' | 'unavailable' = 'unchanged') =>
    NextResponse.json({ status, user: current.user });
  const employeeId = current.user.employee_id;
  if (!employeeId) return unchanged();

  let res: Response;
  let data: any;
  try {
    res = await fetch(`${process.env.URL_API}/auth/session-user/${encodeURIComponent(employeeId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    data = await res.json().catch(() => null);
  } catch {
    return unchanged('unavailable');
  }

  // FastAPI answers "Not Found" for a route that doesn't exist (BE not deployed yet) — only our own
  // "User not found" means the account is gone (e.g. the employee id was changed).
  if (res.status === 404 && data?.detail === 'User not found') return ended('not_found');
  if (!res.ok || !data?.employee_id) return unchanged('unavailable');

  const fresh = buildSessionUser(data);
  if (fresh.employee_status && fresh.employee_status !== 'Active') return ended('inactive');

  const diff = diffSessionUser(current.user, fresh);
  if (!diff.resign) return unchanged();

  const response = NextResponse.json({ status: 'updated', user: fresh, diff });
  response.cookies.set(COOKIE_NAME, await signToken(fresh, current.exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, current.exp - Math.floor(Date.now() / 1000)),
  });
  return response;
}

function ended(reason: 'inactive' | 'not_found') {
  const response = NextResponse.json({ status: 'inactive', reason, user: null });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
