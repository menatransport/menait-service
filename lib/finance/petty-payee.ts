import type { PettySpec } from '@/app/finance/types-petty';
import { accountNoError, bankLabel, formatAccountNo, normalizeAccountNo } from '@/lib/finance/bank';

/**
 * บัญชีรับเงินของ "จ่ายให้" บนใบเงินสดย่อย — เก็บใน claim.detail (payee_bank, payee_account_no)
 * ไม่ใช่คอลัมน์ใหม่ เพราะ BE รับ detail เป็น dict เปล่า ๆ อยู่แล้ว และใบพิมพ์/แผงข้างอ่านจากตรงนี้
 */
export type PayeeBank = { payee_account_type?: unknown; payee_bank?: unknown; payee_account_no?: unknown };

/** ปลายทางเงิน: บัญชีธนาคาร (ค่าเริ่มต้น ใบเก่าไม่มีช่องนี้) หรือพร้อมเพย์ (ผู้ใช้สั่ง 2026-10-13) */
export type PayeeAccountType = 'bank' | 'promptpay';

export function payeeAccountType(detail: PayeeBank | null | undefined): PayeeAccountType {
  return String(detail?.payee_account_type ?? '') === 'promptpay' ? 'promptpay' : 'bank';
}

export const PROMPTPAY_ERROR = 'พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก';

/** พร้อมเพย์รับ 2 แบบ: เบอร์มือถือ 0xxxxxxxxx (10 หลัก) หรือเลขบัตรประชาชน 13 หลัก */
export function promptPayError(raw: string | null | undefined): string | null {
  const n = normalizeAccountNo(raw);
  if (/^0[0-9]{9}$/.test(n) || /^[0-9]{13}$/.test(n)) return null;
  return PROMPTPAY_ERROR;
}

/** 0812345678 → 081-234-5678 · 1234567890123 → 1-2345-67890-12-3 · อื่น ๆ คืนตามเดิม */
export function formatPromptPay(raw: string | null | undefined): string {
  const n = normalizeAccountNo(raw);
  if (/^0[0-9]{9}$/.test(n)) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  if (/^[0-9]{13}$/.test(n)) return `${n.slice(0, 1)}-${n.slice(1, 5)}-${n.slice(5, 10)}-${n.slice(10, 12)}-${n.slice(12)}`;
  return n;
}

/** "ธนาคารกสิกรไทย 123-4-56789-0" หรือ "พร้อมเพย์ 081-234-5678" · ไม่มีอะไรเลย = '' */
export function payeeBankText(detail: PayeeBank | null | undefined): string {
  const no = normalizeAccountNo(String(detail?.payee_account_no ?? ''));
  if (payeeAccountType(detail) === 'promptpay') return no ? `พร้อมเพย์ ${formatPromptPay(no)}` : '';
  const bank = String(detail?.payee_bank ?? '').trim();
  if (!bank && !no) return '';
  return [bank ? bankLabel(bank) : '', no ? formatAccountNo(no) : ''].filter(Boolean).join(' ');
}

/** ประเภทที่ให้เลือก "วิธีจ่าย" (ยาง/ซ่อม) บังคับบัญชีเฉพาะตอนโอน · ประเภทอื่นเงินถึงมือคนโดยโอนเสมอ */
export function payeeBankRequired(spec: PettySpec | null | undefined, header: Record<string, unknown>): boolean {
  const hasMethod = (spec?.header_fields ?? []).some(f => f.key === 'payment_method');
  if (!hasMethod) return true;
  return String(header.payment_method ?? '') === 'โอนเงิน';
}

/** ข้อความที่ยังกรอกไม่ครบ/ไม่ถูก สำหรับบล็อกปุ่มส่ง · null = ผ่าน */
export function payeeBankProblem(spec: PettySpec | null | undefined, header: Record<string, unknown>): string | null {
  const no = String(header.payee_account_no ?? '').trim();
  const required = payeeBankRequired(spec, header);
  if (payeeAccountType(header) === 'promptpay') {
    if (!no) return required ? 'ยังไม่กรอกเบอร์พร้อมเพย์ของผู้รับเงิน' : null;
    return promptPayError(no);
  }
  const bank = String(header.payee_bank ?? '').trim();
  if (!bank && !no) return required ? 'ยังไม่กรอกธนาคารและเลขบัญชีของผู้รับเงิน' : null;
  if (!bank) return 'ยังไม่เลือกธนาคารของผู้รับเงิน';
  if (!no) return 'ยังไม่กรอกเลขบัญชีของผู้รับเงิน';
  return accountNoError(bank, no);
}

/** คำเตือนใต้ช่องเลขบัญชีขณะพิมพ์ — เตือนเฉพาะเมื่อพิมพ์เลขแล้ว (ช่องว่างให้ปุ่มส่งเป็นคนบอก) · null = ไม่ต้องเตือน */
export function payeeAccountHint(header: Record<string, unknown>): string | null {
  const no = String(header.payee_account_no ?? '').trim();
  if (!no) return null;
  if (payeeAccountType(header) === 'promptpay') return promptPayError(no);
  const bank = String(header.payee_bank ?? '').trim();
  if (!bank) return 'เลือกธนาคารก่อน จะได้ตรวจจำนวนหลักให้ถูก';
  return accountNoError(bank, no);
}
