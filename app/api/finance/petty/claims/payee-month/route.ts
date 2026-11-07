import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** ยอดที่จ่ายให้เจ้านี้ในเดือน — เตือนหัก ณ ที่จ่ายเมื่อเกิน 1,000 (ข้อ 13 ผู้ใช้สั่ง 7/11/2026) */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  return proxy(beUrl('/finance/petty/claims/payee-month', {
    payee_name: sp.get('payee_name'), month: sp.get('month'), exclude_claim_id: sp.get('exclude_claim_id'),
  }));
}
