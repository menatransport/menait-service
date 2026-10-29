import { NextResponse, type NextRequest } from 'next/server';
import { canCloseBatch, canVoucher } from '@/lib/finance/petty-access';
import { DOC_NO_MAX } from '@/lib/finance/petty-worklist';
import { beUrl, requireUser } from '@/lib/finance/server';

export const dynamic = 'force-dynamic';

const FIELDS = new Set(['voucher_no', 'pay_doc_no']);
const ROUND_ID = /^\d{1,9}$/;

/**
 * รอบอื่นที่ใช้เลขเดียวกัน (เลขที่ตั้งเบิก / เลขที่ทำจ่าย) — ใช้เตือนก่อนบันทึกแบบ Advance (เตือน ไม่บล็อก)
 * BE ล่มหรือยังไม่มี endpoint: ตอบว่าไม่ซ้ำ ไม่ให้งานค้างเพราะเช็กไม่ได้
 */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (!canVoucher(guard.user) && !canCloseBatch(guard.user)) {
    return NextResponse.json({ error: 'เฉพาะฝ่ายบัญชีและการเงิน' }, { status: 403 });
  }
  const q = req.nextUrl.searchParams;
  const field = q.get('field') ?? '';
  const value = (q.get('value') ?? '').trim();
  const excludeId = q.get('exclude_id');
  if (!FIELDS.has(field) || !value || value.length > DOC_NO_MAX || (excludeId && !ROUND_ID.test(excludeId))) {
    return NextResponse.json({ batch_nos: [] });
  }
  try {
    const res = await fetch(beUrl('/finance/petty/batches/duplicate-doc-no', { field, value, exclude_id: excludeId }),
      { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ batch_nos: [] });
    const data = await res.json();
    return NextResponse.json({ batch_nos: Array.isArray(data?.batch_nos) ? data.batch_nos : [] });
  } catch {
    return NextResponse.json({ batch_nos: [] });
  }
}
