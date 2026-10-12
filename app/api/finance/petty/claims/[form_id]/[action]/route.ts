import { NextResponse, type NextRequest } from 'next/server';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

const ACTIONS = new Set(['approve', 'return', 'transfer', 'submit-accounting', 'review']);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ form_id: string; action: string }> },
) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id, action } = await params;
  if (!isPettyFormId(form_id)) {
    return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
  }
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  if (action === 'review' && guard.user.is_finance !== true && guard.user.role !== 'a') {
    return NextResponse.json({ error: 'เฉพาะฝ่ายบัญชีเท่านั้น' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  // employee_id มาจาก session — BE ใช้ค่านี้ตรวจว่าเป็นผู้ถือกองทุนไหม
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}/${action}`), {
    method: 'POST',
    body: JSON.stringify({ ...body, employee_id: guard.user.employee_id }),
  });
}
