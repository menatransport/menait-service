import { NextResponse, type NextRequest } from 'next/server';
import { FORM_ID_PATTERN } from '@/lib/s3';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

const MAX_FORM_IDS = 200;

export async function POST(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => null);
  const raw = body?.form_ids;
  let form_ids: string[] | undefined;
  if (raw !== undefined && raw !== null) {
    if (!Array.isArray(raw) || raw.length > MAX_FORM_IDS
      || !raw.every(id => typeof id === 'string' && FORM_ID_PATTERN.test(id))) {
      return NextResponse.json({ error: 'รายการที่เลือกไม่ถูกต้อง' }, { status: 400 });
    }
    form_ids = raw;
  }
  return proxy(beUrl('/finance/advances/overdue-reminders'), {
    method: 'POST',
    body: JSON.stringify({ action_by: guard.user.employee_id, ...(form_ids ? { form_ids } : {}) }),
  });
}
