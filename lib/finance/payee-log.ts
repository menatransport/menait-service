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

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

/** Render a log `changes` object as "field: before → after" lines; scalars render as "field: value". */
export function formatPayeeChanges(changes: unknown): string[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes as Record<string, unknown>).map(([field, v]) => {
    const label = PAYEE_LOG_FIELD_LABELS[field] ?? field;
    return Array.isArray(v) ? `${label}: ${show(v[0])} → ${show(v[1])}` : `${label}: ${show(v)}`;
  });
}
