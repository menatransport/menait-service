import type { SuggestedApprover } from '@/app/finance/types';

/**
 * ขั้นที่ยังไม่มีใครกดอนุมัติ: บอกว่ากำลังรอใคร (ผู้ใช้สั่ง 18/11/2026)
 * ชื่อมาจาก BE /finance/advances/{id}/approvers = คนที่อนุมัติขั้นปัจจุบันได้ · หลายคน = คนใดคนหนึ่ง
 */
export function waitingLabel(approvers: readonly Pick<SuggestedApprover, 'name'>[] | null | undefined, max = 3): string {
  const names = [...new Set((approvers ?? []).map(a => (a.name ?? '').trim()).filter(Boolean))];
  if (names.length === 0) return 'รออนุมัติ';
  const shown = names.slice(0, max).join(' หรือ ');
  const more = names.length - max;
  return `รอ ${shown}${more > 0 ? ` (และอีก ${more} คน)` : ''} อนุมัติ`;
}
