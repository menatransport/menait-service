import type { PettySpec } from '@/app/finance/types-petty';
import { isHolderAttachment } from '@/lib/finance/petty-spec';

export type PresetDoc = { key: string; label: string; required: boolean; done: boolean; max?: number;
  /** บังคับเฉพาะเมื่อเข้าเงื่อนไขของกฎ เช่น โอนเข้าชื่อบุคคล/ร้านเงินสด (REQUIREMENT §3.3) */
  condition?: string;
  /** เจ้าของเงินสดแนบตอนอนุมัติจ่าย (สลิปโอน) ไม่ใช่คนเปิดใบ */
  byHolder?: true };

/** "payment_method == โอนเงิน && payee_type == บุคคล/ร้านเงินสด" → "บังคับเมื่อ วิธีจ่าย = โอนเงิน และ ผู้รับเงิน = บุคคล/ร้านเงินสด" */
function conditionSentence(when: string, spec: PettySpec | null | undefined): string | null {
  if (!when || when === 'always' || !when.includes('==')) return null;
  const labels = Object.fromEntries((spec?.header_fields ?? []).map(f => [f.key, f.label]));
  const parts = when.split('&&').map(c => {
    const [key, value] = c.split('==').map(x => x.trim());
    return `${labels[key] ?? key} = ${value}`;
  });
  return `บังคับเมื่อ ${parts.join(' และ ')}`;
}

/** หมวดไฟล์ของประเภทนี้ เรียงบังคับขึ้นก่อน พร้อมสถานะว่าแนบแล้วหรือยัง */
export function requiredDocs(
  spec: PettySpec | null | undefined,
  counts: Record<string, number> = {},
): PresetDoc[] {
  const conditional: Record<string, string> = {};
  for (const rule of spec?.rules ?? []) {
    if (!rule.require_attachment) continue;
    const sentence = conditionSentence(rule.when ?? 'always', spec);
    if (sentence) conditional[rule.require_attachment] = sentence;
  }
  const rank = (d: { required: boolean; condition?: string }) => d.required ? 0 : d.condition ? 1 : 2;
  return (spec?.attachments ?? [])
    .map(a => ({
      key: a.key,
      label: a.label,
      required: a.required === true,
      done: (counts[a.key] ?? 0) > 0,
      max: a.max,
      ...(a.required !== true && conditional[a.key] ? { condition: conditional[a.key] } : {}),
      ...(isHolderAttachment(a.key) ? { byHolder: true as const } : {}),
    }))
    .sort((a, b) => rank(a) - rank(b));
}

const PRINT_NAMES: Record<string, string> = {
  PETTY_VOUCHER: 'ใบสำคัญจ่ายเงินสดย่อย',
  RECEIPT_SUBSTITUTE: 'ใบรับรองแทนใบเสร็จรับเงิน',
  DD: 'ใบรับสินค้า (DD)',
  ITEM_SUMMARY: 'ใบสรุปรายการ',
  REQUEST_FORM: 'แบบฟอร์มขอใช้บริการแกร็บแท็กซี่',
};

/** เอกสารที่ระบบจะพิมพ์ให้ — ประเภทที่ไม่มีใบรับรองแทนใบเสร็จก็จะไม่ขึ้น */
export function printableDocs(spec: PettySpec | null | undefined): string[] {
  const codes = spec?.prints ?? ['PETTY_VOUCHER'];
  return codes.map(code => PRINT_NAMES[code] ?? code);
}

const FIELD_NAMES: Record<string, string> = {
  dd_no: 'เลขที่ใบรับสินค้า (DD)',
  receipt_no: 'เลขที่ใบเสร็จ',
};

const STAGE_NAMES: Record<string, string> = {
  BEFORE_APPROVE: 'ก่อนอนุมัติ',
  BEFORE_SUBMIT_TO_ACCOUNTING: 'ก่อนส่งบัญชี',
};

function amountCondition(when: string): string | null {
  const ge = when.match(/^total\s*>=\s*([\d.]+)$/);
  if (ge) return `ยอดตั้งแต่ ${Number(ge[1]).toLocaleString('th-TH')} บาท`;
  const lt = when.match(/^total\s*<\s*([\d.]+)$/);
  if (lt) return `ยอดต่ำกว่า ${Number(lt[1]).toLocaleString('th-TH')} บาท`;
  return null;
}

/**
 * กฎของประเภทนี้เป็นประโยคไทย — อ่านจาก spec ชุดเดียวกับที่ด่านใช้ตัดสิน
 * ข้ามกฎที่บังคับไฟล์แนบ เพราะช่องติ๊ก "ต้องแนบ" ด้านบนบอกไปแล้ว
 */
export function ruleSentences(spec: PettySpec | null | undefined): string[] {
  const lines: string[] = [];

  for (const rule of spec?.rules ?? []) {
    if (!rule.require_field) continue;
    const field = FIELD_NAMES[rule.require_field] ?? rule.require_field;
    const stage = STAGE_NAMES[rule.at] ?? '';
    const condition = amountCondition(rule.when ?? 'always');
    lines.push(condition
      ? `${condition} ต้องมี${field}${stage ? ` ${stage}` : ''}`
      : `ต้องมี${field}${stage ? ` ${stage}` : ''}`);
  }

  const dup = spec?.duplicate_check;
  if (dup?.hard) {
    // ค่าใช้จ่ายทั่วไปไม่มีรถ BE เทียบ เลขที่บิล + จ่ายให้ (petty_logic.hard_dup_key)
    lines.push(dup.hard.keys?.includes('payee_name')
      ? 'เลขที่บิลเดียวกันของผู้รับเงินรายเดียวกัน เบิกซ้ำไม่ได้'
      : 'รายการที่เลขอ้างอิงและรถตรงกันทั้งคู่ เบิกซ้ำไม่ได้');
  }
  if (dup?.soft) {
    const byDriver = dup.soft.keys?.includes('driver');
    lines.push(`${byDriver ? 'คนเดิม' : 'รถคันเดิม'}ภายใน ${dup.soft.days} วัน ระบบจะเตือน แต่ยืนยันทับได้พร้อมเหตุผล`);
  }

  return lines;
}
