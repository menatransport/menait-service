import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/payee-requests', { status: req.nextUrl.searchParams.get('status') }));
}

/** employee_id and app_origin come from the session / server config, never the browser body. */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const { account_no, account_name, remark } = body;
  // Trusted server config only; Host / X-Forwarded-Host are spoofable.
  const appOrigin = process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, '') || undefined;
  return proxy(beUrl('/finance/payee-requests'), {
    method: 'POST',
    body: JSON.stringify({
      employee_id: guard.user.employee_id,
      account_no,
      account_name,
      remark,
      app_origin: appOrigin,
    }),
  });
}
