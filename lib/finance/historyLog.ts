import { LOG_ACTION_LABELS } from '@/app/finance/labels';
import type { ApprovalLog, FinLog } from '@/app/finance/types';

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
  action_by_name?: string | null;
  created_at: string | null;
}

/**
 * ประวัติการเงิน + การอนุมัติเคลียร์ เรียงตามเวลา
 * ขั้น SUBMITTED ซ้ำกับ CLEAR_SUBMIT และ REJECTED ซ้ำกับ CLEAR_REJECT ของฝั่งการเงิน จึงเอาเฉพาะ APPROVED มาแทรก
 */
export function financeHistory(finLogs: FinLog[], clearLogs: ClearLog[] | undefined): HistoryRow[] {
  const rows: HistoryRow[] = finLogs.map((l, i) => ({
    key: `f-${i}`, action: l.action, label: LOG_ACTION_LABELS[l.action] ?? l.action,
    actor: l.action_by_name ?? l.action_by, at: l.created_at, remark: l.remark, changes: l.changes,
  }));
  (clearLogs ?? []).forEach((l, i) => {
    if (l.action !== 'APPROVED') return;
    rows.push({ key: `c-${i}`, action: 'CLEAR_APPROVE', label: `อนุมัติการเคลียร์ ขั้น ${l.step}`,
      actor: l.action_by_name ?? l.action_by, at: l.created_at, remark: l.remark, changes: null });
  });
  const t = (s: string | null) => (s ? Date.parse(s) : 0);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => t(a.r.at) - t(b.r.at) || a.i - b.i).map(x => x.r);
}

// ค่าที่ระบบเปลี่ยนเองตอนส่งใหม่ ไม่ใช่สิ่งที่ผู้เบิกแก้ ไม่ต้องโชว์ในประวัติ
const INTERNAL_FIELDS = new Set(['fin_status', 'status_approve', 'current_approval_level']);

function visibleChanges(changes: FinLog['changes']): FinLog['changes'] {
  if (!changes) return changes;
  const kept = Object.fromEntries(Object.entries(changes).filter(([k]) => !INTERNAL_FIELDS.has(k)));
  return Object.keys(kept).length ? kept : null;
}

/**
 * ประวัติทั้งใบในเส้นเวลาเดียว: การอนุมัติเบิก + การเงิน + อนุมัติเคลียร์
 * เครื่องหมาย RESUBMITTED ฝั่งอนุมัติซ้ำกับ RESUBMIT ฝั่งการเงิน (ตัวหลังมีรายการที่แก้) จึงเก็บแค่ตัวหลัง
 */
export function fullHistory(approvalLogs: ApprovalLog[], finLogs: FinLog[], clearLogs: ClearLog[] | undefined): HistoryRow[] {
  const hasFinResubmit = finLogs.some(l => l.action === 'RESUBMIT');
  const approvals: HistoryRow[] = approvalLogs
    .filter(l => !(hasFinResubmit && l.action === 'RESUBMITTED'))
    .map((l, i) => ({ key: `a-${i}`, action: l.action, label: LOG_ACTION_LABELS[l.action] ?? l.action,
      actor: l.actor_name, at: l.action_at, remark: l.remark, changes: null }));
  const fin = financeHistory(finLogs, clearLogs).map(r => ({ ...r, changes: visibleChanges(r.changes) }));
  const t = (s: string | null) => (s ? Date.parse(s) : 0);
  return [...approvals, ...fin].map((r, i) => ({ r, i })).sort((a, b) => t(a.r.at) - t(b.r.at) || a.i - b.i).map(x => x.r);
}

/** ข้อความหลังกดส่งเคลียร์ บอกตามสถานะที่ได้กลับมาจริง */
export function clearSubmittedTitle(status: string | undefined): string {
  if (status === 'CLEARING_APPROVAL') return 'ส่งเคลียร์เงินแล้ว รอหัวหน้าอนุมัติการเคลียร์';
  if (status === 'AWAITING_REVIEW') return 'ส่งเคลียร์เงินแล้ว รอบัญชีตรวจ';
  return 'ส่งเคลียร์เงินแล้ว';
}

/** ป๊อปอัป "มีใบคำขอเบิกใหม่รอตั้งเบิก" เปิดหน้างานการเงิน ซึ่งมีฟอร์มตั้งเบิก */
export const voucherInboxHref = (formId: string) => `/finance/${formId}`;

/** หัวกล่องสีส้มตอนใบถูกส่งกลับให้ผู้เบิกเคลียร์ใหม่ — บอกว่าใครส่งกลับ ดูจากครั้งล่าสุด */
export function sentBackLabel(finLogs: FinLog[]): string {
  const last = [...finLogs].reverse().find(l => l.action === 'CLEAR_REJECT' || l.action === 'SEND_BACK');
  if (last?.action === 'CLEAR_REJECT') return 'หัวหน้าไม่อนุมัติการเคลียร์';
  if (last?.action === 'SEND_BACK') return 'บัญชีส่งกลับแก้ไข';
  return 'ส่งกลับแก้ไข';
}
