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

/**
 * หมวดไฟล์ที่เป็นของเจ้าของเงินสด แนบตอนอนุมัติจ่าย ไม่ใช่ของคนเปิดใบ (flow v2: จ่ายเงินแล้วแนบสลิปแล้วอนุมัติในจังหวะเดียว)
 * spec ทุกประเภทติ๊ก `transfer` ว่าบังคับ — บังคับก่อนอนุมัติ แต่ตอนเปิดใบคนเปิดใบยังไม่มีสลิป
 * หน้าเปิดใบ หน้าใบ และการ์ดหน้าอนุมัติ อ่านรายการนี้ที่เดียวกัน
 */
export const HOLDER_ATTACHMENTS = ['transfer'] as const;

export function isHolderAttachment(key: string): boolean {
  return (HOLDER_ATTACHMENTS as readonly string[]).includes(key);
}

/** ไฟล์บังคับที่คนเปิดใบต้องแนบก่อนส่ง = หมวดบังคับทั้งหมด ยกเว้นของเจ้าของเงินสด (แนบมาด้วยได้ แต่ไม่บังคับ) */
export function requiredAtCreate(spec: PettySpec | null | undefined): PettySpecAttachment[] {
  return requiredAttachments(spec).filter(a => !isHolderAttachment(a.key));
}

/** ข้อความบอกคนเปิดใบว่ายังขาดไฟล์ไหน — null = ไฟล์ครบพอส่งได้ */
export function missingAtCreate(spec: PettySpec | null | undefined, counts: Record<string, number>): string | null {
  const missing = requiredAtCreate(spec).find(a => !((counts[a.key] ?? 0) > 0));
  return missing ? `ยังไม่แนบ ${missing.label}` : null;
}

/** แถวเปล่าตาม spec — ช่อง `truck` แตกเป็น truck_code/truck_plate เพราะด่านซ้ำเข้มใช้ทั้งคู่เป็นคีย์ */
export function blankItem(spec: PettySpec | null | undefined): PettyItemDraft & Record<string, unknown> {
  const row: Record<string, unknown> = { qty: 1 };
  for (const field of itemFields(spec)) {
    if (field.key === 'truck') { row.truck_code = ''; row.truck_plate = ''; continue; }
    // ประเภทที่ให้กรอกจำนวนเอง (ยางนับเป็นเส้น) เริ่มที่ 1 ไม่ใช่ช่องว่าง · ช่องที่ spec ตั้ง default (พจส./พจร.) เริ่มที่ค่านั้น
    row[field.key] = field.key === 'qty' ? 1 : (field.default ?? '');
  }
  return row as PettyItemDraft & Record<string, unknown>;
}

/** หัวใบเปล่าตาม spec — วันที่ขอเบิก + ช่องที่ spec ตั้งค่าตั้งต้นไว้ */
export function blankHeader(spec: PettySpec | null | undefined, today: string): Record<string, unknown> {
  const header: Record<string, unknown> = { expense_date: today };
  for (const field of headerFields(spec)) if (field.default !== undefined) header[field.key] = field.default;
  return header;
}

/** payload ที่ส่งไป BFF — ไม่มี amount และไม่มี created_by (BE คำนวณ / BFF เติมจาก session) */
export function claimPayload(
  form: Record<string, unknown>,
  items: readonly PettyItemDraft[],
): Record<string, unknown> & { items: PettyItemDraft[] } {
  const { amount: _amount, created_by: _createdBy, ...rest } = form;
  return { ...rest, items: items.filter(i => String(i.rate ?? '').trim() !== '') };
}

/** พารามิเตอร์เตือนซ้ำขณะกรอกของแถวหนึ่ง · null = ยังไม่พอจะเช็ก
 *  ต้องมีวันที่ และมีรถหรือเลขอ้างอิง — ใบทั่วไปส่วนใหญ่ไม่มีรถ BE เทียบด้วย เลขที่บิล + จ่ายให้ */
export function dupCheckParams(expenseType: string, row: Record<string, unknown>, payeeName: unknown) {
  const date = String(row.event_date ?? '');
  const code = String(row.truck_code ?? '');
  const ref = String(row.ref_no ?? '').trim();
  if (!expenseType || !date || (!code && !ref)) return null;
  return { expense_type: expenseType, event_date: date, truck_code: code, truck_plate: String(row.truck_plate ?? ''),
    ref_no: ref, payee_name: String(payeeName ?? '').trim() };
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

/** หน่วยนับบนใบสำคัญจ่าย: ตั้งใน spec.print.unit · ไม่ตั้ง = รายการรถนับ "คัน" · ใบเดี่ยวนับ "เที่ยว" */
export function printUnit(spec: PettySpec | null | undefined): string {
  const set = spec?.print?.unit?.trim();
  if (set) return set;
  return isItemBased(spec) ? 'คัน' : 'เที่ยว';
}

/** รายการของใบที่กรอกยอดเดียว: แถวหลัก + แถว "ค่าทางด่วน" เมื่อกรอกมาด้วย (REQUIREMENT §3.5 รวมในใบเดียว) */
export function itemsFrom(form: Record<string, unknown>): PettyItemDraft[] {
  const main = singleItemFrom(form);
  const toll = Number(form.toll_amount ?? 0);
  if (!(toll > 0)) return [main];
  return [main, { ...main, ref_no: (form.toll_receipt_no as string) ?? null, rate: toll, remark: 'ค่าทางด่วน' }];
}
