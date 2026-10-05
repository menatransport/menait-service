import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireUser } from '@/lib/finance/server';

type Ctx = { params: Promise<{ id: string }> };

/** Owner or Finance only. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
  try {
    const res = await fetch(beUrl(`/finance/payee-requests/${id}`), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.detail ?? 'ไม่พบรายการ' }, { status: res.status });
    if (!guard.user.is_finance && data?.employee_id !== guard.user.employee_id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET payee request error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
  }
}
