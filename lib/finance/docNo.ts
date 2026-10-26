/** เลขเอกสารที่บัญชี/การเงินกรอก (ผู้ใช้สั่ง 21/10/2026) */
export type DocNoField = 'voucher_no' | 'payment_doc_no' | 'clear_doc_no';

export const DOC_NO_LABELS: Record<DocNoField, string> = {
  voucher_no: 'เลขที่ตั้งเบิก',
  payment_doc_no: 'เลขที่ทำจ่าย',
  clear_doc_no: 'เลขที่เอกสารเคลียร์เงิน',
};

const CLEAR_DOC_NO_RE = /^[A-Za-z0-9]+$/;
/** เลขที่เอกสารเคลียร์เงินต้องมีกี่หลัก (ผู้ใช้สั่ง 26/10/2026 เปลี่ยนจาก 10 เป็น 14) — หลังบ้านเช็กแบบเดียวกัน */
export const CLEAR_DOC_NO_LEN = 14;

/** เลขที่เอกสารเคลียร์เงิน: บังคับกรอก ตัวเลขหรืออักษรอังกฤษ 14 หลักพอดี · คืนข้อความเตือน หรือ null ถ้าใช้ได้ */
export function clearDocNoError(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  if (!text) return 'กรุณากรอกเลขที่เอกสารเคลียร์เงิน';
  if (!CLEAR_DOC_NO_RE.test(text)) return 'เลขที่เอกสารเคลียร์เงินใช้ได้แค่ตัวเลขกับอักษรอังกฤษ ไม่มีขีดหรือเว้นวรรค';
  if (text.length !== CLEAR_DOC_NO_LEN) return `เลขที่เอกสารเคลียร์เงินต้องมี ${CLEAR_DOC_NO_LEN} หลัก (ตอนนี้ ${text.length} หลัก)`;
  return null;
}

/** ข้อความถามยืนยันเมื่อเลขซ้ำกับใบอื่น */
export function duplicateText(field: DocNoField, value: string, formIds: string[]): string {
  const shown = formIds.slice(0, 5).join(', ') + (formIds.length > 5 ? ` และอีก ${formIds.length - 5} ใบ` : '');
  return `${DOC_NO_LABELS[field]} ${value.trim()} ซ้ำกับใบ ${shown}`;
}

// ---- การเงินแก้เลขเอกสารที่กรอกผิด (ผู้ใช้สั่ง 26/10/2026) — หลังบ้าน PUT .../doc-numbers เช็กแบบเดียวกัน
export const DOC_NO_FIELDS: DocNoField[] = ['voucher_no', 'payment_doc_no', 'clear_doc_no'];
/** ทุกสถานะหลังตั้งเบิก รวมปิดรายการแล้ว */
export const DOC_NO_EDIT_STATUSES = ['AWAITING_PAYMENT', 'AWAITING_CLEARING', 'SENT_BACK', 'CLEARING_APPROVAL', 'AWAITING_REVIEW', 'CLOSED'];
/** fin_advances.voucher_no / payment_doc_no String(50) */
export const DOC_NO_MAX = 50;

type DocNos = Partial<Record<DocNoField, string | null>>;

/** แก้ได้เฉพาะเลขที่มีอยู่แล้วในใบ */
export function editableDocFields(fin: DocNos | null | undefined): DocNoField[] {
  return DOC_NO_FIELDS.filter(f => (fin?.[f] ?? '').trim() !== '');
}

/** ช่องที่เปลี่ยนจริง (ตัดช่องว่างแล้ว) — ส่งเฉพาะช่องเหล่านี้ไปหลังบ้าน */
export function docNoChanges(fin: DocNos | null | undefined, draft: DocNos): Partial<Record<DocNoField, string>> {
  const out: Partial<Record<DocNoField, string>> = {};
  for (const f of editableDocFields(fin)) {
    if (draft[f] === undefined || draft[f] === null) continue;
    const text = String(draft[f]).trim();
    if (text !== (fin?.[f] ?? '').trim()) out[f] = text;
  }
  return out;
}

/** ข้อความเตือนก่อนบันทึก หรือ null ถ้าส่งได้ · เหตุผลไม่บังคับ เก็บประวัติไว้พอ (ผู้ใช้สั่ง 26/10/2026) */
export function docNoEditError(changes: Partial<Record<DocNoField, string>>): string | null {
  const fields = DOC_NO_FIELDS.filter(f => changes[f] !== undefined);
  if (!fields.length) return 'ไม่มีเลขที่เปลี่ยน';
  for (const f of fields) {
    const text = changes[f] ?? '';
    if (!text) return `กรุณากรอก${DOC_NO_LABELS[f]}`;
    if (f === 'clear_doc_no') {
      const err = clearDocNoError(text);
      if (err) return err;
    } else if (text.length > DOC_NO_MAX) return `${DOC_NO_LABELS[f]}ยาวได้ไม่เกิน ${DOC_NO_MAX} ตัว`;
  }
  return null;
}
