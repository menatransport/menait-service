import { round2 } from '@/lib/finance/status';

/**
 * หัก ณ ที่จ่าย (ผู้ใช้สั่ง 7/11/2026 ข้อ 12–13): ผู้เบิกใส่ยอดหักเองเป็นหลัก มีปุ่มช่วย 1% / 3% · ยอดโอนจริง = ยอดใบ − ยอดหัก
 * เจ้าเดียวกันจ่ายรวมเกิน 1,000 บาท/เดือน → เตือนว่าควรหัก (BE WHT_MONTH_THRESHOLD ตัวเลขเดียวกัน)
 */
export const WHT_RATES = [{ rate: 0.01, label: '1% ค่าขนส่ง' }, { rate: 0.03, label: '3% ค่าบริการ' }] as const;
export const WHT_MONTH_THRESHOLD = 1000;

export const whtFromRate = (amount: number, rate: number) => round2((Number(amount) || 0) * rate);

/**
 * ฐานคิด 1% / 3% = ยอดก่อน VAT ที่ผู้เบิกพิมพ์เอง (ผู้ใช้สั่ง 25/11/2026) · ว่างหรือไม่ใช่ตัวเลข = ยอดรวมใบ
 * ระบบไม่รู้ว่าบิลไหนมี VAT (ประเภทค่าใช้จ่ายตั้ง VAT 0 หมด) จึงให้คนดูจากบิลแล้วใส่
 */
export function whtBase(total: number, preVat: string | number | null | undefined): number {
  const n = Number(String(preVat ?? '').replace(/,/g, '').trim());
  return String(preVat ?? '').trim() && Number.isFinite(n) && n > 0 ? round2(n) : round2(Number(total) || 0);
}

/** ยอดก่อน VAT ต้องเป็นตัวเลขมากกว่า 0 และไม่เกินยอดใบ · '' = ไม่ใส่ */
export function preVatProblem(raw: string | number | null | undefined, total: number): string | null {
  const text = String(raw ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return 'ยอดก่อน VAT ต้องเป็นตัวเลขมากกว่า 0';
  if (n > total) return 'ยอดก่อน VAT เกินยอดรวมใบ';
  return null;
}

export const netAmount = (amount: number, wht: number | null | undefined) => round2((Number(amount) || 0) - (Number(wht) || 0));

/** ยอดหักต้องเป็นตัวเลข ≥ 0 และไม่เกินยอดใบ · '' = 0 */
export function whtProblem(raw: string | number | null | undefined, amount: number): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return 'ยอดหัก ณ ที่จ่ายต้องเป็นตัวเลข 0 ขึ้นไป';
  if (n > amount) return 'ยอดหัก ณ ที่จ่ายเกินยอดใบ';
  return null;
}

export type PayeeMonth = { payee_name: string; month: string; total: number; count: number; threshold: number };

/** ข้อความเตือนเจ้าที่จ่ายบ่อย: รวมใบนี้แล้วเกินเกณฑ์ และยังไม่ได้ใส่ยอดหัก */
export function payeeWarning(info: PayeeMonth | null | undefined, thisAmount: number, wht: number): string | null {
  if (!info) return null;
  const total = round2(info.total + thisAmount);
  if (total <= info.threshold) return null;
  const base = `เจ้านี้เดือนนี้จ่ายไปแล้ว ${money(info.total)} บาท (${info.count} ใบ) รวมใบนี้ ${money(total)} เกิน ${money(info.threshold)}`;
  return wht > 0 ? `${base} · ใส่หัก ณ ที่จ่ายไว้แล้ว` : `${base} ควรหัก ณ ที่จ่าย`;
}

const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
