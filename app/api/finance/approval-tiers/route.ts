import { type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/** TOA approval tiers (clause 6.1–6.7) for the "ดูตาราง TOA" dialog. */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/approval-tiers'));
}
