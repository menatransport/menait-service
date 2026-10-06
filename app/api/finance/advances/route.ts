import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

// query params shared by the paged finance queue and the requester's own list
const LIST_PARAMS = ['page', 'page_size', 'status', 'overdue', 'q', 'date_from', 'date_to', 'cost_center'] as const;

function listQuery(sp: URLSearchParams): Record<string, string | null> {
  return Object.fromEntries(LIST_PARAMS.map(k => [k, sp.get(k)]));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('mine') === '1') {
    const guard = await requireUser(req);
    if ('error' in guard) return guard.error;
    // employee_id always comes from the session, never the browser
    return proxy(beUrl('/finance/advances', { ...listQuery(sp), employee_id: guard.user.employee_id }));
  }
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/advances', {
    ...listQuery(sp),
    employee_id: sp.get('employee_id'),
    acc_code: sp.get('acc_code'),
  }));
}
