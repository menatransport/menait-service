import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบกองทุน' }, { status: 404 });
  return proxy(beUrl(`/finance/petty/funds/${id}/balance`));
}
