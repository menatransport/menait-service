import { describe, expect, test } from 'bun:test';
import { payeeBankProblem, payeeBankRequired, payeeBankText } from './petty-payee';

const weigh = { header_fields: [{ key: 'payee_name', label: 'จ่ายให้', type: 'employee', required: true }] };
const tire = { header_fields: [
  { key: 'payee_name', label: 'จ่ายให้', type: 'text', required: true },
  { key: 'payment_method', label: 'วิธีจ่าย', type: 'select', options: ['เงินสด', 'โอนเงิน'] },
] };

describe('payeeBankText', () => {
  test('ธนาคาร + เลขบัญชีแบบมีขีด', () =>
    expect(payeeBankText({ payee_bank: 'KBANK', payee_account_no: '1234567890' })).toBe('ธนาคารกสิกรไทย 123-4-56789-0'));
  test('ไม่มีอะไรเลย = ว่าง (ใบเก่าก่อนมีช่องนี้)', () => {
    expect(payeeBankText({})).toBe('');
    expect(payeeBankText(null)).toBe('');
  });
  test('มีแค่เลขบัญชี ก็ยังโชว์', () => expect(payeeBankText({ payee_account_no: '123456789012' })).toBe('123456789012'));
});

describe('payeeBankRequired', () => {
  test('ประเภทที่ไม่มีช่องวิธีจ่าย (ค่าชั่ง/ทางด่วน/เดินทาง) บังคับเสมอ', () =>
    expect(payeeBankRequired(weigh, {})).toBe(true));
  test('ยาง/ซ่อม จ่ายเงินสด ไม่ต้องมีบัญชี', () =>
    expect(payeeBankRequired(tire, { payment_method: 'เงินสด' })).toBe(false));
  test('ยาง/ซ่อม โอนเงิน ต้องมีบัญชี', () =>
    expect(payeeBankRequired(tire, { payment_method: 'โอนเงิน' })).toBe(true));
});

describe('payeeBankProblem', () => {
  test('ครบและถูกต้อง = ผ่าน', () =>
    expect(payeeBankProblem(weigh, { payee_bank: 'SCB', payee_account_no: '123-4-56789-0' })).toBeNull());
  test('ว่างทั้งคู่ตอนบังคับ', () =>
    expect(payeeBankProblem(weigh, {})).toBe('ยังไม่กรอกธนาคารและเลขบัญชีของผู้รับเงิน'));
  test('ว่างทั้งคู่ตอนจ่ายเงินสด = ผ่าน', () =>
    expect(payeeBankProblem(tire, { payment_method: 'เงินสด' })).toBeNull());
  test('กรอกเลขแต่ไม่เลือกธนาคาร', () =>
    expect(payeeBankProblem(tire, { payment_method: 'เงินสด', payee_account_no: '1234567890' })).toBe('ยังไม่เลือกธนาคารของผู้รับเงิน'));
  test('เลือกธนาคารแต่ไม่กรอกเลข', () =>
    expect(payeeBankProblem(weigh, { payee_bank: 'KTB' })).toBe('ยังไม่กรอกเลขบัญชีของผู้รับเงิน'));
  test('เลขหลักไม่ตรงธนาคาร', () =>
    expect(payeeBankProblem(weigh, { payee_bank: 'KBANK', payee_account_no: '12345' })).toMatch(/10 หลัก/));
});
