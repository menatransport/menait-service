import type { AdvanceStatus } from '@/lib/finance/status';

export interface Requester {
  employee_id: string;
  name: string | null;
  department: string | null;
  site: string | null;
  site_code: string | null;
  position?: string | null;
}

export interface ClearItem {
  line_no: number;
  expense_date: string;
  vehicle: string | null;
  has_receipt: boolean;
  description: string;
  amount_before_vat: number;
  vat_amount: number;
  total_amount: number;
  wht_amount: number;
  net_amount: number;
}

export interface FinInfo {
  acc_code: string | null;
  acc_name: string | null;
  voucher_no: string | null;
  voucher_date: string | null;
  payment_doc_no: string | null;
  purpose: string | null;
  amount_paid: number | null;
  transfer_date: string | null;
  clear_due_date: string | null;
  paid_by: string | null;
  paid_at: string | null;
  clear_date: string | null;
  amount_actual: number | null;
  clear_doc_no: string | null;
  clear_items?: ClearItem[];
  settle_amount: number | null;
  settle_date: string | null;
  remark: string | null;
  clear_submitted_at: string | null;
  review_remark: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closed_by_name?: string | null;
  paid_by_name?: string | null;
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
  request: RequestInfo;
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
  changes: Record<string, unknown> | null; // usually [before, after]; tolerate scalars
  remark: string | null;
  action_by: string | null;
  created_at: string | null;
}

export interface AdvanceDetail extends AdvanceItem {
  approval?: ApprovalTierInfo | null;
  approval_logs: ApprovalLog[];
  fin_logs: FinLog[];
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

export interface RequestInfo {
  purpose: string | null;
  amount: number | null;
  use_date: string | null;
  cost_center?: string | null;
  bank?: string | null;
  bank_label?: string | null;
  account_no?: string | null;
  account_name?: string | null;
}

export interface ApprovalStep { step: number; required_level: number; label: string }
export interface StepApproval { step: number; employee_id: string | null; name: string | null; action_at: string | null }

export interface ApprovalTierInfo {
  clause: string;
  approver_label: string;
  required_level: number;
  /** Two-step chain (absent on an old BE = single step). */
  steps?: ApprovalStep[];
  current_step?: number | null;
  /** Current round only. */
  step_approvals?: StepApproval[];
}

export interface PendingApprovalItem {
  form_id: string;
  submission_id: number;
  created_at: string | null;
  requester: Requester;
  request: RequestInfo;
  tier: ApprovalTierInfo;
  step?: number;
  total_steps?: number;
  tab: 'mine' | 'delegable';
}

export interface SuggestedApprover {
  employee_id: string;
  name: string | null;
  position: string | null;
  department: string | null;
}

export interface SuggestedApprovers {
  requester_employee_id: string;
  clause: string;
  approver_label: string;
  required_level: number;
  /** Current step of a two-step chain (absent on an old BE). */
  step?: number | null;
  total_steps?: number | null;
  approvers: SuggestedApprover[];
}
