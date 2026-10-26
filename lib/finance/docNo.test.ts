import { describe, expect, test } from 'bun:test';
import { clearDocNoError, docNoChanges, docNoEditError, duplicateText, editableDocFields } from './docNo';

describe('docNo', () => {
  test('ไม่ล็อก 10 หลักแล้ว ยาวเท่าไหร่ก็ได้ถึง 100 ตัว (ผู้ใช้สั่ง 26/10/2026)', () => {
    expect(clearDocNoError('CL69100001')).toBeNull();
    expect(clearDocNoError(' 6910000123 ')).toBeNull();
    expect(clearDocNoError('CL1')).toBeNull();
    expect(clearDocNoError('CL691000012345')).toBeNull();
    expect(clearDocNoError('A'.repeat(100))).toBeNull();
  });
  test('ว่างต้องกรอก', () => expect(clearDocNoError('  ')).toBe('กรุณากรอกเลขที่เอกสารเคลียร์เงิน'));
  test('มีขีด เว้นวรรค หรือภาษาไทยไม่ผ่าน และไม่พูดถึง 10 หลัก', () => {
    for (const bad of ['CL-6910001', 'เลข1234567', 'CL 69']) {
      expect(clearDocNoError(bad)).toContain('ตัวเลขกับอักษรอังกฤษ');
      expect(clearDocNoError(bad)).not.toContain('10 หลัก');
    }
  });
  test('ยาวเกิน 100 ตัวไม่ผ่าน', () => expect(clearDocNoError('A'.repeat(101))).toContain('100'));
  test('ข้อความเลขซ้ำ', () => {
    expect(duplicateText('voucher_no', ' SADV2610-011 ', ['ADV-2610-003'])).toBe('เลขที่ตั้งเบิก SADV2610-011 ซ้ำกับใบ ADV-2610-003');
    expect(duplicateText('clear_doc_no', 'X', ['1', '2', '3', '4', '5', '6', '7'])).toContain('และอีก 2 ใบ');
  });
});

describe('การเงินแก้เลขที่เอกสารที่กรอกผิด (ผู้ใช้สั่ง 26/10/2026)', () => {
  const fin = { voucher_no: 'PV-1', payment_doc_no: 'PAY-1', clear_doc_no: null };
  test('แก้ได้เฉพาะเลขที่มีอยู่แล้ว', () => {
    expect(editableDocFields(fin)).toEqual(['voucher_no', 'payment_doc_no']);
    expect(editableDocFields({ voucher_no: 'PV-1', payment_doc_no: ' ', clear_doc_no: 'CL1' })).toEqual(['voucher_no', 'clear_doc_no']);
    expect(editableDocFields(null)).toEqual([]);
  });
  test('ส่งเฉพาะช่องที่เปลี่ยนจริง ตัดช่องว่าง', () => {
    expect(docNoChanges(fin, { voucher_no: ' PV-9 ', payment_doc_no: 'PAY-1' })).toEqual({ voucher_no: 'PV-9' });
    expect(docNoChanges(fin, { voucher_no: 'PV-1' })).toEqual({});
  });
  test('ข้อความเตือนก่อนบันทึก', () => {
    expect(docNoEditError({}, 'ผิด')).toBe('ไม่มีเลขที่เปลี่ยน');
    expect(docNoEditError({ voucher_no: 'PV-9' }, '  ')).toBe('กรุณาระบุเหตุผลที่แก้ไข');
    expect(docNoEditError({ voucher_no: '' }, 'ผิด')).toBe('กรุณากรอกเลขที่ตั้งเบิก');
    expect(docNoEditError({ payment_doc_no: 'P'.repeat(51) }, 'ผิด')).toContain('50');
    expect(docNoEditError({ clear_doc_no: 'CL-2' }, 'ผิด')).toContain('ตัวเลขกับอักษรอังกฤษ');
    expect(docNoEditError({ voucher_no: 'PV-9', clear_doc_no: 'CL2' }, 'ผิด')).toBeNull();
  });
});
