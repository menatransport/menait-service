import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireFinance } from '@/lib/finance/server';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
  return proxy(beUrl(`/finance/payee-accounts/${id}/logs`));
}
