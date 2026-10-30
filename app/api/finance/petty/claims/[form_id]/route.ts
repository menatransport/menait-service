import { NextResponse, type NextRequest } from 'next/server';
import { canSeeClaim, isPettyFormId } from '@/lib/finance/petty-access';
import { beUrl, isClaimHeadOf, isRoundHeadOf, loadPettyClaimFor, loadPettyFundsHeldBy, proxy, requireUser } from '@/lib/finance/server';

const bad = () => NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });

export async function GET(req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  if (!isPettyFormId(form_id)) return bad();
  // ใครเห็นใบนี้ได้ตัดสินที่นี่ ไม่ใช่แค่หน้าจอ: เจ้าหน้าที่ผู้เปิดใบ ผู้ถือกองทุนของใบ บัญชี/การเงิน (ตั้งแต่ส่งบัญชี) แอดมิน
  const loaded = await loadPettyClaimFor(form_id);
  if (!loaded.claim) return NextResponse.json({ error: 'ไม่พบใบเบิก' }, { status: 404 });
  const held = await loadPettyFundsHeldBy(guard.user.employee_id);
  // + หัวหน้าตามสายงานของรอบที่ใบอยู่ (flow v2: อนุมัติเคลียร์ต้องเปิดดูใบได้)
  // + หัวหน้าของผู้ขอเบิก (flow v3: อนุมัติใบก่อนโอนต้องเปิดดูใบได้)
  const me = guard.user.employee_id;
  if (!canSeeClaim(guard.user, loaded.claim, held)
    && !(await isRoundHeadOf(me, loaded.claim.batch_id)) && !(await isClaimHeadOf(me, form_id))) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
  }
  // ส่งรหัสคนดูไปด้วย BE จะตอบ can_head_approve ให้หน้าจอโชว์ปุ่มของหัวหน้า
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}`, { employee_id: me }));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ form_id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { form_id } = await params;
  if (!isPettyFormId(form_id)) return bad();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  return proxy(beUrl(`/finance/petty/claims/${encodeURIComponent(form_id)}`), {
    method: 'PUT',
    body: JSON.stringify({ ...body, created_by: guard.user.employee_id }),
  });
}
