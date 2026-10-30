import type { AdvanceSummary } from './advanceQuery';

/** The statuses that hold paid-out money not yet closed (ตีกลับผู้เบิก is before payment, so it has none).
 * Colors: validated categorical slots 1–4 in this fixed order (adjacent pairs stay apart for color-blind readers). */
export const OUTSTANDING_PARTS = [
  { status: 'AWAITING_CLEARING', label: 'จ่ายแล้วรอเคลียร์', color: '#2a78d6' },
  { status: 'CLEARING_APPROVAL', label: 'รออนุมัติเคลียร์', color: '#eb6834' },
  { status: 'AWAITING_REVIEW', label: 'รอบัญชีตรวจ', color: '#1baf7a' },
  { status: 'SENT_BACK', label: 'ส่งกลับแก้ไข', color: '#eda100' },
] as const;

export interface OutstandingCard {
  key: string;
  label: string;
  amount: number;
  hint: string;
  color?: string;
  tone?: 'total' | 'alert';
}

/**
 * ยอดค้างเคลียร์ card, one card per status inside it, then เกินกำหนด (already part of the total, said so on the card).
 * Money in any other status (should not happen) shows as one "สถานะอื่น" card so the cards still add up to the total.
 * null = the BE does not send the split yet.
 */
export function outstandingCards(summary: AdvanceSummary | null | undefined): OutstandingCard[] | null {
  const by = summary?.outstanding_by_status;
  if (!summary || !by) return null;
  const count = (status: string) => summary.counts?.[status] ?? 0;
  const parts = OUTSTANDING_PARTS.map(p => ({
    key: p.status, label: p.label, amount: by[p.status] ?? 0, hint: `${count(p.status)} ใบ`, color: p.color,
  }));
  const total = summary.outstanding_amount ?? 0;
  const other = Math.round((total - parts.reduce((n, p) => n + p.amount, 0)) * 100) / 100;
  const tickets = OUTSTANDING_PARTS.reduce((n, p) => n + count(p.status), 0);
  return [
    { key: 'total', label: 'ยอดค้างเคลียร์ (บาท)', amount: total, hint: `${tickets} ใบ รวมทุกสถานะ`, tone: 'total' },
    ...parts,
    ...(other >= 0.01 ? [{ key: 'other', label: 'สถานะอื่น', amount: other, hint: 'ไม่อยู่ใน 4 สถานะข้างหน้า' }] : []),
    { key: 'overdue', label: 'เกินกำหนดเคลียร์', amount: summary.overdue_amount ?? 0,
      hint: `${summary.overdue ?? 0} ใบ (อยู่ในยอดรวมแล้ว)`, tone: 'alert' },
  ];
}
