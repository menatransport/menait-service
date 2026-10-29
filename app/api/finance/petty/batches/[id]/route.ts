import { NextResponse, type NextRequest } from 'next/server';
import { canSeeHolderPayee, canSeeRound } from '@/lib/finance/petty-access';
import { beUrl, beJsonOrNull, requireUser } from '@/lib/finance/server';

const ROUND_ID = /^\d{1,9}$/;

/**
 * รอบหนึ่งรอบพร้อมใบในรอบ — เห็นได้: เจ้าของเงินสด หัวหน้าที่อนุมัติได้/ตัดสินไปแล้ว บัญชี การเงิน แอดมิน
 * บัญชีรับเงินของเจ้าของเงินสด (holder_payee) ส่งต่อเฉพาะคนที่ต้องโอนเงิน (การเงิน แอดมิน) กับเจ้าของเอง
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!ROUND_ID.test(id)) return NextResponse.json({ error: 'เลขรอบไม่ถูกต้อง' }, { status: 400 });
  const round = await beJsonOrNull(beUrl(`/finance/petty/batches/${id}`, { employee_id: guard.user.employee_id })) as
    ({ holder_employee_id: string | null; clear_approved_by: string | null; can_clear?: boolean; holder_payee?: unknown } & Record<string, unknown>) | null;
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบส่งเคลียร์' }, { status: 404 });
  if (!canSeeRound(guard.user, round)) return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรอบนี้' }, { status: 403 });
  if ('holder_payee' in round && !canSeeHolderPayee(guard.user, round)) {
    const { holder_payee: _hidden, ...rest } = round;
    return NextResponse.json(rest);
  }
  return NextResponse.json(round);
}
