import { describe, expect, test } from 'bun:test';
import { parseAmount } from './status';
import { invalidNumberErrors, rowTotals, sumItems, validateItems, vat7, type ClearItemRow } from './clearItems';

const row = (o: Partial<ClearItemRow> = {}): ClearItemRow => ({
  expense_date: '2026-09-30', vehicle: '', has_receipt: true, description: 'ค่าทางด่วน',
  amount_before_vat: 100, vat_amount: 7, wht_amount: 0, ...o,
});

describe('vat7', () => {
  test('100 → 7', () => expect(vat7(100)).toBe(7));
  test('0.5 → 0.04 (half-up)', () => expect(vat7(0.5)).toBe(0.04));
  test('1875.34 → 131.27', () => expect(vat7(1875.34)).toBe(131.27));
  test('null/0 → 0', () => { expect(vat7(null)).toBe(0); expect(vat7(0)).toBe(0); });
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
    expect(s).toEqual({ a: 300, b: 21, c: 321, d: 6, e: 315 });
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
  test('negative amount', () => expect(validateItems([row({ vat_amount: -1 })])[0]).toBe('รายการที่ 1: ยอด VAT ต้องไม่ติดลบ'));
  test('net negative', () => expect(validateItems([row({ wht_amount: 108 })])[0]).toContain('รายการที่ 1: ยอดสุทธิต้องไม่ติดลบ'));
});

describe('invalidNumberErrors', () => {
  test('flags non-numeric text, allows blank', () => {
    const e = invalidNumberErrors([{ a: '12abc', b: '', d: '-' }, { a: '1,000.50', b: '7', d: '' }], parseAmount);
    expect(e).toEqual(['รายการที่ 1: ยอดก่อน VAT รูปแบบตัวเลขไม่ถูกต้อง', 'รายการที่ 1: หัก ณ ที่จ่าย รูปแบบตัวเลขไม่ถูกต้อง']);
  });
});
