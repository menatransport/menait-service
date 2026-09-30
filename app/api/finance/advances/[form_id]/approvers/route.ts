import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireUser } from '@/lib/finance/server';

type Ctx = { params: Promise<{ form_id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  try {
    const res = await fetch(beUrl(`/finance/advances/${encodeURIComponent(form_id)}/approvers`), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : 'ไม่พบรายการ';
      return NextResponse.json({ error: detail }, { status: res.status });
    }
    if (!guard.user.is_finance && data?.requester_employee_id !== guard.user.employee_id) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET finance advance approvers error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
  }
}
