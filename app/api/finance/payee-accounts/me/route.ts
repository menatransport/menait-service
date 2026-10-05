import { type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** The signed-in user's own payee master account + newest request. */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/payee-accounts/me', { employee_id: guard.user.employee_id }));
}
