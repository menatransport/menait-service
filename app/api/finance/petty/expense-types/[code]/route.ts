import { NextResponse, type NextRequest } from 'next/server';
import { canReview } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  // master ประเภทการเบิก: บัญชีกับแอดมินแก้ได้ (ข้อ 5 ที่ตกลงไว้) การเงินล้วนแก้ไม่ได้
  if (!canReview(guard.user)) {
    return NextResponse.json({ error: 'เฉพาะฝ่ายบัญชีและผู้ดูแลระบบ' }, { status: 403 });
  }
  const { code } = await params;
  if (!/^[A-Z_]{2,20}$/.test(code)) {
    return NextResponse.json({ error: 'รหัสประเภทไม่ถูกต้อง' }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl(`/finance/petty/expense-types/${code}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
