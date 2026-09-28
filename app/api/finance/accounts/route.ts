import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/accounts', { active: req.nextUrl.searchParams.get('active') }));
}

export async function POST(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const body = await req.json();
  return proxy(beUrl('/finance/accounts'), {
    method: 'POST',
    body: JSON.stringify({ ...body, action_by: guard.user.employee_id }),
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const { acc_code, ...rest } = await req.json();
  if (!acc_code) return NextResponse.json({ error: 'ไม่มีรหัสบัญชี' }, { status: 400 });
  return proxy(beUrl(`/finance/accounts/${encodeURIComponent(acc_code)}`), {
    method: 'PUT',
    body: JSON.stringify({ ...rest, action_by: guard.user.employee_id }),
  });
}
