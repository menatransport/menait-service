import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('mine') === '1') {
    const guard = await requireUser(req);
    if ('error' in guard) return guard.error;
    return proxy(beUrl('/finance/advances', { employee_id: guard.user.employee_id }));
  }
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/advances', {
    status: sp.get('status'),
    overdue: sp.get('overdue'),
    employee_id: sp.get('employee_id'),
    acc_code: sp.get('acc_code'),
    date_from: sp.get('date_from'),
    date_to: sp.get('date_to'),
  }));
}
