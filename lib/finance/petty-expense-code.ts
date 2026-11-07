import type { PettyClaim } from '@/app/finance/types-petty';
import { costCenterLabel } from '@/lib/finance/petty-cost-centers';

/**
 * รหัสใบสำคัญจ่าย (ผู้ใช้สั่ง 7/11/2026 ข้อ 8) — แยกตามประเภทคนขับและฟลีท ไม่ใช่แผนกผู้เบิก
 *  พจร. ทุกฟลีท → x500 รถร่วม · พจส. รถโม่ (Mixer L/S) → 3200 บริการ (ศลบ) / 2100 ขนส่ง (สสบ)
 *  พจส. Trailer / Side curtain → 3300 บริหารฟลีท (ศลบ) / 2100 (สสบ) · สกท ไม่มีชุดนี้ → '' (ใช้รหัสแผนกผู้เบิก)
 * BE มีกติกาเดียวกันที่ services/finance/petty_cost_centers.py expense_code_for — แก้ต้องแก้ทั้งสองที่
 */
export const EXPENSE_CODES = ['2100', '2500', '3200', '3300', '3500'] as const;
const MIXER = new Set(['Mixer L', 'Mixer S']);

type RowLike = { driver_role?: unknown; fleet?: unknown };

export function expenseCodeFor(costCenter: string | null | undefined, rows: ReadonlyArray<RowLike>): string {
  const digit = costCenter?.[0];
  if (digit !== '2' && digit !== '3') return '';
  const roles = new Set(rows.map(r => String(r.driver_role ?? '').trim()).filter(Boolean));
  const fleets = new Set(rows.map(r => String(r.fleet ?? '').trim()).filter(Boolean));
  if (roles.has('พจร.')) return `${digit}500`;
  if (fleets.size === 0 && roles.size === 0) return '';
  if (digit === '2') return '2100';
  if (fleets.size > 0 && [...fleets].every(f => MIXER.has(f))) return '3200';
  if (fleets.size > 0) return '3300';
  return roles.has('พจส.') ? '3200' : '';
}

/** คำอธิบายสั้น ๆ ว่าทำไมได้รหัสนี้ (โชว์ใต้ช่อง) */
export function expenseCodeReason(rows: ReadonlyArray<RowLike>): string {
  const roles = new Set(rows.map(r => String(r.driver_role ?? '').trim()).filter(Boolean));
  const fleets = [...new Set(rows.map(r => String(r.fleet ?? '').trim()).filter(Boolean))];
  if (roles.has('พจร.')) return 'มี พจร. ในใบ → รถร่วม';
  const parts = [...(roles.size ? [[...roles].join('/')] : []), ...(fleets.length ? [fleets.join('/')] : [])];
  return parts.length ? `จาก ${parts.join(' · ')}` : '';
}

export const expenseCodeLabel = (code: string | null | undefined) => costCenterLabel(code);

/** รหัสที่พิมพ์บนใบ/รายงาน: รหัสใบสำคัญจ่าย ถ้าไม่มี (สกท / ไม่มีคนขับ) ใช้รหัสแผนกผู้เบิก */
export function claimExpenseCode(claim: Pick<PettyClaim, 'expense_code' | 'cost_center'>): string {
  return claim.expense_code || claim.cost_center || '';
}
