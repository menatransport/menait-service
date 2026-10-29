import { NextResponse, type NextRequest } from 'next/server';
import { OUTSTANDING_STATUSES, summarizeOutstanding } from '@/lib/finance/outstanding';
import { beJsonOrNull, beUrl, canViewAdv, requireUser } from '@/lib/finance/server';

type Ctx = { params: Promise<{ form_id: string }> };

/**
 * ยอดค้างเคลียร์ของคนขอเบิกใบนี้ (ผู้ใช้แจ้ง 26/10/2026: ผู้อนุมัติเห็นตอนเปิดดูรายละเอียดจากหน้าอนุมัติ)
 * คนที่เปิดใบนี้ได้ (canViewAdv) เท่านั้น · ส่งกลับแค่ยอดรวม ไม่ส่งรายการใบอื่นของเขา
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  if (!(await canViewAdv(guard.user, form_id))) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
  }
  const detail = await beJsonOrNull(beUrl(`/finance/advances/${encodeURIComponent(form_id)}`)) as
    { requester?: { employee_id?: string | null } } | null;
  const employeeId = detail?.requester?.employee_id;
  if (!employeeId) return NextResponse.json({ error: 'ไม่พบผู้ขอเบิกของใบนี้' }, { status: 404 });
  const items = await beJsonOrNull(beUrl('/finance/advances', { employee_id: employeeId, status: OUTSTANDING_STATUSES.join(',') }));
  if (!Array.isArray(items)) return NextResponse.json({ error: 'โหลดยอดค้างเคลียร์ไม่สำเร็จ' }, { status: 502 });
  return NextResponse.json(summarizeOutstanding(items));
}
