import { formatAccountNo } from './bank';

export const PAYEE_LOG_ACTION_LABELS: Record<string, string> = {
  REQUEST: 'ส่งคำขอ',
  REQUEST_CANCEL: 'ยกเลิกคำขอ',
  REQUEST_REJECT: 'ไม่อนุมัติคำขอ',
  APPROVE: 'อนุมัติ → Master',
  CREATE: 'เพิ่มบัญชี',
  UPDATE: 'แก้ไขบัญชี',
  DEACTIVATE: 'ปิดใช้งาน',
  REACTIVATE: 'เปิดใช้งาน',
};

export const PAYEE_LOG_FIELD_LABELS: Record<string, string> = {
  account_no: 'เลขที่บัญชี',
  account_name: 'ชื่อบัญชี',
  status: 'สถานะ',
};

export const PAYEE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
  PENDING: 'รอตรวจ',
  APPROVED: 'อนุมัติ',
  REJECTED: 'ไม่อนุมัติ',
  CANCELLED: 'ยกเลิก',
};

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

/** Render a log `changes` object as "field: before → after" lines; scalars render as "field: value". */
export function formatPayeeChanges(changes: unknown): string[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes as Record<string, unknown>).map(([field, v]) => {
    const label = PAYEE_LOG_FIELD_LABELS[field] ?? field;
    const fmt = (x: unknown) => {
      if (x === null || x === undefined || x === '') return '-';
      if (field === 'account_no') return formatAccountNo(String(x));
      if (field === 'status') return PAYEE_STATUS_LABELS[String(x)] ?? String(x);
      return show(x);
    };
    return Array.isArray(v) ? `${label}: ${fmt(v[0])} → ${fmt(v[1])}` : `${label}: ${fmt(v)}`;
  });
}
