/**
 * ตัวช่วยล้วนของหน้ารายการเงินสดย่อย (แท็บ ค้นหา เรียง แบ่งหน้า ปุ่มลัด แถบขั้นตอน)
 * — ไม่มี React ไม่มี fetch เทสต์ได้ตรง ๆ · โครงเดียวกับหน้า Advance (/finance/advance)
 */
import type { PettyClaim } from '@/app/finance/types-petty';
import type { PettyAction } from '@/app/finance/petty-api';
import { PETTY_STATUS_LABELS, type PettyStatus } from '@/lib/finance/petty-status';

export type PettyTab = {
  key: string;
  label: string;
  /** ไม่ระบุ = ทุกสถานะ */
  statuses?: PettyStatus[];
};

export function matchesTab(claim: PettyClaim, tab: PettyTab): boolean {
  return !tab.statuses || tab.statuses.includes(claim.status);
}

export function tabCounts(claims: readonly PettyClaim[], tabs: readonly PettyTab[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tab of tabs) out[tab.key] = claims.filter(c => matchesTab(c, tab)).length;
  return out;
}

/** ค้นจาก เลขที่ใบ · ชื่อ/รหัสผู้เปิดใบ · จ่ายให้ · เลข DD · ชื่อประเภท — ไม่สนตัวพิมพ์ */
export function matchesSearch(claim: PettyClaim, query: string, typeName: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [claim.form_id, claim.created_by_name, claim.created_by, claim.payee_name, claim.dd_no, typeName]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

/** เรียงตามลำดับที่เปิดใบ (id) — ใหม่สุดก่อนเป็นค่าเริ่มต้นเหมือน Advance */
export function sortClaims(claims: readonly PettyClaim[], order: 'asc' | 'desc'): PettyClaim[] {
  return [...claims].sort((a, b) => (order === 'desc' ? b.id - a.id : a.id - b.id));
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

export function paginate<T>(rows: readonly T[], page: number, size: number): T[] {
  return rows.slice((page - 1) * size, page * size);
}

export type PettyRole = 'holder' | 'accounting' | 'mine';
export type QuickAction = { action: PettyAction; label: string };

/** ปุ่มลัดในแถว: ขั้นถัดไปของใบนี้สำหรับคนบทบาทนั้น — null = ไม่มีอะไรให้กดตอนนี้
 * ใบที่อนุมัติจ่ายแล้วไม่มีปุ่มรายใบ เพราะส่งเคลียร์เป็นรอบ (ติ๊กหลายใบแล้วกดส่ง) */
export function quickAction(claim: PettyClaim, role: PettyRole): QuickAction | null {
  if (role === 'holder' && claim.status === 'PENDING_APPROVAL') return { action: 'approve', label: 'อนุมัติจ่าย' };
  if (role === 'accounting' && claim.status === 'AWAITING_REVIEW') return { action: 'review', label: 'ผ่าน' };
  return null;
}

/** ขั้นตอนหลักของใบ ซ้าย→ขวา (flow v2) — ตีกลับคือ "หลุดราง" อยู่ที่ขั้นที่ต้องทำซ้ำ */
export const FLOW_STEPS: { status: PettyStatus; label: string }[] = [
  { status: 'PENDING_APPROVAL', label: 'ขออนุมัติ' },
  { status: 'APPROVED', label: 'เจ้าของเงินสดอนุมัติ' },
  { status: 'CLEAR_PENDING', label: 'หัวหน้าอนุมัติเคลียร์' },
  { status: 'AWAITING_REVIEW', label: 'บัญชีตรวจ' },
  { status: 'REVIEWED', label: 'ตั้งเบิก/ทำจ่าย' },
  { status: 'CLOSED', label: 'ปิด' },
];

export function flowPosition(status: PettyStatus): { index: number; offTrack: boolean } {
  if (status === 'RETURNED') return { index: 0, offTrack: true };
  if (status === 'SENT_BACK') return { index: 3, offTrack: true };
  if (status === 'TRANSFERRED') return { index: 1, offTrack: false };
  return { index: Math.max(0, FLOW_STEPS.findIndex(s => s.status === status)), offTrack: false };
}

export const statusLabel = (status: PettyStatus) => PETTY_STATUS_LABELS[status];
