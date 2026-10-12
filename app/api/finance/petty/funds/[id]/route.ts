import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (guard.user.role !== 'a') return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบกองทุน' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl(`/finance/petty/funds/${id}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
