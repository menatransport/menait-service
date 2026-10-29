/**
 * พจร. = ต้องมีใบรับสภาพหนี้ (ผู้ใช้สั่ง 29/10/2026 · ทุกประเภท) — ต้องตรงกับ needs_debt_doc ใน BE
 * เจ้าของเงินสดใส่เลขหลังโอนเงินแล้ว (ไม่ถามตอนอนุมัติ) แต่ต้องมีก่อนติ๊กใบเข้ารอบส่งเคลียร์
 */
export const PJR = 'พจร.';
export const DEBT_DOC_MAX = 50;

/** BE ส่ง needs_debt_doc มาก็เชื่อตามนั้น · ไม่ส่ง (BE เก่า) ค่อยดูจาก พจร. ในแถว/หัวใบ */
export function needsDebtDoc(claim: {
  items: readonly { driver_role?: string | null }[];
  detail?: Record<string, unknown> | null;
  needs_debt_doc?: boolean | null;
}): boolean {
  if (typeof claim.needs_debt_doc === 'boolean') return claim.needs_debt_doc;
  if (claim.items.some(i => (i.driver_role ?? '') === PJR)) return true;
  return String(claim.detail?.driver_role ?? '') === PJR;
}

/** ข้อความเตือนของช่องเลขรับสภาพหนี้ — null = ใช้ได้ (BE รับ 1–50 ตัว) */
export function debtDocProblem(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  if (!text) return 'กรุณากรอกเลขรับสภาพหนี้';
  if (text.length > DEBT_DOC_MAX) return `เลขยาวเกิน ${DEBT_DOC_MAX} ตัว`;
  return null;
}
