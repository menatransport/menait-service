import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

type Ctx = { params: Promise<{ employee_id: string }> };

/** Employee lookup for the Master "เพิ่มบัญชี" dialog. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const { employee_id } = await params;
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(employee_id)) {
    return NextResponse.json({ error: 'รหัสพนักงานไม่ถูกต้อง' }, { status: 400 });
  }
  return proxy(beUrl(`/finance/people/${encodeURIComponent(employee_id)}`));
}
