import { round2 } from '@/lib/finance/status';

/**
 * ยอดที่เจ้าของเงินสดต้องโอนจริง ตามผู้รับเงิน (ผู้ใช้สั่ง 29/10/2026) — แสดงในกล่องตอนอนุมัติจ่ายเท่านั้น
 * ไม่บันทึกตัวเลขภาษีลงระบบ ใบ 50 ทวิ ยังออกจากระบบบัญชีเหมือนเดิม
 *
 * - บุคคล/ร้านเงินสด: บริษัทออกภาษีให้ 3% (gross-up) ร้านได้เต็มยอดบิล — ตัวอย่างจริง 1,200 → ฐาน 1,237.11 ภาษี 37.11
 * - ร้านจดทะเบียน (นิติบุคคล): หัก ณ ที่จ่าย 3% จากยอดบิล โอนส่วนที่เหลือ
 * - ยอดต่ำกว่า 1,000 บาท หรือประเภทที่ไม่มีช่องผู้รับเงิน: โอนเต็มยอด
 * อัตรา/เกณฑ์อยู่ที่นี่จุดเดียว (รอผู้ใช้ยืนยัน)
 */
export const WHT_RATE = 0.03;
export const WHT_MIN_AMOUNT = 1000;
export const PAYEE_INDIVIDUAL = 'บุคคล/ร้านเงินสด';
export const PAYEE_COMPANY = 'ร้านจดทะเบียน';

export type TransferCalc = {
  kind: 'none' | 'gross_up' | 'withhold';
  bill: number;
  /** ยอดที่ต้องโอนให้ผู้รับเงิน */
  transfer: number;
  /** ฐานภาษีตามใบ 50 ทวิ */
  base: number;
  tax: number;
  note: string;
};

const baht = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function transferCalc(amount: number, payeeType: string | null | undefined): TransferCalc {
  const bill = round2(Number(amount) || 0);
  const none = (note: string): TransferCalc => ({ kind: 'none', bill, transfer: bill, base: bill, tax: 0, note });
  if (payeeType !== PAYEE_INDIVIDUAL && payeeType !== PAYEE_COMPANY) {
    return none('ประเภทนี้ไม่มีหัก ณ ที่จ่าย โอนตามยอดบิล');
  }
  if (bill < WHT_MIN_AMOUNT) return none(`ยอดต่ำกว่า ${baht(WHT_MIN_AMOUNT)} บาท ไม่หัก ณ ที่จ่าย โอนตามยอดบิล`);
  if (payeeType === PAYEE_INDIVIDUAL) {
    const base = round2(bill / (1 - WHT_RATE));
    const tax = round2(base - bill);
    return { kind: 'gross_up', bill, transfer: bill, base, tax,
      note: `บุคคล/ร้านเงินสด: บริษัทออกภาษีให้ 3% ร้านได้เต็มยอด · ฐานภาษี ${baht(base)} ภาษี ${baht(tax)} บาท (บัญชีออก 50 ทวิ)` };
  }
  const tax = round2(bill * WHT_RATE);
  return { kind: 'withhold', bill, transfer: round2(bill - tax), base: bill, tax,
    note: `นิติบุคคล/ร้านจดทะเบียน: หัก ณ ที่จ่าย 3% = ${baht(tax)} บาท โอน ${baht(round2(bill - tax))} บาท` };
}
