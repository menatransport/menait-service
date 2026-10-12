import { NextResponse, type NextRequest } from 'next/server';
import { canCloseBatch } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/petty/batches', { fund_id: req.nextUrl.searchParams.get('fund_id') }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (!canCloseBatch(guard.user)) {
    return NextResponse.json({ error: 'เฉพาะฝ่ายการเงินเท่านั้น' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.claim_ids) || body.claim_ids.length === 0) {
    return NextResponse.json({ error: 'ยังไม่ได้เลือกใบที่จะปิดรอบ' }, { status: 400 });
  }
  return proxy(beUrl('/finance/petty/batches'), {
    method: 'POST',
    body: JSON.stringify({ ...body, employee_id: guard.user.employee_id }),
  });
}
