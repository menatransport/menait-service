import { normalizeAccountNo } from './bank';

/** adv_payee_type option values (spec §3). */
export const PAYEE_SELF = 'SELF';
export const PAYEE_SUPPLIER = 'SUPPLIER';

export const KBANK_ACCOUNT_ERROR = 'เลขที่บัญชีกสิกรไทยต้องมี 10 หลัก';

export type PayeeAccountStatus = 'ACTIVE' | 'INACTIVE';
export type PayeeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type PayeeAccount = {
  id: number;
  employee_id: string;
  employee_name: string | null;
  department: string | null;
  bank: string;
  account_no: string;
  account_name: string;
  status: PayeeAccountStatus;
  source_request_id: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
};

export type PayeeRequest = {
  id: number;
  employee_id: string;
  employee_name: string | null;
  department: string | null;
  position: string | null;
  bank: string;
  account_no: string;
  account_name: string;
  remark: string | null;
  status: PayeeRequestStatus;
  review_remark: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  current_account: { account_no: string; account_name: string; status: PayeeAccountStatus } | null;
};

export type PayeeMe = { account: PayeeAccount | null; request: PayeeRequest | null };

export type SelfPayeeState = 'ready' | 'ready_change_pending' | 'pending' | 'rejected' | 'none';

/** K-Bank employee account: exactly 10 digits after stripping spaces and dashes. */
export function kbankAccountError(raw: string | null | undefined): string | null {
  return /^[0-9]{10}$/.test(normalizeAccountNo(raw)) ? null : KBANK_ACCOUNT_ERROR;
}

export function selfPayeeState(me: Partial<PayeeMe> | null | undefined): SelfPayeeState {
  const active = me?.account?.status === 'ACTIVE';
  const reqStatus = me?.request?.status;
  if (active) return reqStatus === 'PENDING' ? 'ready_change_pending' : 'ready';
  if (reqStatus === 'PENDING') return 'pending';
  if (reqStatus === 'REJECTED') return 'rejected';
  return 'none';
}

/** Whether the ADV form may be submitted given the payee choice. */
export function canSubmitPayee(type: string, state: SelfPayeeState, supplierFileCount: number): boolean {
  if (type === PAYEE_SELF) return state === 'ready' || state === 'ready_change_pending';
  if (type === PAYEE_SUPPLIER) return supplierFileCount >= 1;
  return false;
}

export const PAYEE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const PAYEE_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Keep [\w.-] and Thai; everything else becomes "_". Prefixed with a timestamp by the caller. */
export function sanitizePayeeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').normalize('NFC');
  const cleaned = base.replace(/[^\w.฀-๿-]+/g, '_').replace(/^\.+/, '').slice(-100);
  return cleaned || 'file';
}
