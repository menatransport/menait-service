import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, proxy, requireUser } from '@/lib/finance/server';

/**
 * รายชื่อวงเงินเป็นข้อมูลหลัก (สาขา แผนก ผู้ถือเงิน วงเงิน) ทุกคนที่ล็อกอินเห็นได้
 * เจ้าหน้าที่สาขาต้องเลือกวงเงินตอนเปิดใบ และแผงข้างต้องหาวงเงินของใบที่ตัวเองเปิด —
 * เดิมกรองด้วย holder ทำให้คนที่ไม่ได้ถือเงินเห็นรายการว่าง เปิดใบไม่ได้เลย (เจอ 2026-10-13)
 * สิทธิ์อนุมัติไม่ได้มาจากการเห็นรายการนี้ — canApprove ฝั่ง FE และ BE ตรวจผู้ถือเงินอีกชั้น
 */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  return proxy(beUrl('/finance/petty/funds', {
    active: req.nextUrl.searchParams.get('active') ?? 'true',
  }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  if (guard.user.role !== 'a') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl('/finance/petty/funds'), {
    method: 'POST',
    body: JSON.stringify({ ...body, updated_by: guard.user.employee_id }),
  });
}
