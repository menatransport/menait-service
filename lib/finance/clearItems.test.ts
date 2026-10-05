import { describe, expect, test } from 'bun:test';
import { parseAmount } from './status';
import { carryOverDefaults, validateSingleItem, invalidNumberErrors, rowTotals, savedAmount, sumItems, validateItems, type ClearItemRow } from './clearItems';

const row = (o: Partial<ClearItemRow> = {}): ClearItemRow => ({
  expense_date: '2026-09-30', vehicle: '', has_receipt: true, description: 'ค่าทางด่วน',
  amount_before_vat: 107, vat_amount: 0, wht_amount: 0, ...o,
});

describe('rowTotals / sumItems', () => {
  test('C and E', () => expect(rowTotals(row({ amount_before_vat: 1000, vat_amount: 70, wht_amount: 30 }))).toEqual({ total: 1070, net: 1040 }));
  test('blank treated as 0', () => expect(rowTotals(row({ amount_before_vat: null, vat_amount: null, wht_amount: null }))).toEqual({ total: 0, net: 0 }));
  test('no float drift', () => {
    const rows = [row({ amount_before_vat: 0.1, vat_amount: 0 }), row({ amount_before_vat: 0.2, vat_amount: 0 })];
    expect(sumItems(rows).a).toBe(0.3);
  });
  test('sums all columns', () => {
    const s = sumItems([row(), row({ amount_before_vat: 200, vat_amount: 14, wht_amount: 6 })]);
    expect(s).toEqual({ a: 307, b: 14, c: 321, d: 6, e: 315 });
  });
});

describe('validateItems', () => {
  test('valid → []', () => expect(validateItems([row()])).toEqual([]));
  test('no rows', () => expect(validateItems([]).length).toBe(1));
  test('more than 30', () => expect(validateItems(Array.from({ length: 31 }, () => row())).length).toBe(1));
  test('missing date/description numbered', () => {
    const e = validateItems([row(), row({ expense_date: '', description: '  ' })]);
    expect(e).toEqual(['รายการที่ 2: กรุณาระบุวันที่', 'รายการที่ 2: กรุณาระบุรายละเอียด']);
  });
  test('negative amount', () => expect(validateItems([row({ amount_before_vat: -1 })])[0]).toBe('รายการที่ 1: ยอดเงิน ต้องไม่ติดลบ'));
  test('net negative', () => expect(validateItems([row({ wht_amount: 108 })])[0]).toContain('รายการที่ 1: ยอดสุทธิต้องไม่ติดลบ'));
});

describe('invalidNumberErrors', () => {
  test('flags non-numeric text, allows blank', () => {
    const e = invalidNumberErrors([{ a: '12abc', d: '-' }, { a: '1,000.50', d: '' }], parseAmount);
    expect(e).toEqual(['รายการที่ 1: ยอดเงิน รูปแบบตัวเลขไม่ถูกต้อง', 'รายการที่ 1: หัก ณ ที่จ่าย รูปแบบตัวเลขไม่ถูกต้อง']);
  });
  test('flags more than 2 decimals', () => {
    expect(invalidNumberErrors([{ a: '0.005', d: '' }], parseAmount)).toEqual(['รายการที่ 1: ยอดเงิน ทศนิยมไม่เกิน 2 ตำแหน่ง']);
  });
});

describe('carryOverDefaults', () => {
  test('empty list → blanks', () => expect(carryOverDefaults([])).toEqual({ expense_date: '', vehicle: '' }));
  test('takes last row', () => expect(carryOverDefaults([
    { expense_date: '2026-09-01', vehicle: 'A' }, { expense_date: '2026-09-02', vehicle: 'B 1234' },
  ])).toEqual({ expense_date: '2026-09-02', vehicle: 'B 1234' }));
});

describe('validateSingleItem', () => {
  const raw = (o: Partial<{ a: string; d: string }> = {}) => ({ a: '107', d: '', ...o });
  test('valid → []', () => expect(validateSingleItem(raw(), row(), parseAmount)).toEqual([]));
  test('messages have no row prefix', () => {
    const e = validateSingleItem(raw(), row({ expense_date: '', description: ' ' }), parseAmount);
    expect(e).toEqual(['กรุณาระบุวันที่', 'กรุณาระบุรายละเอียด']);
  });
  test('bad number text reported', () => {
    expect(validateSingleItem(raw({ a: '12abc' }), row({ amount_before_vat: null }), parseAmount)[0]).toBe('ยอดเงิน รูปแบบตัวเลขไม่ถูกต้อง');
  });
  test('wht over total', () => expect(validateSingleItem(raw({ d: '108' }), row({ wht_amount: 108 }), parseAmount)[0]).toContain('ยอดสุทธิต้องไม่ติดลบ'));
});

describe('savedAmount (prefill of ยอดเงิน from a saved row)', () => {
  test('uses total_amount (old rows with VAT)', () => expect(savedAmount({ amount_before_vat: 100, vat_amount: 7, total_amount: 107 })).toBe(107));
  test('falls back to A + B without a total', () => expect(savedAmount({ amount_before_vat: 100, vat_amount: 7 })).toBe(107));
  test('no-VAT row', () => expect(savedAmount({ amount_before_vat: 50, vat_amount: 0, total_amount: 50 })).toBe(50));
  test('re-saved as A = total, B = 0 keeps the totals identical', () => {
    const old = row({ amount_before_vat: 100, vat_amount: 7, wht_amount: 3 });
    const resaved = row({ amount_before_vat: savedAmount({ total_amount: 107 }), vat_amount: 0, wht_amount: 3 });
    expect(rowTotals(resaved)).toEqual(rowTotals(old));
  });
});
