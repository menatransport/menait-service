/** พจร. = ต้องมีใบรับสภาพหนี้ (ผู้ใช้สั่ง 29/10/2026 · ทุกประเภท) — ต้องตรงกับ needs_debt_doc ใน BE */
export const PJR = 'พจร.';

export function needsDebtDoc(claim: {
  items: readonly { driver_role?: string | null }[];
  detail?: Record<string, unknown> | null;
}): boolean {
  if (claim.items.some(i => (i.driver_role ?? '') === PJR)) return true;
  return String(claim.detail?.driver_role ?? '') === PJR;
}
