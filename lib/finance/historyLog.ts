import { LOG_ACTION_LABELS } from '@/app/finance/labels';
import type { FinLog } from '@/app/finance/types';

/** หนึ่งแถวในประวัติฝั่งการเงิน (รวมการอนุมัติเคลียร์) */
export interface HistoryRow {
  key: string;
  label: string;
  actor: string | null;
  at: string | null;
  remark: string | null;
  changes: FinLog['changes'];
  action: string;
}

export interface ClearLog {
  step: number;
  action: string;
  clause?: string | null;
  remark: string | null;
  action_by: string | null;
  created_at: string | null;
}

/**
 * ประวัติการเงิน + การอนุมัติเคลียร์ เรียงตามเวลา
 * ขั้น SUBMITTED ซ้ำกับ CLEAR_SUBMIT และ REJECTED ซ้ำกับ CLEAR_REJECT ของฝั่งการเงิน จึงเอาเฉพาะ APPROVED มาแทรก
 */
export function financeHistory(finLogs: FinLog[], clearLogs: ClearLog[] | undefined): HistoryRow[] {
  const rows: HistoryRow[] = finLogs.map((l, i) => ({
    key: `f-${i}`, action: l.action, label: LOG_ACTION_LABELS[l.action] ?? l.action,
    actor: l.action_by, at: l.created_at, remark: l.remark, changes: l.changes,
  }));
  (clearLogs ?? []).forEach((l, i) => {
    if (l.action !== 'APPROVED') return;
    rows.push({ key: `c-${i}`, action: 'CLEAR_APPROVE', label: `อนุมัติการเคลียร์ ขั้น ${l.step}`,
      actor: l.action_by, at: l.created_at, remark: l.remark, changes: null });
  });
  const t = (s: string | null) => (s ? Date.parse(s) : 0);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => t(a.r.at) - t(b.r.at) || a.i - b.i).map(x => x.r);
}

/** ข้อความหลังกดส่งเคลียร์ บอกตามสถานะที่ได้กลับมาจริง */
export function clearSubmittedTitle(status: string | undefined): string {
  if (status === 'CLEARING_APPROVAL') return 'ส่งเคลียร์เงินแล้ว รอหัวหน้าอนุมัติการเคลียร์';
  if (status === 'AWAITING_REVIEW') return 'ส่งเคลียร์เงินแล้ว รอบัญชีตรวจ';
  return 'ส่งเคลียร์เงินแล้ว';
}

/** ป๊อปอัป "มีใบคำขอเบิกใหม่รอตั้งเบิก" เปิดหน้างานการเงิน ซึ่งมีฟอร์มตั้งเบิก */
export const voucherInboxHref = (formId: string) => `/finance/${formId}`;
