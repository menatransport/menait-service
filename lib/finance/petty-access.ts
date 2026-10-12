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

/** บัญชี/การเงินเห็นใบตั้งแต่ส่งบัญชีเป็นต้นไป ไม่ใช่ตั้งแต่เปิดใบ */
const FINANCE_VISIBLE: PettyStatus[] = ['AWAITING_REVIEW', 'SENT_BACK', 'CLOSED'];

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

/** ปิดรอบคืนยอด (ขั้น 7) = การเงิน */
export function canCloseBatch(user: U | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'a' || user.is_treasury === true) return true;
  return user.is_accounting === true ? false : user.is_finance === true;
}
