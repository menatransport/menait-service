import { NextResponse, type NextRequest } from 'next/server';
import { canSeeAllClaims } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const sp = req.nextUrl.searchParams;
  const view = sp.get('view') ?? 'mine';
  const seesAll = canSeeAllClaims(guard.user);
  // ค่าเริ่มต้นแคบสุดเสมอ: ไม่ระบุ view = เห็นแต่ใบที่ตัวเองเปิด
  // head = ใบรอหัวหน้าที่ฉันอนุมัติได้ (BE คัดตามสายงาน) · head_history = ใบที่ฉันอนุมัติขั้นหัวหน้าไปแล้ว
  const scope =
    view === 'approvals' ? { holder: guard.user.employee_id }
    : view === 'head' ? { head_approver: guard.user.employee_id }
    : view === 'head_history' ? { head_approved_by: guard.user.employee_id }
    : view === 'all' && seesAll ? {}
    : { employee_id: guard.user.employee_id };
  return proxy(beUrl('/finance/petty/claims', {
    ...scope,
    status: sp.get('status'),
    month: sp.get('month'),
    limit: sp.get('limit') ?? '50',
    offset: sp.get('offset') ?? '0',
  }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  // created_by มาจาก session เท่านั้น
  return proxy(beUrl('/finance/petty/claims'), {
    method: 'POST',
    body: JSON.stringify({ ...body, created_by: guard.user.employee_id }),
  });
}
