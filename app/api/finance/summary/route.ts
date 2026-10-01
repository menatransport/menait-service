import type { NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

export async function GET(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/summary'));
}
