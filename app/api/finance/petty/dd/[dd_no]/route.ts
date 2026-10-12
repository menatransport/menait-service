import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** เลข DD ของ ATMS: 2 ตัวอักษรคลัง + DD + ปีเดือนลำดับ 8 หลัก เช่น LBDD26090931 */
const DD_PATTERN = /^[A-Z]{2}DD\d{8}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ dd_no: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { dd_no } = await params;
  const code = (dd_no ?? '').trim().toUpperCase();
  // กันยิงอะไรก็ได้เข้า Mongo
  if (!DD_PATTERN.test(code)) {
    return NextResponse.json({ error: 'เลขที่ใบรับสินค้าไม่ถูกต้อง (เช่น LBDD26090931)' }, { status: 400 });
  }
  const sp = req.nextUrl.searchParams;
  return proxy(beUrl(`/finance/petty/dd/${code}`, {
    expense_type: sp.get('expense_type'),
    claim_amount: sp.get('claim_amount'),
  }));
}
