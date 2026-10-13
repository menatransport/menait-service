import { describe, expect, test } from 'bun:test';
import { payeeAccountHint, payeeBankProblem, payeeBankRequired, payeeBankText } from './petty-payee';

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

describe('พร้อมเพย์', () => {
  test('เบอร์มือถือ 10 หลัก ผ่าน และพิมพ์แบบมีขีด', () => {
    expect(payeeBankProblem(weigh, { payee_account_type: 'promptpay', payee_account_no: '081-234-5678' })).toBeNull();
    expect(payeeBankText({ payee_account_type: 'promptpay', payee_account_no: '0812345678' })).toBe('พร้อมเพย์ 081-234-5678');
  });
  test('เลขบัตรประชาชน 13 หลัก ผ่าน', () => {
    expect(payeeBankProblem(weigh, { payee_account_type: 'promptpay', payee_account_no: '1234567890123' })).toBeNull();
    expect(payeeBankText({ payee_account_type: 'promptpay', payee_account_no: '1234567890123' })).toBe('พร้อมเพย์ 1-2345-67890-12-3');
  });
  test('หลักไม่ครบ / ไม่ใช่ตัวเลข = ไม่ผ่าน', () => {
    expect(payeeBankProblem(weigh, { payee_account_type: 'promptpay', payee_account_no: '123456789' })).toBe('พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก');
    expect(payeeBankProblem(weigh, { payee_account_type: 'promptpay', payee_account_no: '08123456ab' })).toMatch(/พร้อมเพย์/);
  });
  test('เลือกพร้อมเพย์แต่ยังไม่กรอก', () =>
    expect(payeeBankProblem(weigh, { payee_account_type: 'promptpay' })).toBe('ยังไม่กรอกเบอร์พร้อมเพย์ของผู้รับเงิน'));
  test('พร้อมเพย์ไม่สนธนาคารที่เคยเลือกค้างไว้', () =>
    expect(payeeBankProblem(weigh, { payee_account_type: 'promptpay', payee_bank: 'KBANK', payee_account_no: '0812345678' })).toBeNull());
  test('จ่ายเงินสด ไม่ต้องกรอกพร้อมเพย์', () =>
    expect(payeeBankProblem(tire, { payment_method: 'เงินสด', payee_account_type: 'promptpay' })).toBeNull());
});

describe('บัญชีธนาคาร เลขต้องครบหลัก', () => {
  test('กสิกร 9 หลัก ไม่ผ่าน บอกว่าต้อง 10 หลัก', () =>
    expect(payeeBankProblem(weigh, { payee_account_type: 'bank', payee_bank: 'KBANK', payee_account_no: '123456789' })).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก'));
  test('ออมสิน 12 หลัก ผ่าน', () =>
    expect(payeeBankProblem(weigh, { payee_bank: 'GSB', payee_account_no: '123456789012' })).toBeNull());
});

describe('payeeAccountHint — คำเตือนใต้ช่องขณะพิมพ์', () => {
  test('ยังไม่พิมพ์อะไร = ไม่เตือน', () => expect(payeeAccountHint({ payee_bank: 'KBANK' })).toBeNull());
  test('พิมพ์ไม่ครบ = เตือน', () => expect(payeeAccountHint({ payee_bank: 'KBANK', payee_account_no: '12345' })).toMatch(/10 หลัก/));
  test('ยังไม่เลือกธนาคาร แต่พิมพ์เลขแล้ว = บอกให้เลือกธนาคาร', () =>
    expect(payeeAccountHint({ payee_account_no: '1234567890' })).toBe('เลือกธนาคารก่อน จะได้ตรวจจำนวนหลักให้ถูก'));
  test('พร้อมเพย์พิมพ์ครบ = ไม่เตือน', () => expect(payeeAccountHint({ payee_account_type: 'promptpay', payee_account_no: '0812345678' })).toBeNull());
});
