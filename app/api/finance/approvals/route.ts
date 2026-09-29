import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/approvals/pending', { employee_id: guard.user.employee_id }));
}
