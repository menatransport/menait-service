import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const { code } = await params;
  if (!/^[A-Z_]{2,20}$/.test(code)) {
    return NextResponse.json({ error: 'รหัสประเภทไม่ถูกต้อง' }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl(`/finance/petty/expense-types/${code}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
