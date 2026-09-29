import { describe, expect, test } from 'bun:test';
import { BANKS, accountNoError, bankLabel, formatAccountNo, normalizeAccountNo } from './bank';

describe('bank account', () => {
  test('normalize strips spaces and dashes', () => {
    expect(normalizeAccountNo(' 123-4-56789-0 ')).toBe('1234567890');
  });
  test('valid lengths per bank', () => {
    expect(accountNoError('KBANK', '123-4-56789-0')).toBeNull();
    expect(accountNoError('GSB', '0200-1234-5678')).toBeNull();
    expect(accountNoError('UOB', '12345678901')).toBeNull();
    expect(accountNoError('OTHER', '123456789012')).toBeNull();
  });
  test('messages match the BE exactly', () => {
    expect(accountNoError('KBANK', '123456789')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก');
    expect(accountNoError('GSB', '1234567890')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารออมสิน ต้องเป็นตัวเลข 12 หลัก');
    expect(accountNoError('UOB', '123456789')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารยูโอบี ต้องเป็นตัวเลข 10–12 หลัก');
    expect(accountNoError('KBANK', '๑๒๓๔๕๖๗๘๙๐')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก');
    expect(accountNoError('KBANK', '')).toBe('เลขที่บัญชีไม่ถูกต้อง: ธนาคารกสิกรไทย ต้องเป็นตัวเลข 10 หลัก');
  });
  test('format and label', () => {
    expect(formatAccountNo('1234567890')).toBe('123-4-56789-0');
    expect(formatAccountNo('020012345678')).toBe('020012345678');
    expect(formatAccountNo(null)).toBe('-');
    expect(bankLabel('KTB')).toBe('ธนาคารกรุงไทย');
    expect(bankLabel('ZZZ')).toBe('ZZZ');
    expect(bankLabel(null)).toBe('-');
  });
  test('16 banks', () => {
    expect(Object.keys(BANKS)).toEqual(['BBL', 'KBANK', 'KTB', 'SCB', 'BAY', 'TTB', 'GSB', 'BAAC', 'GHB',
      'UOB', 'CIMBT', 'LHB', 'KKP', 'TISCO', 'ICBCT', 'IBANK']);
  });
});
