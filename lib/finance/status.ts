export type AdvanceStatus =
  | 'PENDING_APPROVAL' | 'REJECTED' | 'AWAITING_PAYMENT' | 'AWAITING_CLEARING'
  | 'SENT_BACK' | 'AWAITING_REVIEW' | 'CLOSED';

export const STATUS_LABELS: Record<AdvanceStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  REJECTED: 'ไม่อนุมัติ',
  AWAITING_PAYMENT: 'รอจ่าย',
  AWAITING_CLEARING: 'จ่ายแล้วรอเคลียร์',
  SENT_BACK: 'ส่งกลับแก้ไข',
  AWAITING_REVIEW: 'รอการเงินตรวจ',
  CLOSED: 'ปิดแล้ว',
};

export const STATUS_STYLES: Record<AdvanceStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  AWAITING_PAYMENT: 'bg-sky-50 text-sky-700 border-sky-200',
  AWAITING_CLEARING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SENT_BACK: 'bg-orange-50 text-orange-700 border-orange-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

/** รับคืน (+) / เบิกเพิ่ม (−) = paid − actual */
export function computeSettle(amountPaid: number, amountActual: number): number {
  return round2(amountPaid - amountActual);
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
    return `${d}/${m}/${y.slice(2)}`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: '2-digit',
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
