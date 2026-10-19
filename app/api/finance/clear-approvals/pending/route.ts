import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireUser } from '@/lib/finance/server';

export const dynamic = 'force-dynamic';

/** ใบที่รอผู้ใช้คนนี้อนุมัติการเคลียร์ — คนอนุมัติคือหัวหน้า ไม่ใช่ฝ่ายการเงิน */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  try {
    const res = await fetch(beUrl('/finance/clear-approvals/pending', { employee_id: guard.user.employee_id }), {
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
