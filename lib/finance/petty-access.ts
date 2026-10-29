import type { PettyStatus } from '@/lib/finance/petty-status';

/** สาขาเป็นตัวอักษร (LB/SB) หรือตัวเลขสำหรับสาขาที่ยังไม่ตั้ง · ไม่ใช่ ADV-… */
export const PETTY_FORM_ID = /^[A-Z0-9]{2,4}-[A-Z0-9]{2,8}-\d{4}-\d{3,}$/;

export function isPettyFormId(id: unknown): boolean {
  return typeof id === 'string' && PETTY_FORM_ID.test(id);
}

type U = {
  employee_id?: string | null;
  role?: string | null;
  /** ธงเดิมที่ครอบทั้งบัญชีและการเงิน — ยังรับไว้ระหว่างที่ยังไม่ได้ตั้ง env ใหม่ */
  is_finance?: boolean | null;
  is_accounting?: boolean | null;
  is_treasury?: boolean | null;
};
type F = { id: number; holder_employee_id: string };

/** ผู้อนุมัติคือผู้ถือกองทุนคนเดียว — การเป็นการเงินไม่ทำให้อนุมัติแทนได้ (spec §4.1) */
export function canApprove(user: U | null | undefined, fund: F | null | undefined): boolean {
  return !!user?.employee_id && !!fund && user.employee_id === fund.holder_employee_id;
}

/** บัญชี/การเงินเห็นใบตั้งแต่หัวหน้าอนุมัติเคลียร์ส่งถึงบัญชีเป็นต้นไป ไม่ใช่ตั้งแต่เปิดใบ */
const FINANCE_VISIBLE: PettyStatus[] = ['AWAITING_REVIEW', 'SENT_BACK', 'REVIEWED', 'CLOSED'];

const isBackOffice = (user: U) =>
  user.is_accounting === true || user.is_treasury === true || user.is_finance === true;

export function canSeeClaim(
  user: U | null | undefined,
  claim: { created_by: string; fund_id: number; status: PettyStatus },
  myFunds: readonly F[],
): boolean {
  if (!user?.employee_id) return false;
  if (user.role === 'a') return true;
  if (claim.created_by === user.employee_id) return true;
  if (myFunds.some(f => f.id === claim.fund_id && f.holder_employee_id === user.employee_id)) return true;
  if (isBackOffice(user)) return FINANCE_VISIBLE.includes(claim.status);
  return false;
}

/** ดึงคิวของทุกกองทุนได้ — บัญชี การเงิน หรือแอดมิน · เจ้าหน้าที่/ผู้อนุมัติไม่ได้ */
export function canSeeAllClaims(user: U | null | undefined): boolean {
  return !!user && (user.role === 'a' || isBackOffice(user));
}

/** ตรวจเอกสาร (ขั้น 6) = บัญชี */
export function canReview(user: U | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'a' || user.is_accounting === true) return true;
  // ระหว่างที่ยังไม่ได้ตั้ง ACCOUNTING_* ธงเดิมยังใช้ได้ แต่ถ้าตั้งแล้วเป็นการเงินล้วน จะทำไม่ได้
  return user.is_treasury === true ? false : user.is_finance === true;
}

/** ตั้งเบิกทั้งรอบ = บัญชี (คนเดียวกับที่ตรวจเอกสาร) */
export function canVoucher(user: U | null | undefined): boolean {
  return canReview(user);
}

/** ใครเปิดดูรอบส่งเคลียร์ได้ — can_clear มาจาก BE (สายงานรู้ที่ BE เท่านั้น) */
export function canSeeRound(
  user: U | null | undefined,
  round: { holder_employee_id: string | null; clear_approved_by: string | null; can_clear?: boolean | null },
): boolean {
  if (!user?.employee_id) return false;
  if (user.role === 'a' || isBackOffice(user)) return true;
  if (round.holder_employee_id === user.employee_id) return true;
  if (round.clear_approved_by === user.employee_id) return true;
  return round.can_clear === true;
}

/** ทำจ่ายทั้งรอบ = การเงิน (เดิมเรียกว่าปิดรอบคืนยอด) */
export function canCloseBatch(user: U | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'a' || user.is_treasury === true) return true;
  return user.is_accounting === true ? false : user.is_finance === true;
}
