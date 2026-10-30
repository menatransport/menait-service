/**
 * flow v2 (ผู้ใช้สั่ง 29/10/2026): ขออนุมัติ → เจ้าของเงินสดอนุมัติพร้อมจ่าย → ส่งเคลียร์เป็นรอบ
 * → หัวหน้าตามสายงานอนุมัติเคลียร์ → บัญชีตรวจ (ผ่าน → ตั้งเบิก/ทำจ่าย → ปิด · ไม่ผ่าน → ตีกลับ)
 * flow v3 (ผู้ใช้สั่ง 30/10/2026): หัวหน้าของผู้ขอเบิกอนุมัติก่อน เจ้าของเงินสดถึงโอนได้ (PENDING_HEAD)
 * ต้องตรงกับ services/finance/petty_logic.py — BE เป็นผู้ตัดสินจริง ตรงนี้ไว้ปิดปุ่มและเขียนป้าย
 */
export type PettyStatus =
  | 'PENDING_HEAD' | 'PENDING_APPROVAL' | 'RETURNED' | 'APPROVED' | 'CLEAR_PENDING'
  | 'AWAITING_REVIEW' | 'SENT_BACK' | 'REVIEWED' | 'CLOSED'
  /** flow เดิม (โอนแยกขั้น) เลิกใช้แล้ว — เก็บไว้ให้ใบเก่ายังมีป้าย */
  | 'TRANSFERRED';

export const PETTY_STATUS_LABELS: Record<PettyStatus, string> = {
  PENDING_HEAD: 'รอหัวหน้าอนุมัติ',
  PENDING_APPROVAL: 'รอเจ้าของเงินสดอนุมัติ',
  RETURNED: 'ตีกลับผู้เบิก',
  APPROVED: 'อนุมัติจ่ายแล้ว รอส่งเคลียร์',
  CLEAR_PENDING: 'รอหัวหน้าอนุมัติเคลียร์',
  AWAITING_REVIEW: 'รอบัญชีตรวจ',
  SENT_BACK: 'ส่งกลับแก้ไข',
  REVIEWED: 'บัญชีตรวจผ่าน รอตั้งเบิก',
  CLOSED: 'ปิดแล้ว',
  TRANSFERRED: 'โอนแล้ว (ขั้นตอนเดิม)',
};

// สีเดียวกับชุดของ Advance (lib/finance/status.ts) เพื่อให้ป้ายสองโมดูลอ่านเหมือนกัน
export const PETTY_STATUS_STYLES: Record<PettyStatus, string> = {
  PENDING_HEAD: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  RETURNED: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-brand-50 text-brand-700 border-brand-200',
  CLEAR_PENDING: 'bg-sky-50 text-sky-700 border-sky-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  SENT_BACK: 'bg-orange-50 text-sun-700 border-orange-200',
  REVIEWED: 'bg-teal-50 text-teal-700 border-teal-200',
  CLOSED: 'bg-emerald-50 text-mint-700 border-emerald-200',
  TRANSFERRED: 'bg-slate-50 text-ink-700 border-slate-200',
};

export const PETTY_ALLOWED: Record<PettyStatus, PettyStatus[]> = {
  PENDING_HEAD: ['PENDING_APPROVAL', 'RETURNED'],
  PENDING_APPROVAL: ['APPROVED', 'RETURNED'],
  RETURNED: ['PENDING_HEAD'],
  APPROVED: ['CLEAR_PENDING'],
  CLEAR_PENDING: ['AWAITING_REVIEW', 'APPROVED'],
  AWAITING_REVIEW: ['REVIEWED', 'SENT_BACK'],
  SENT_BACK: ['AWAITING_REVIEW'],
  REVIEWED: ['CLOSED'],
  CLOSED: [],
  TRANSFERRED: [],
};

export function canGo(from: PettyStatus, to: PettyStatus): boolean {
  return PETTY_ALLOWED[from]?.includes(to) ?? false;
}

/** รอบส่งเคลียร์ — ชุดใบของกองทุนเดียวพร้อมใบปะหน้า */
export type PettyRoundStatus =
  | 'CLEAR_PENDING' | 'CLEAR_REJECTED' | 'AWAITING_REVIEW' | 'REVIEWED' | 'VOUCHERED' | 'CLOSED';

export const PETTY_ROUND_LABELS: Record<PettyRoundStatus, string> = {
  CLEAR_PENDING: 'รอหัวหน้าอนุมัติเคลียร์',
  CLEAR_REJECTED: 'หัวหน้าไม่อนุมัติ',
  AWAITING_REVIEW: 'รอบัญชีตรวจ',
  REVIEWED: 'ตรวจผ่าน รอตั้งเบิก',
  VOUCHERED: 'ตั้งเบิกแล้ว รอทำจ่าย',
  CLOSED: 'จ่ายแล้ว ปิดรอบ',
};

export const PETTY_ROUND_STYLES: Record<PettyRoundStatus, string> = {
  CLEAR_PENDING: 'bg-sky-50 text-sky-700 border-sky-200',
  CLEAR_REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  REVIEWED: 'bg-teal-50 text-teal-700 border-teal-200',
  VOUCHERED: 'bg-brand-50 text-brand-700 border-brand-200',
  CLOSED: 'bg-emerald-50 text-mint-700 border-emerald-200',
};
