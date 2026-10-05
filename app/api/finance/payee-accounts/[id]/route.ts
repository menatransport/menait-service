import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const { account_no, account_name, status } = body;
  return proxy(beUrl(`/finance/payee-accounts/${id}`), {
    method: 'PUT',
    body: JSON.stringify({ account_no, account_name, status, action_by: guard.user.employee_id }),
  });
}
