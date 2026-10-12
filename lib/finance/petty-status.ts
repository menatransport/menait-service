export type PettyStatus =
  | 'PENDING_APPROVAL' | 'RETURNED' | 'APPROVED' | 'TRANSFERRED'
  | 'AWAITING_REVIEW' | 'SENT_BACK' | 'CLOSED';

export const PETTY_STATUS_LABELS: Record<PettyStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  RETURNED: 'ตีกลับผู้เบิก',
  APPROVED: 'อนุมัติแล้ว รอโอน',
  TRANSFERRED: 'โอนแล้ว รอเคลียร์เอกสาร',
  AWAITING_REVIEW: 'รอบัญชีตรวจ',
  SENT_BACK: 'ส่งกลับแก้ไข',
  CLOSED: 'คืนยอดแล้ว',
};

// สีเดียวกับชุดของ Advance (lib/finance/status.ts) เพื่อให้ป้ายสองโมดูลอ่านเหมือนกัน
export const PETTY_STATUS_STYLES: Record<PettyStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  RETURNED: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-brand-50 text-brand-700 border-brand-200',
  TRANSFERRED: 'bg-slate-50 text-ink-700 border-slate-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  SENT_BACK: 'bg-orange-50 text-sun-700 border-orange-200',
  CLOSED: 'bg-emerald-50 text-mint-700 border-emerald-200',
};

/** ต้องตรงกับ services/finance/petty_logic.py ALLOWED — BE เป็นผู้ตัดสินจริง อันนี้ไว้ปิดปุ่ม */
export const PETTY_ALLOWED: Record<PettyStatus, PettyStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'RETURNED'],
  RETURNED: ['PENDING_APPROVAL'],
  APPROVED: ['TRANSFERRED'],
  TRANSFERRED: ['AWAITING_REVIEW'],
  AWAITING_REVIEW: ['CLOSED', 'SENT_BACK'],
  SENT_BACK: ['AWAITING_REVIEW'],
  CLOSED: [],
};

export function canGo(from: PettyStatus, to: PettyStatus): boolean {
  return PETTY_ALLOWED[from]?.includes(to) ?? false;
}
