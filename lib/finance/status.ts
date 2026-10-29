export type AdvanceStatus =
  | 'PENDING_APPROVAL' | 'REJECTED' | 'AWAITING_VOUCHER' | 'AWAITING_PAYMENT' | 'AWAITING_CLEARING'
  | 'RETURNED' | 'SENT_BACK' | 'CLEARING_APPROVAL' | 'AWAITING_REVIEW' | 'CLOSED';

export const STATUS_LABELS: Record<AdvanceStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  REJECTED: 'ไม่อนุมัติ',
  AWAITING_VOUCHER: 'รอตั้งเบิกทำจ่าย',
  AWAITING_PAYMENT: 'รอจ่าย',
  AWAITING_CLEARING: 'จ่ายแล้วรอเคลียร์',
  RETURNED: 'ตีกลับให้ผู้เบิกแก้ไข',
  SENT_BACK: 'ส่งกลับแก้ไข',
  CLEARING_APPROVAL: 'รออนุมัติเคลียร์',
  AWAITING_REVIEW: 'รอบัญชีตรวจ',
  CLOSED: 'ปิดแล้ว',
};

// V.2 theme palette (brand / aqua / ink / sun / violet / mint). StatusBadge always pairs
// the colour with an icon + label, so no state relies on colour alone.
export const STATUS_STYLES: Record<AdvanceStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  AWAITING_VOUCHER: 'bg-aqua-50 text-aqua-700 border-aqua-200',
  AWAITING_PAYMENT: 'bg-brand-50 text-brand-700 border-brand-200',
  AWAITING_CLEARING: 'bg-slate-50 text-ink-700 border-slate-200',
  RETURNED: 'bg-amber-50 text-amber-700 border-amber-200',
  SENT_BACK: 'bg-orange-50 text-sun-700 border-orange-200',
  CLEARING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  CLOSED: 'bg-emerald-50 text-mint-700 border-emerald-200',
};

export const CLEAR_DUE_DAYS = 7;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' + n days → 'YYYY-MM-DD' (calendar math in UTC so the date never drifts) */
export function addDays(isoDate: string, days: number): string {
  if (!ISO_DATE.test(isoDate)) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** '1,000.50' → 1000.5 · blank/invalid → null (blank is "missing", never 0) */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? round2(raw) : null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  // ตัวเลขธรรมดาเท่านั้น Number() รับ 1e3 / 0x10 / Infinity ด้วย ซึ่งไม่ใช่ยอดเงินที่คนพิมพ์
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

/** รับคืน (+) / เบิกเพิ่ม (−) = paid − actual */
export function computeSettle(amountPaid: number, amountActual: number): number {
  return round2(amountPaid - amountActual);
}

/** ต้องแนบสลิปโอนเงินเฉพาะกรณีคืนเงินบริษัท เบิกเพิ่มหรือยอดพอดีไม่ต้องแนบ */
export function clearNeedsSlip(settle: number | null | undefined): boolean {
  return typeof settle === 'number' && settle > 0;
}

/**
 * คืนเงินบริษัทแล้วยังไม่มีสลิปไหม — ไฟล์เดิมในโฟลเดอร์เคลียร์นับเป็นสลิปได้เฉพาะเมื่อรอบก่อนก็เป็นการคืนเงิน
 * (รอบก่อนเบิกเพิ่ม ไฟล์เดิมคือใบเสร็จ) หรือเป็นไฟล์ที่อัปโหลดไปในรอบนี้แล้ว
 */
export function clearSlipMissing(o: { settle: number | null; newFiles: number; existingFiles: number;
  priorSettle: number | null | undefined; uploadedNow: number }): boolean {
  if (!clearNeedsSlip(o.settle)) return false;
  if (o.newFiles > 0 || o.uploadedNow > 0) return false;
  return !(o.existingFiles > 0 && (o.priorSettle ?? 0) > 0);
}

/** ยอดเงินสูงสุดที่คอลัมน์ Numeric(12,2) ของ BE เก็บได้ */
export const MAX_AMOUNT = 9_999_999_999.99;

/** ช่วงทดสอบระบบ (27/10/2026): เบิกได้ไม่เกินใบละ 100,000 บาท เปิดใช้เต็มเมื่อไหร่ ลบสองค่านี้กับบรรทัดที่ใช้ใน amountError และหน้าขอเบิก */
export const TEST_MAX_AMOUNT = 100_000;
export const TEST_MAX_AMOUNT_TEXT = 'ช่วงทดสอบระบบ เบิกได้ไม่เกินใบละ 100,000 บาท';

/** ตรวจช่องจำนวนเงินที่ขอเบิก คืนข้อความภาษาไทย หรือ null ถ้าใช้ได้ */
export function amountError(raw: string | number | null | undefined): string | null {
  const text = typeof raw === 'number' ? String(raw) : (raw ?? '').replace(/,/g, '').trim();
  const n = parseAmount(text);
  if (n === null || n <= 0) return 'จำนวนเงินต้องมากกว่า 0';
  if (/\.\d{3,}$/.test(text)) return 'ใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง';
  if (n > TEST_MAX_AMOUNT) return TEST_MAX_AMOUNT_TEXT;
  if (n > MAX_AMOUNT) return 'จำนวนเงินมากเกินไป ใส่ได้ไม่เกิน 9,999,999,999.99 บาท';
  return null;
}

export function settleLabel(settle: number | null | undefined): string {
  if (settle === null || settle === undefined) return '-';
  if (settle > 0) return 'รับคืน';
  if (settle < 0) return 'เบิกเพิ่ม';
  return 'พอดี (ไม่มียอดคงค้าง)';
}

const BAHT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBaht(n: number | null | undefined): string {
  return n === null || n === undefined ? '-' : BAHT.format(n);
}

/** dd/MM/yy like the Finance Excel sheet. Date-only strings are never shifted by timezone. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  if (ISO_DATE.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(dt);
  const part = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')}`;
}

/** Today in Bangkok as 'YYYY-MM-DD' */
export function todayBkk(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}

/** ISO datetime or date-only string → 'YYYY-MM' in Asia/Bangkok. Date-only strings never shift. */
export function toBkkYM(iso: string | null | undefined): string {
  if (!iso) return '';
  if (ISO_DATE.test(iso)) return iso.slice(0, 7);
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
  }).formatToParts(dt);
  const y = parts.find(p => p.type === 'year')?.value ?? '';
  const m = parts.find(p => p.type === 'month')?.value ?? '';
  return y && m ? `${y}-${m}` : '';
}

/** S3 key-safe, collision-free file name: '<epochMs>-<name>' */
export function uniqueFileName(name: string, epochMs: number): string {
  return `${epochMs}-${name.replace(/[\\/]/g, '_')}`;
}

export function displayFileName(fileName: string): string {
  return fileName.replace(/^\d{10,}-/, '');
}
