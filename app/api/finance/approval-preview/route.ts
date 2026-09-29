import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const amount = req.nextUrl.searchParams.get('amount');
  if (!amount) return NextResponse.json({ error: 'กรุณาระบุจำนวนเงิน' }, { status: 400 });
  return proxy(beUrl('/finance/approval-preview', { employee_id: guard.user.employee_id, amount }));
}
