import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** หน้าเปิดใบถามก่อนส่ง: ใบนี้จะไปหาเจ้าของเงินสดเลย หรือรอหัวหน้าก่อน (ตาม TOA) · ผู้ขอ = คนที่ล็อกอิน ไม่รับจาก query */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  return proxy(beUrl('/finance/petty/claims/route-preview', {
    created_by: guard.user.employee_id, fund_id: sp.get('fund_id'), amount: sp.get('amount'),
  }));
}
