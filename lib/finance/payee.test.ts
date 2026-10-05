import { describe, expect, test } from 'bun:test';
import {
  PAYEE_SELF, PAYEE_SUPPLIER, canSubmitPayee, kbankAccountError, sanitizePayeeFileName, selfPayeeState,
} from './payee';

const acc = (status: 'ACTIVE' | 'INACTIVE') => ({ status }) as any;
const req = (status: string) => ({ status }) as any;

describe('kbankAccountError', () => {
  test('accepts 10 digits with spaces/dashes', () => {
    expect(kbankAccountError('123-4-56789-0')).toBeNull();
    expect(kbankAccountError(' 1234567890 ')).toBeNull();
  });
  test('rejects wrong length / non-digits / empty', () => {
    const msg = 'เลขที่บัญชีกสิกรไทยต้องมี 10 หลัก';
    expect(kbankAccountError('123456789')).toBe(msg);
    expect(kbankAccountError('12345678901')).toBe(msg);
    expect(kbankAccountError('12345abcde')).toBe(msg);
    expect(kbankAccountError('')).toBe(msg);
    expect(kbankAccountError(null)).toBe(msg);
  });
});

describe('selfPayeeState', () => {
  test('rules', () => {
    expect(selfPayeeState({ account: acc('ACTIVE'), request: req('PENDING') })).toBe('ready_change_pending');
    expect(selfPayeeState({ account: acc('ACTIVE'), request: req('REJECTED') })).toBe('ready');
    expect(selfPayeeState({ account: acc('ACTIVE'), request: null })).toBe('ready');
    expect(selfPayeeState({ account: null, request: req('PENDING') })).toBe('pending');
    expect(selfPayeeState({ account: acc('INACTIVE'), request: req('PENDING') })).toBe('pending');
    expect(selfPayeeState({ account: null, request: req('REJECTED') })).toBe('rejected');
    expect(selfPayeeState({ account: acc('INACTIVE'), request: req('REJECTED') })).toBe('rejected');
    expect(selfPayeeState({ account: null, request: req('APPROVED') })).toBe('none');
    expect(selfPayeeState({ account: null, request: req('CANCELLED') })).toBe('none');
    expect(selfPayeeState({ account: null, request: null })).toBe('none');
    expect(selfPayeeState(null)).toBe('none');
  });
});

describe('canSubmitPayee', () => {
  test('SELF needs an active master', () => {
    expect(canSubmitPayee(PAYEE_SELF, 'ready', 0)).toBe(true);
    expect(canSubmitPayee(PAYEE_SELF, 'ready_change_pending', 0)).toBe(true);
    for (const s of ['pending', 'rejected', 'none'] as const) expect(canSubmitPayee(PAYEE_SELF, s, 5)).toBe(false);
  });
  test('SUPPLIER needs at least one file, ignores self state', () => {
    expect(canSubmitPayee(PAYEE_SUPPLIER, 'none', 1)).toBe(true);
    expect(canSubmitPayee(PAYEE_SUPPLIER, 'ready', 0)).toBe(false);
  });
  test('unknown type is blocked', () => {
    expect(canSubmitPayee('', 'ready', 1)).toBe(false);
  });
});

describe('sanitizePayeeFileName', () => {
  test('keeps word chars, dots, dashes and Thai', () => {
    expect(sanitizePayeeFileName('สมุดบัญชี 1.jpg')).toBe('สมุดบัญชี_1.jpg');
  });
  test('strips paths and leading dots', () => {
    expect(sanitizePayeeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizePayeeFileName('.hidden')).toBe('hidden');
    expect(sanitizePayeeFileName('')).toBe('file');
  });
});
