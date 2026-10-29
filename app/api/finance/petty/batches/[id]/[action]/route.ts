import { NextResponse, type NextRequest } from 'next/server';
import { canCloseBatch, canVoucher } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

const ROUND_ID = /^\d{1,9}$/;
// clear-approve / clear-reject: BE ตรวจสายงานของเจ้าของเงินสดเอง (หน้าเว็บไม่รู้ผังองค์กร)
const ACTIONS = new Set(['clear-approve', 'clear-reject', 'voucher', 'pay']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id, action } = await params;
  if (!ROUND_ID.test(id)) return NextResponse.json({ error: 'เลขรอบไม่ถูกต้อง' }, { status: 400 });
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  if (action === 'voucher' && !canVoucher(guard.user)) {
    return NextResponse.json({ error: 'ตั้งเบิกได้เฉพาะฝ่ายบัญชี' }, { status: 403 });
  }
  if (action === 'pay' && !canCloseBatch(guard.user)) {
    return NextResponse.json({ error: 'ทำจ่ายได้เฉพาะฝ่ายการเงิน' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  return proxy(beUrl(`/finance/petty/batches/${id}/${action}`), {
    method: 'POST',
    body: JSON.stringify({ ...body, employee_id: guard.user.employee_id }),
  });
}
