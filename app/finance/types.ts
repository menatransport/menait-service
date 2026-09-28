import type { AdvanceStatus } from '@/lib/finance/status';

export interface Requester {
  employee_id: string;
  name: string | null;
  department: string | null;
  site: string | null;
  site_code: string | null;
}

export interface FinInfo {
  acc_code: string | null;
  acc_name: string | null;
  voucher_no: string | null;
  voucher_date: string | null;
  payment_doc_no: string | null;
  purpose: string | null;
  amount_paid: number;
  transfer_date: string;
  clear_due_date: string;
  paid_by: string | null;
  paid_at: string | null;
  clear_date: string | null;
  amount_actual: number | null;
  clear_doc_no: string | null;
  settle_amount: number | null;
  settle_date: string | null;
  remark: string | null;
  clear_submitted_at: string | null;
  review_remark: string | null;
  closed_by: string | null;
  closed_at: string | null;
  fin_status: string;
}

export interface AdvanceItem {
  form_id: string;
  submission_id: number;
  created_at: string | null;
  status_approve: string;
  status: AdvanceStatus;
  status_label: string;
  overdue: boolean;
  requester: Requester;
  request: { purpose: string | null; amount: number | null; use_date: string | null };
  fin: FinInfo | null;
}

export interface ApprovalLog {
  level_no: number;
  action: string;
  remark: string | null;
  action_at: string | null;
  actor_name: string | null;
}

export interface FinLog {
  action: string;
  changes: Record<string, [unknown, unknown]> | null;
  remark: string | null;
  action_by: string | null;
  created_at: string | null;
}

export interface AdvanceDetail extends AdvanceItem {
  approval_logs: ApprovalLog[];
  fin_logs: FinLog[];
}

export interface FinAccount {
  acc_code: string;
  acc_name: string;
  acc_name_en: string | null;
  is_active: boolean;
}

export type AttachmentFolder = 'request' | 'pay' | 'clear' | 'check';

export interface AttachmentFile {
  key: string;
  fileName: string;
  url: string;
  size: number;
  lastModified: string;
  folder: AttachmentFolder;
}
