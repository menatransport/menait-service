import type { PettySpec } from '@/app/finance/types-petty';
import { accountNoError, bankLabel, formatAccountNo, normalizeAccountNo } from '@/lib/finance/bank';

/**
 * บัญชีรับเงินของ "จ่ายให้" บนใบเงินสดย่อย — เก็บใน claim.detail (payee_bank, payee_account_no)
 * ไม่ใช่คอลัมน์ใหม่ เพราะ BE รับ detail เป็น dict เปล่า ๆ อยู่แล้ว และใบพิมพ์/แผงข้างอ่านจากตรงนี้
 */
export type PayeeBank = { payee_bank?: unknown; payee_account_no?: unknown };

/** "ธนาคารกสิกรไทย 123-4-56789-0" · ไม่มีทั้งคู่ = '' */
export function payeeBankText(detail: PayeeBank | null | undefined): string {
  const bank = String(detail?.payee_bank ?? '').trim();
  const no = normalizeAccountNo(String(detail?.payee_account_no ?? ''));
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
  const bank = String(header.payee_bank ?? '').trim();
  const no = String(header.payee_account_no ?? '').trim();
  const required = payeeBankRequired(spec, header);
  if (!bank && !no) return required ? 'ยังไม่กรอกธนาคารและเลขบัญชีของผู้รับเงิน' : null;
  if (!bank) return 'ยังไม่เลือกธนาคารของผู้รับเงิน';
  if (!no) return 'ยังไม่กรอกเลขบัญชีของผู้รับเงิน';
  return accountNoError(bank, no);
}
