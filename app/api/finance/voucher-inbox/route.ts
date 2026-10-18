import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireFinance } from '@/lib/finance/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = '20';

/** Slim feed of requests sitting in "รอตั้งเบิก", polled by the in-app notifier. */
export async function GET(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;

  try {
    const res = await fetch(beUrl('/finance/advances', { status: 'AWAITING_VOUCHER', page_size: PAGE_SIZE, sort: '-created_at' }), {
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ items: [], total: 0 });
    const data = await res.json();
    const items = (data?.items ?? []).map((it: any) => ({
      form_id: it.form_id,
      requester_name: it.requester?.name ?? it.requester?.employee_id ?? null,
      amount: it.fin?.amount_paid ?? it.request?.amount ?? null,
      created_at: it.created_at ?? null,
    }));
    return NextResponse.json({ items, total: data?.total ?? items.length });
  } catch {
    return NextResponse.json({ items: [], total: 0 });
  }
}
