import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireFinance } from '@/lib/finance/server';

export const dynamic = 'force-dynamic';

/** ใบอื่นที่ใช้เลขเดียวกัน (เลขที่ตั้งเบิก / ทำจ่าย / เอกสารเคลียร์) — ใช้ถามยืนยันก่อนบันทึก
 * หลังบ้านล่มหรือยังไม่มี endpoint: ตอบว่าไม่ซ้ำ ไม่ให้งานค้างเพราะเช็กไม่ได้ */
export async function GET(req: NextRequest) {
  const guard = await requireFinance(req);
  if ('error' in guard) return guard.error;
  const q = req.nextUrl.searchParams;
  try {
    const res = await fetch(beUrl('/finance/advances/duplicate-doc-no', {
      field: q.get('field'), value: q.get('value'), exclude_form_id: q.get('exclude_form_id'),
    }), { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ form_ids: [] });
    const data = await res.json();
    return NextResponse.json({ form_ids: Array.isArray(data?.form_ids) ? data.form_ids : [] });
  } catch {
    return NextResponse.json({ form_ids: [] });
  }
}
