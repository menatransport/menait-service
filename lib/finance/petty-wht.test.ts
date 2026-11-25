import { describe, expect, test } from 'bun:test';
import { netAmount, payeeWarning, preVatProblem, whtBase, whtFromRate, whtProblem } from './petty-wht';

describe('หัก ณ ที่จ่าย (ข้อ 12–13 ผู้ใช้สั่ง 7/11/2026)', () => {
  test('ปุ่มช่วย 1%/3% และยอดโอนจริง', () => {
    expect(whtFromRate(1640, 0.03)).toBe(49.2);
    expect(whtFromRate(1640, 0.01)).toBe(16.4);
    expect(netAmount(1640, 49.2)).toBe(1590.8);
    expect(netAmount(1640, null)).toBe(1640);
  });
  test('ตรวจยอดหัก', () => {
    expect(whtProblem('', 100)).toBeNull();
    expect(whtProblem('abc', 100)).toContain('ตัวเลข');
    expect(whtProblem('-1', 100)).toContain('ตัวเลข');
    expect(whtProblem('101', 100)).toContain('เกินยอดใบ');
    expect(whtProblem('30', 100)).toBeNull();
  });
  test('เตือนเจ้าที่จ่ายบ่อยเกิน 1,000/เดือน', () => {
    const info = { payee_name: 'ร้านชั่งดี', month: '2026-11', total: 900, count: 2, threshold: 1000 };
    expect(payeeWarning(info, 50, 0)).toBeNull();
    expect(payeeWarning(info, 200, 0)).toBe('เจ้านี้เดือนนี้จ่ายไปแล้ว 900.00 บาท (2 ใบ) รวมใบนี้ 1,100.00 เกิน 1,000.00 ควรหัก ณ ที่จ่าย');
    expect(payeeWarning(info, 200, 33)).toContain('ใส่หัก ณ ที่จ่ายไว้แล้ว');
    expect(payeeWarning(null, 200, 0)).toBeNull();
  });
});

describe('ฐาน 1%/3% = ยอดก่อน VAT ที่ผู้เบิกใส่ (25/11/2026)', () => {
  test('blank uses the claim total', () => expect(whtBase(1070, '')).toBe(1070));
  test('typed pre-VAT amount is the base', () => {
    expect(whtBase(1070, '1000')).toBe(1000);
    expect(whtFromRate(whtBase(1070, '1,000'), 0.03)).toBe(30);
  });
  test('junk falls back to the total', () => expect(whtBase(500, 'abc')).toBe(500));
  test('pre-VAT must be > 0 and not above the total', () => {
    expect(preVatProblem('', 1070)).toBeNull();
    expect(preVatProblem('1000', 1070)).toBeNull();
    expect(preVatProblem('0', 1070)).toBe('ยอดก่อน VAT ต้องเป็นตัวเลขมากกว่า 0');
    expect(preVatProblem('1100', 1070)).toBe('ยอดก่อน VAT เกินยอดรวมใบ');
  });
});
