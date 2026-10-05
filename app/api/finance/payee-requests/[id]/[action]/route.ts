import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

type Ctx = { params: Promise<{ id: string; action: string }> };

const ACTIONS = new Set(['approve', 'reject', 'cancel']);

/** approve/reject: Finance. cancel: any user (BE enforces action_by === owner). */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id, action } = await params;
  if (!ACTIONS.has(action) || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
  }
  const guard = action === 'cancel' ? await requireUser(req) : await requireFinance(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => ({}));
  const payload: Record<string, unknown> = { action_by: guard.user.employee_id };
  if (action === 'reject') payload.review_remark = body?.review_remark;
  return proxy(beUrl(`/finance/payee-requests/${id}/${action}`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
