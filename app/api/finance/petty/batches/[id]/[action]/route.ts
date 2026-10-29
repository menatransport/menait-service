import { NextResponse, type NextRequest } from 'next/server';
import { canCloseBatch, canVoucher, roundDocNumbersAllowed } from '@/lib/finance/petty-access';
import { roundActionBody, type RoundActionName } from '@/lib/finance/petty-worklist';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

const ROUND_ID = /^\d{1,9}$/;
// clear-approve / clear-reject: BE ตรวจสายงานของเจ้าของเงินสดเอง (หน้าเว็บไม่รู้ผังองค์กร)
// doc-numbers: แก้เลขที่เอกสารที่กรอกผิด (แบบ Advance) — รอบไม่เปลี่ยนสถานะ
const ACTIONS = new Set<RoundActionName>(['clear-approve', 'clear-reject', 'voucher', 'pay', 'doc-numbers']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id, action } = await params;
  if (!ROUND_ID.test(id)) return NextResponse.json({ error: 'เลขรอบไม่ถูกต้อง' }, { status: 400 });
  if (!ACTIONS.has(action as RoundActionName)) return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  const name = action as RoundActionName;
  if (name === 'voucher' && !canVoucher(guard.user)) {
    return NextResponse.json({ error: 'ตั้งเบิกได้เฉพาะฝ่ายบัญชี' }, { status: 403 });
  }
  if (name === 'pay' && !canCloseBatch(guard.user)) {
    return NextResponse.json({ error: 'จ่ายเงินได้เฉพาะฝ่ายการเงิน' }, { status: 403 });
  }
  // ส่งต่อเฉพาะช่องที่คำสั่งนั้นใช้ — employee_id มาจาก session เสมอ
  const body = roundActionBody(name, await req.json().catch(() => ({})));
  if (name === 'doc-numbers' && !roundDocNumbersAllowed(guard.user, body)) {
    return NextResponse.json({ error: 'บัญชีแก้ข้อมูลตั้งเบิก การเงินแก้เลขที่ทำจ่าย' }, { status: 403 });
  }
  return proxy(beUrl(`/finance/petty/batches/${id}/${name}`), {
    method: 'POST',
    body: JSON.stringify({ ...body, employee_id: guard.user.employee_id }),
  });
}
