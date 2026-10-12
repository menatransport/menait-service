export type PettySpecField = {
  key: string; label: string; type: string; required?: boolean;
  options?: string[]; auto?: string; auto_from?: string; search?: string[];
};
export type PettySpecAttachment = { key: string; label: string; required?: boolean; max?: number; note?: string };
export type PettySpec = {
  item_based?: boolean;
  item_label?: string;
  header_fields?: PettySpecField[];
  item_fields?: PettySpecField[];
  attachments?: PettySpecAttachment[];
  rules?: { when: string; require_field?: string; require_attachment?: string; at: string }[];
  duplicate_check?: {
    scope?: 'item' | 'claim';
    hard?: { keys: string[]; days: number; action: string; override?: boolean };
    soft?: { keys: string[]; days: number; action: string; override?: string };
  };
  prints?: string[];
  atms?: { sku?: string; product_group?: string; unit?: string; vat?: number };
};
export type PettyExpenseType = {
  code: string; name_th: string; atms_sku: string | null; sort_order: number; is_active: boolean; spec: PettySpec;
};
export type PettyFund = {
  id: number; branch_code: string; division_code: string;
  holder_employee_id: string; fund_limit: number | null; is_active: boolean;
};
export type PettyClaimItem = {
  id?: number; line_no?: number; event_date: string;
  truck_code?: string | null; truck_plate?: string | null; truck_type?: string | null;
  ref_no?: string | null; qty: number; rate: number; amount: number; remark?: string | null;
};
export type PettyClaim = {
  id: number; form_id: string; project_code: string | null; fund_id: number; expense_type: string;
  expense_date: string; period_from: string | null; period_to: string | null;
  driver_employee_id: string | null; driver_name: string | null; payee_name: string | null;
  amount: number; dd_no: string | null; receipt_no: string | null;
  status: import('@/lib/finance/petty-status').PettyStatus;
  created_by: string; approved_by: string | null; approved_at: string | null;
  transfer_date: string | null; review_remark: string | null; return_reason: string | null;
  reviewed_by: string | null; reviewed_at: string | null; submitted_to_acc_at: string | null;
  dup_override_reason: string | null; batch_id: number | null;
  items: PettyClaimItem[];
};
export type PettyBalance = {
  fund_id: number; holder_employee_id: string;
  advance_outstanding: number; petty_committed: number; available: number; fund_limit: number | null;
};
