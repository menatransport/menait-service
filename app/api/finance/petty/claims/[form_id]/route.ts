import { NextResponse, type NextRequest } from 'next/server';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

const bad = () => NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });

export async function GET(req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  if (!isPettyFormId(form_id)) return bad();
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}`));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  if (!isPettyFormId(form_id)) return bad();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, created_by: guard.user.employee_id }),
  });
}
