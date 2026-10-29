export type PettySpecField = {
  key: string; label: string; type: string; required?: boolean;
  options?: string[]; auto?: string; auto_from?: string; search?: string[];
  /** ค่าตั้งต้นของช่องในแถว/หัวใบใหม่ เช่น พจส. */
  default?: string;
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
  /** หน่วยนับบนใบพิมพ์ (คัน/เส้น/เที่ยว) — คนละเรื่องกับหน่วย SKU ใน atms.unit */
  print?: { unit?: string };
  atms?: { sku?: string; product_group?: string; unit?: string; vat?: number };
};
export type PettyExpenseType = {
  code: string; name_th: string; atms_sku: string | null; sort_order: number; is_active: boolean; spec: PettySpec;
};
export type PettyFund = {
  id: number; branch_code: string; division_code: string;
  holder_employee_id: string; holder_name?: string | null; fund_limit: number | null; is_active: boolean;
};
export type PettyClaimItem = {
  id?: number; line_no?: number; event_date: string;
  truck_code?: string | null; truck_plate?: string | null; truck_type?: string | null;
  ref_no?: string | null; qty: number; rate: number; amount: number; remark?: string | null;
  /** พจส. ต่อแถว (ค่าชั่ง/ยาง/ซ่อม) — ใช้ในใบสรุปรายการ */
  driver_name?: string | null;
  /** "พจส." / "พจร." — มี พจร. ต้องมีเลขที่ใบรับสภาพหนี้ตอนอนุมัติ */
  driver_role?: string | null;
  /** ใบยาง: รหัสตำแหน่งแบบ WMS คั่นด้วย , */
  tire_position?: string | null;
};
export type PettyClaim = {
  id: number; form_id: string; fund_id: number; expense_type: string;
  expense_date: string; period_from: string | null; period_to: string | null;
  driver_employee_id: string | null; driver_name: string | null; payee_name: string | null;
  /** ช่องหัวใบตาม spec.header_fields ของประเภทที่ไม่ใช่รายการรถ (เส้นทาง เหตุผล ฯลฯ) */
  detail?: Record<string, unknown>;
  amount: number; dd_no: string | null; receipt_no: string | null;
  /** หักภาษี ณ ที่จ่าย — ส่งกลับไปตอน "ส่งอีกครั้ง" ไม่งั้นค่าหาย */
  wht_applicable?: boolean;
  status: import('@/lib/finance/petty-status').PettyStatus;
  created_by: string; approved_by: string | null; approved_at: string | null;
  /** ชื่อ-สกุลจาก users — ใบพิมพ์/หน้าจอใช้แทนรหัส (ไม่มี = ใช้รหัส) */
  created_by_name?: string | null; approved_by_name?: string | null;
  transfer_date: string | null; review_remark: string | null; return_reason: string | null;
  reviewed_by: string | null; reviewed_at: string | null; submitted_to_acc_at: string | null;
  dup_override_reason: string | null; batch_id: number | null;
  /** เลขที่ใบรับสภาพหนี้ (มีเมื่อใบมี พจร.) */
  debt_doc_no?: string | null;
  items: PettyClaimItem[];
};
export type PettyBalance = {
  fund_id: number; holder_employee_id: string;
  advance_outstanding: number; petty_committed: number; available: number; fund_limit: number | null;
};

/** รอบส่งเคลียร์ (flow v2 29/10/2026) — ชุดใบของกองทุนเดียว ส่งพร้อมใบปะหน้า */
export type PettyRound = {
  id: number; batch_no: string; fund_id: number;
  status: import('@/lib/finance/petty-status').PettyRoundStatus; status_label: string;
  branch_code: string | null; division_code: string | null;
  holder_employee_id: string | null; holder_name: string | null;
  total_amount: number; remark: string | null; claim_count?: number;
  submitted_by: string | null; submitted_at: string | null; clear_required_level: number | null;
  clear_approved_by: string | null; clear_approved_by_name: string | null; clear_approved_at: string | null;
  clear_reject_reason: string | null;
  voucher_no: string | null; vouchered_by: string | null; vouchered_at: string | null;
  pay_date: string | null; paid_by: string | null; paid_at: string | null;
  closed_by: string | null; closed_at: string | null;
  /** มีเมื่อขอรายละเอียดรอบ */
  claims?: PettyClaim[];
  /** คนที่ขอดูรอบนี้กดอนุมัติเคลียร์ได้ไหม (สายงานรู้ที่ BE) */
  can_clear?: boolean;
};
