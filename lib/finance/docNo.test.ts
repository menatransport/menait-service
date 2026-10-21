import { describe, expect, test } from 'bun:test';
import { clearDocNoError, duplicateText } from './docNo';

describe('docNo', () => {
  test('10 หลักผ่าน', () => {
    expect(clearDocNoError('CL69100001')).toBeNull();
    expect(clearDocNoError(' 6910000123 ')).toBeNull();
  });
  test('ว่างต้องกรอก', () => expect(clearDocNoError('  ')).toBe('กรุณากรอกเลขที่เอกสารเคลียร์เงิน'));
  test('ไม่ครบหรือเกิน 10 หลัก บอกว่าตอนนี้กี่หลัก', () => {
    expect(clearDocNoError('CL6910001')).toContain('ตอนนี้ 9 หลัก');
    expect(clearDocNoError('CL691000012')).toContain('ตอนนี้ 11 หลัก');
  });
  test('มีขีดหรือภาษาไทยไม่ผ่าน', () => {
    expect(clearDocNoError('CL-6910001')).not.toBeNull();
    expect(clearDocNoError('เลข1234567')).not.toBeNull();
  });
  test('ข้อความเลขซ้ำ', () => {
    expect(duplicateText('voucher_no', ' SADV2610-011 ', ['ADV-2610-003'])).toBe('เลขที่ตั้งเบิก SADV2610-011 ซ้ำกับใบ ADV-2610-003');
    expect(duplicateText('clear_doc_no', 'X', ['1', '2', '3', '4', '5', '6', '7'])).toContain('และอีก 2 ใบ');
  });
});
