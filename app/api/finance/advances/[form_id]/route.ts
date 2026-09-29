import { NextResponse, type NextRequest } from 'next/server';
import { BASE_PATH, FORM_ID_PATTERN, hasFiles } from '@/lib/s3';
import { CLEAR_ATTACHMENT_REQUIRED } from '@/app/finance/labels';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

const FINANCE_ACTIONS = new Set(['voucher', 'pay', 'send-back', 'confirm', 'reject-voucher']);

type Ctx = { params: Promise<{ form_id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  try {
    const res = await fetch(beUrl(`/finance/advances/${encodeURIComponent(form_id)}`), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.detail ?? 'ไม่พบรายการ' }, { status: res.status });
    if (!guard.user.is_finance && data?.requester?.employee_id !== guard.user.employee_id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET finance advance error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { form_id } = await params;
  const { action, ...fields } = await req.json();
  if (action !== 'clear' && !FINANCE_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
  }
  const guard = action === 'clear' ? await requireUser(req) : await requireFinance(req);
  if ('error' in guard) return guard.error;
  if (action === 'clear') {
    if (!FORM_ID_PATTERN.test(form_id)) return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
    try {
      if (!(await hasFiles(`${BASE_PATH}/${form_id}/clear/`))) {
        return NextResponse.json({ error: CLEAR_ATTACHMENT_REQUIRED }, { status: 400 });
      }
    } catch (err) {
      console.error('clear attachment check error:', err);
      return NextResponse.json({ error: 'ตรวจสอบไฟล์แนบไม่สำเร็จ กรุณาลองใหม่' }, { status: 502 });
    }
  }
  return proxy(beUrl(`/finance/advances/${encodeURIComponent(form_id)}/${action}`), {
    method: 'PUT',
    body: JSON.stringify({ ...fields, action_by: guard.user.employee_id }),
  });
}
