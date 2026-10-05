/** Clearing line-items helpers. All money math is done in satang (integers) so sums never drift. */

export const MAX_CLEAR_ITEMS = 30;

export interface ClearItemRow {
  expense_date: string;
  vehicle: string;
  has_receipt: boolean;
  description: string;
  /** null = blank input. New entries: A = ยอดเงิน (the total as typed) and B = 0 (spec v3 §3: no VAT split in the UI). */
  amount_before_vat: number | null;
  vat_amount: number | null;
  wht_amount: number | null;
}

const toSatang = (n: number | null | undefined): number => Math.round((n ?? 0) * 100);
const fromSatang = (s: number): number => s / 100;

/** C = A + B, E = C − D */
export function rowTotals(row: Pick<ClearItemRow, 'amount_before_vat' | 'vat_amount' | 'wht_amount'>): { total: number; net: number } {
  const c = toSatang(row.amount_before_vat) + toSatang(row.vat_amount);
  return { total: fromSatang(c), net: fromSatang(c - toSatang(row.wht_amount)) };
}

export function sumItems(rows: ClearItemRow[]): { a: number; b: number; c: number; d: number; e: number } {
  let a = 0, b = 0, d = 0;
  for (const r of rows) {
    a += toSatang(r.amount_before_vat);
    b += toSatang(r.vat_amount);
    d += toSatang(r.wht_amount);
  }
  return { a: fromSatang(a), b: fromSatang(b), c: fromSatang(a + b), d: fromSatang(d), e: fromSatang(a + b - d) };
}

/** Mirrors the BE rules; messages are "รายการที่ N: …". Empty array = valid. */
export function validateItems(rows: ClearItemRow[]): string[] {
  const errs: string[] = [];
  if (rows.length < 1) errs.push('ต้องมีรายการอย่างน้อย 1 รายการ');
  if (rows.length > MAX_CLEAR_ITEMS) errs.push(`มีรายการได้ไม่เกิน ${MAX_CLEAR_ITEMS} รายการ`);
  rows.forEach((r, i) => {
    const p = `รายการที่ ${i + 1}: `;
    if (!r.expense_date) errs.push(`${p}กรุณาระบุวันที่`);
    if (!r.description.trim()) errs.push(`${p}กรุณาระบุรายละเอียด`);
    const fields: [string, number | null][] = [['ยอดเงิน', r.amount_before_vat], ['หัก ณ ที่จ่าย', r.wht_amount]];
    let negative = false;
    for (const [label, v] of fields) {
      if (v !== null && v < 0) { errs.push(`${p}${label} ต้องไม่ติดลบ`); negative = true; }
    }
    if (!negative && rowTotals(r).net < 0) errs.push(`${p}ยอดสุทธิต้องไม่ติดลบ (หัก ณ ที่จ่ายเกินยอดเงิน)`);
  });
  return errs;
}

/** Flags non-empty amount text that does not parse (e.g. "12abc", "-"). `parse` returns null for unparseable text. */
export function invalidNumberErrors(
  raws: { a: string; d: string }[],
  parse: (s: string) => number | null,
): string[] {
  const errs: string[] = [];
  raws.forEach((r, i) => {
    for (const [label, v] of [['ยอดเงิน', r.a], ['หัก ณ ที่จ่าย', r.d]] as const) {
      if (v.trim() === '') continue;
      if (parse(v) === null) errs.push(`รายการที่ ${i + 1}: ${label} รูปแบบตัวเลขไม่ถูกต้อง`);
      else if (/\.\d{3,}\s*$/.test(v.trim())) errs.push(`รายการที่ ${i + 1}: ${label} ทศนิยมไม่เกิน 2 ตำแหน่ง`);
    }
  });
  return errs;
}

/**
 * ยอดเงิน to prefill when editing a saved row: its total (C). Old rows may carry VAT; the total keeps the sums identical
 * once re-saved as A = total, B = 0.
 */
export function savedAmount(i: { total_amount?: number | string | null; amount_before_vat?: number | string | null; vat_amount?: number | string | null }): number {
  const t = i.total_amount;
  if (t !== null && t !== undefined && t !== '' && !Number.isNaN(Number(t))) return Number(t);
  return (Number(i.amount_before_vat) || 0) + (Number(i.vat_amount) || 0);
}

/** New-item popup defaults: date and vehicle come from the last row in the list (blank when none). */
export function carryOverDefaults(rows: { expense_date: string; vehicle: string }[]): { expense_date: string; vehicle: string } {
  const last = rows[rows.length - 1];
  return { expense_date: last?.expense_date ?? '', vehicle: last?.vehicle ?? '' };
}

const ROW_PREFIX = /^รายการที่ \d+: /;

/** Validates ONE row (raw amount text + parsed row) for the popup. Messages carry no "รายการที่ N: " prefix. Empty = valid. */
export function validateSingleItem(
  raw: { a: string; d: string },
  row: ClearItemRow,
  parse: (s: string) => number | null,
): string[] {
  const numErrs = invalidNumberErrors([raw], parse);
  const rowErrs = validateItems([row]);
  // an unparseable number parses to null (treated as 0), so the net check may also fire; both messages are shown
  return [...numErrs, ...rowErrs].map(m => m.replace(ROW_PREFIX, ''));
}
