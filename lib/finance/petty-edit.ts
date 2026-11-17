import type { PettyClaim } from '@/app/finance/types-petty';
import type { PettyItemDraft } from './petty-items';

/**
 * แก้ใบที่ถูกตีกลับ (ผู้ใช้สั่ง 17/11/2026): ผู้เปิดใบแก้รายการ/ยอด/หัวใบได้ แล้วส่งขออนุมัติใหม่
 * BE (PUT /claims/{id}) รับอยู่แล้ว — ประเภทกับวงเงินเปลี่ยนไม่ได้ (BE ไม่รับสองช่องนี้ตอนแก้)
 */
export const EDITABLE_STATUS = 'RETURNED';

export function canEditReturned(claim: Pick<PettyClaim, 'status' | 'created_by'> | null | undefined,
  employeeId: string | null | undefined): boolean {
  return !!claim && !!employeeId && claim.status === EDITABLE_STATUS && String(claim.created_by) === String(employeeId);
}

/** แถวรายการของใบ → แถวที่ฟอร์มแก้/ส่ง BE ได้ (ชุดช่องเดียวกับตอนเปิดใบ) */
export function itemDraftsFrom(claim: Pick<PettyClaim, 'items'>): (PettyItemDraft & Record<string, unknown>)[] {
  return claim.items.map(i => ({
    event_date: i.event_date, truck_code: i.truck_code ?? null, truck_plate: i.truck_plate ?? null,
    truck_type: i.truck_type ?? null, ref_no: i.ref_no ?? null, qty: i.qty, rate: i.rate,
    remark: i.remark ?? null, driver_name: i.driver_name ?? null,
    driver_role: i.driver_role ?? null, tire_position: i.tire_position ?? null,
    fleet: i.fleet ?? null, driver_code: i.driver_code ?? null,
  }));
}

export type EditPrefill = {
  typeCode: string; fundId: string; costCenter: string;
  header: Record<string, unknown>; rows: (PettyItemDraft & Record<string, unknown>)[];
  ddNo: string; wht: string; expenseCode: string;
};

/** ค่าตั้งต้นของฟอร์มจากใบเดิม · หัวใบ = detail ที่เก็บไว้ตอนเปิดใบ + ช่องที่ BE เก็บแยก */
export function editPrefill(claim: PettyClaim): EditPrefill {
  const header: Record<string, unknown> = { ...(claim.detail ?? {}), expense_date: claim.expense_date };
  if (claim.payee_name && header.payee_name === undefined) header.payee_name = claim.payee_name;
  if (claim.receipt_no && header.receipt_no === undefined) header.receipt_no = claim.receipt_no;
  if (claim.driver_employee_id && header.driver_employee_id === undefined) header.driver_employee_id = claim.driver_employee_id;
  if (claim.driver_name && header.driver === undefined) header.driver = claim.driver_name;
  const wht = Number(claim.wht_amount ?? 0);
  return {
    typeCode: claim.expense_type,
    fundId: String(claim.fund_id),
    costCenter: claim.cost_center ?? '',
    header,
    rows: itemDraftsFrom(claim),
    ddNo: claim.dd_no ?? '',
    wht: wht > 0 ? wht.toFixed(2) : '',
    expenseCode: claim.expense_code ?? '',
  };
}

/** ไฟล์ที่แนบไว้แล้ว นับตามหมวด — ใช้รวมกับไฟล์ใหม่ตอนเช็กเอกสารครบ */
export function fileCounts(files: readonly { folder?: string | null }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const k = f.folder ?? 'request';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

/** เตือนซ้ำตอนแก้: แถวของใบนี้เองไม่นับว่าซ้ำ */
export function withoutOwnClaim<T extends { form_id?: string | null }>(hints: T[], formId: string | null | undefined): T[] {
  return formId ? hints.filter(h => h.form_id !== formId) : hints;
}
