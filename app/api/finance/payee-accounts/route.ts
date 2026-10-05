import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  return proxy(beUrl('/finance/payee-accounts', { q: sp.get('q'), status: sp.get('status') }));
}

export async function POST(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const { employee_id, account_no, account_name } = body;
  return proxy(beUrl('/finance/payee-accounts'), {
    method: 'POST',
    body: JSON.stringify({ employee_id, account_no, account_name, action_by: guard.user.employee_id }),
  });
}
