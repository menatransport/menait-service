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

// ---- งานเงินสดย่อย (/finance/petty/accounting) — บัญชีกับการเงินใช้หน้าเดียวกัน ซ่อนปุ่มตามแผนกแบบ Advance · ด่านจริงอยู่ที่ BE/proxy

/** เปิดหน้างานเงินสดย่อยได้: บัญชี การเงิน แอดมิน */
export function canSeePettyWorklist(user: U | null | undefined): boolean {
  return canReview(user) || canCloseBatch(user);
}

/** ปุ่มที่คนนี้เห็นในหน้างาน: บัญชี = ตรวจ + ตั้งเบิก · การเงิน = จ่ายเงิน · แอดมิน = ทุกปุ่ม */
export function worklistPerms(user: U | null | undefined): { review: boolean; voucher: boolean; pay: boolean } {
  return { review: canReview(user), voucher: canVoucher(user), pay: canCloseBatch(user) };
}

/** เลขรอบส่งเคลียร์ เช่น LB-B02-2610-B7 / 04-A04-2610-B1 — ใช้เป็นชื่อโฟลเดอร์ S3 ของสลิปโอน จึงคุมเข้ม ไม่มี / หรือ .. */
export const PETTY_ROUND_NO = /^[A-Z0-9]{2,4}-[A-Z0-9]{2,8}-\d{4}-B\d{1,6}$/;

export function isPettyRoundNo(id: unknown): id is string {
  return typeof id === 'string' && PETTY_ROUND_NO.test(id);
}

/** สลิปโอนของรอบ: การเงิน/แอดมิน เมื่อรอบถึงขั้นจ่ายเงินแล้ว (รอจ่าย หรือจ่ายแล้วปิดรอบ แนบเพิ่มทีหลังได้แบบ Advance) */
export function canUploadRoundSlip(user: U | null | undefined, round: { status: string } | null | undefined): boolean {
  return !!round && canCloseBatch(user) && (round.status === 'VOUCHERED' || round.status === 'CLOSED');
}

/** บัญชีรับเงินของเจ้าของเงินสด — เห็นเฉพาะคนที่ต้องโอน (การเงิน แอดมิน) และเจ้าของเอง */
export function canSeeHolderPayee(user: U | null | undefined, round: { holder_employee_id: string | null }): boolean {
  if (!user?.employee_id) return false;
  if (canCloseBatch(user)) return true;
  return !!round.holder_employee_id && round.holder_employee_id === user.employee_id;
}

type DocField = 'voucher_no' | 'voucher_date' | 'pay_doc_no';

/** แก้เลขที่เอกสารของรอบ: บัญชีแก้ข้อมูลตั้งเบิก (รอจ่าย/ปิดแล้ว) · การเงินแก้เลขที่ทำจ่าย (ปิดแล้ว) */
export function editableRoundDocFields(user: U | null | undefined, round: { status: string }): DocField[] {
  const out: DocField[] = [];
  if (canVoucher(user) && (round.status === 'VOUCHERED' || round.status === 'CLOSED')) out.push('voucher_no', 'voucher_date');
  if (canCloseBatch(user) && round.status === 'CLOSED') out.push('pay_doc_no');
  return out;
}

/** proxy: ส่งต่อคำสั่งแก้เลขที่เอกสารเมื่อทุกช่องที่ส่งมาเป็นของแผนกคนนี้ (สถานะรอบ BE ตัดสิน 409) */
export function roundDocNumbersAllowed(user: U | null | undefined, body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const voucherFields = has('voucher_no') || has('voucher_date');
  const payFields = has('pay_doc_no');
  if (!voucherFields && !payFields) return false;
  if (voucherFields && !canVoucher(user)) return false;
  return !(payFields && !canCloseBatch(user));
}
