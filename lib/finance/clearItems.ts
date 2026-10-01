/** Clearing line-items helpers. All money math is done in satang (integers) so sums never drift. */

export const MAX_CLEAR_ITEMS = 30;

export interface ClearItemRow {
  expense_date: string;
  vehicle: string;
  has_receipt: boolean;
  description: string;
  /** null = blank input */
  amount_before_vat: number | null;
  vat_amount: number | null;
  wht_amount: number | null;
}

const toSatang = (n: number | null | undefined): number => Math.round((n ?? 0) * 100);
const fromSatang = (s: number): number => s / 100;

/** VAT 7% of A, round-half-up to 2 decimals (computed in satang). 100 → 7, 0.5 → 0.04, 1875.34 → 131.27 */
export function vat7(a: number | null | undefined): number {
  return Math.round((toSatang(a) * 7) / 100) / 100;
}

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
    const fields: [string, number | null][] = [['ยอดก่อน VAT', r.amount_before_vat], ['ยอด VAT', r.vat_amount], ['หัก ณ ที่จ่าย', r.wht_amount]];
    let negative = false;
    for (const [label, v] of fields) {
      if (v !== null && v < 0) { errs.push(`${p}${label} ต้องไม่ติดลบ`); negative = true; }
    }
    if (!negative && rowTotals(r).net < 0) errs.push(`${p}ยอดสุทธิต้องไม่ติดลบ (หัก ณ ที่จ่ายเกินยอดรวม)`);
  });
  return errs;
}

/** Flags non-empty amount text that does not parse (e.g. "12abc", "-"). `parse` returns null for unparseable text. */
export function invalidNumberErrors(
  raws: { a: string; b: string; d: string }[],
  parse: (s: string) => number | null,
): string[] {
  const errs: string[] = [];
  raws.forEach((r, i) => {
    for (const [label, v] of [['ยอดก่อน VAT', r.a], ['ยอด VAT', r.b], ['หัก ณ ที่จ่าย', r.d]] as const) {
      if (v.trim() !== '' && parse(v) === null) errs.push(`รายการที่ ${i + 1}: ${label} รูปแบบตัวเลขไม่ถูกต้อง`);
    }
  });
  return errs;
}
