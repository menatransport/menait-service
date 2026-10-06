import type { NextRequest } from 'next/server';
import { pickListParams } from '@/lib/finance/advanceQuery';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

const listQuery = pickListParams;

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
