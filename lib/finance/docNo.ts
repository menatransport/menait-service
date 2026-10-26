/** เลขเอกสารที่บัญชี/การเงินกรอก (ผู้ใช้สั่ง 21/10/2026) */
export type DocNoField = 'voucher_no' | 'payment_doc_no' | 'clear_doc_no';

export const DOC_NO_LABELS: Record<DocNoField, string> = {
  voucher_no: 'เลขที่ตั้งเบิก',
  payment_doc_no: 'เลขที่ทำจ่าย',
  clear_doc_no: 'เลขที่เอกสารเคลียร์เงิน',
};

const CLEAR_DOC_NO_RE = /^[A-Za-z0-9]+$/;
/** ความยาวสูงสุดตามคอลัมน์ fin_advances.clear_doc_no (หลังบ้านเช็กแบบเดียวกัน) */
export const CLEAR_DOC_NO_MAX = 100;

/** เลขที่เอกสารเคลียร์เงิน: บังคับกรอก ตัวเลขหรืออักษรอังกฤษ ไม่ล็อก 10 หลักแล้ว (ผู้ใช้สั่ง 26/10/2026)
 * คืนข้อความเตือน หรือ null ถ้าใช้ได้ */
export function clearDocNoError(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  if (!text) return 'กรุณากรอกเลขที่เอกสารเคลียร์เงิน';
  if (!CLEAR_DOC_NO_RE.test(text)) return 'เลขที่เอกสารเคลียร์เงินใช้ได้แค่ตัวเลขกับอักษรอังกฤษ ไม่มีขีดหรือเว้นวรรค';
  if (text.length > CLEAR_DOC_NO_MAX) return `เลขที่เอกสารเคลียร์เงินยาวได้ไม่เกิน ${CLEAR_DOC_NO_MAX} ตัว`;
  return null;
}

/** ข้อความถามยืนยันเมื่อเลขซ้ำกับใบอื่น */
export function duplicateText(field: DocNoField, value: string, formIds: string[]): string {
  const shown = formIds.slice(0, 5).join(', ') + (formIds.length > 5 ? ` และอีก ${formIds.length - 5} ใบ` : '');
  return `${DOC_NO_LABELS[field]} ${value.trim()} ซ้ำกับใบ ${shown}`;
}
