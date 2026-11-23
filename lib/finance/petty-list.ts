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
  /** alert = ตัวเลขแท็บเป็นสีแดงเมื่อมีใบ (เช่น ต้องแก้ไข) */
  tone?: 'alert';
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

/** ขั้นตอนหลักของใบ ซ้าย→ขวา ตาม swimlane v3.2 · แต่ละขั้นบอกว่าใบ "กำลังรอ" อะไร (at = สถานะที่ใบรอที่ขั้นนี้)
 * ขั้น "หัวหน้าอนุมัติ" มีเฉพาะเมื่อยอดเกินอำนาจเจ้าของเงินสดตาม TOA (7/11/2026) ใบที่ข้ามจะเห็นเป็นผ่านแล้ว
 * ตีกลับคือ "หลุดราง" อยู่ที่ขั้นที่ต้องทำซ้ำ · 23/11/2026 แก้ใบรอเจ้าของเงินสดที่เคยไฮไลต์ขั้นหัวหน้า + เพิ่มขั้นส่งเคลียร์ */
export const FLOW_STEPS: { key: string; label: string; at: PettyStatus[] }[] = [
  { key: 'submit', label: 'ขออนุมัติ', at: ['RETURNED'] },
  { key: 'head', label: 'หัวหน้า (ถ้าเกิน TOA)', at: ['PENDING_HEAD'] },
  { key: 'holder', label: 'เจ้าของเงินสดอนุมัติ', at: ['PENDING_APPROVAL'] },
  { key: 'round', label: 'ส่งเคลียร์', at: ['APPROVED', 'TRANSFERRED'] },
  { key: 'clear', label: 'หัวหน้าอนุมัติเคลียร์', at: ['CLEAR_PENDING'] },
  { key: 'review', label: 'บัญชีตรวจ', at: ['AWAITING_REVIEW', 'SENT_BACK'] },
  { key: 'pay', label: 'ตั้งเบิก/ทำจ่าย', at: ['REVIEWED'] },
  { key: 'closed', label: 'ปิด', at: ['CLOSED'] },
];

export function flowPosition(status: PettyStatus): { index: number; offTrack: boolean } {
  const index = Math.max(0, FLOW_STEPS.findIndex(s => s.at.includes(status)));
  return { index, offTrack: status === 'RETURNED' || status === 'SENT_BACK' };
}

export const statusLabel = (status: PettyStatus) => PETTY_STATUS_LABELS[status];

/** ใบที่จ่ายในช่วงวันที่ (รวมปลายทั้งสองข้าง) — ใช้รวมรอบส่งเคลียร์ตามช่วงวัน · เว้นปลายไหน = ไม่จำกัดฝั่งนั้น */
export function paidInRange(claim: PettyClaim, from: string, to: string): boolean {
  if (!from && !to) return true;
  const day = claim.transfer_date?.slice(0, 10);
  if (!day) return false;
  return (!from || day >= from) && (!to || day <= to);
}
