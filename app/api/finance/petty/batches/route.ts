import { NextResponse, type NextRequest } from 'next/server';
import { canSeeAllClaims } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/**
 * รอบส่งเคลียร์ (flow v2) — view=mine รอบของกองทุนที่ฉันถือ · view=clear รอบที่ฉันอนุมัติเคลียร์ได้
 * · view=clear_history รอบที่ฉันอนุมัติ/ไม่อนุมัติไปแล้ว (แถบ อนุมัติ/ไม่อนุมัติแล้ว ของหัวหน้า)
 * · view=all ทุกรอบ (บัญชี/การเงิน/แอดมินเท่านั้น) · ไม่ระบุ = mine (แคบสุดเสมอ)
 * ตัวตนมาจาก session เสมอ ไม่รับรหัสพนักงานจาก query
 */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  const view = sp.get('view') ?? 'mine';
  const me = guard.user.employee_id;
  const scope =
    view === 'clear' ? { clear_approver: me }
    : view === 'clear_history' ? { cleared_by: me }
    : view === 'all' && canSeeAllClaims(guard.user) ? {}
    : { holder: me };
  return proxy(beUrl('/finance/petty/batches', {
    ...scope,
    status: sp.get('status'),
    fund_id: sp.get('fund_id'),
    limit: sp.get('limit') ?? '100',
    offset: sp.get('offset') ?? '0',
  }));
}

/** เจ้าของเงินสดสร้างรอบ — BE ตรวจว่าเป็นเจ้าของกองทุนจริง (employee_id มาจาก session) */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.claim_ids) || body.claim_ids.length === 0) {
    return NextResponse.json({ error: 'ยังไม่ได้เลือกใบที่จะส่งเคลียร์' }, { status: 400 });
  }
  return proxy(beUrl('/finance/petty/batches'), {
    method: 'POST',
    body: JSON.stringify({ ...body, employee_id: guard.user.employee_id }),
  });
}
