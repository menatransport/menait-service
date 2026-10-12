import type { PettySpec, PettySpecAttachment, PettySpecField } from '@/app/finance/types-petty';
import type { PettyItemDraft } from '@/lib/finance/petty-items';

export function isItemBased(spec: PettySpec | null | undefined): boolean {
  return spec?.item_based === true;
}

export function headerFields(spec: PettySpec | null | undefined): PettySpecField[] {
  return spec?.header_fields ?? [];
}

export function itemFields(spec: PettySpec | null | undefined): PettySpecField[] {
  return spec?.item_fields ?? [];
}

export function requiredAttachments(spec: PettySpec | null | undefined): PettySpecAttachment[] {
  return (spec?.attachments ?? []).filter(a => a.required === true);
}

/** แถวเปล่าตาม spec — ช่อง `truck` แตกเป็น truck_code/truck_plate เพราะด่านซ้ำเข้มใช้ทั้งคู่เป็นคีย์ */
export function blankItem(spec: PettySpec | null | undefined): PettyItemDraft & Record<string, unknown> {
  const row: Record<string, unknown> = { qty: 1 };
  for (const field of itemFields(spec)) {
    if (field.key === 'truck') { row.truck_code = ''; row.truck_plate = ''; continue; }
    // ประเภทที่ให้กรอกจำนวนเอง (ยางนับเป็นเส้น) เริ่มที่ 1 ไม่ใช่ช่องว่าง
    row[field.key] = field.key === 'qty' ? 1 : '';
  }
  return row as PettyItemDraft & Record<string, unknown>;
}

/** payload ที่ส่งไป BFF — ไม่มี amount และไม่มี created_by (BE คำนวณ / BFF เติมจาก session) */
export function claimPayload(
  form: Record<string, unknown>,
  items: readonly PettyItemDraft[],
): Record<string, unknown> & { items: PettyItemDraft[] } {
  const { amount: _amount, created_by: _createdBy, ...rest } = form;
  return { ...rest, items: items.filter(i => String(i.rate ?? '').trim() !== '') };
}

/** ประเภทยอดเดียว: หัวใบกลายเป็นรายการลูกหนึ่งแถว ตารางเดียวจึงรองรับทั้งสองแบบ */
export function singleItemFrom(form: Record<string, unknown>): PettyItemDraft {
  return {
    event_date: String(form.event_date ?? ''),
    truck_code: (form.truck_code as string) ?? null,
    truck_plate: (form.truck_plate as string) ?? null,
    // ค่าทางด่วนใช้เลขที่ใบเสร็จ ค่าเดินทางใช้ Trip Code — ทั้งคู่ลงช่องเดียวกันของรายการ
    ref_no: ((form.ref_no ?? form.receipt_no) as string) ?? null,
    qty: 1,
    rate: form.rate as number,
    remark: (form.remark as string) ?? null,
  };
}
