import type { PettyStatus } from '@/lib/finance/petty-status';

export const PETTY_FORM_ID = /^\d{2,4}-[A-Z0-9]{2,8}-\d{4}-\d{3,}$/;

export function isPettyFormId(id: unknown): boolean {
  return typeof id === 'string' && PETTY_FORM_ID.test(id);
}

type U = { employee_id?: string | null; is_finance?: boolean | null; role?: string | null };
type F = { id: number; holder_employee_id: string };

/** ผู้อนุมัติคือผู้ถือกองทุนคนเดียว — การเป็นการเงินไม่ทำให้อนุมัติแทนได้ (spec §4.1) */
export function canApprove(user: U | null | undefined, fund: F | null | undefined): boolean {
  return !!user?.employee_id && !!fund && user.employee_id === fund.holder_employee_id;
}

const FINANCE_VISIBLE: PettyStatus[] = ['AWAITING_REVIEW', 'SENT_BACK', 'CLOSED'];

export function canSeeClaim(
  user: U | null | undefined,
  claim: { created_by: string; fund_id: number; status: PettyStatus },
  myFunds: readonly F[],
): boolean {
  if (!user?.employee_id) return false;
  if (user.role === 'a') return true;
  if (claim.created_by === user.employee_id) return true;
  if (myFunds.some(f => f.id === claim.fund_id && f.holder_employee_id === user.employee_id)) return true;
  if (user.is_finance === true) return FINANCE_VISIBLE.includes(claim.status);
  return false;
}

export function canCloseBatch(user: U | null | undefined): boolean {
  return user?.is_finance === true || user?.role === 'a';
}
