import { describe, expect, test } from 'bun:test';
import { CLEAR_DOC_NO_LEN, clearDocNoError, docNoChanges, docNoEditError, duplicateText, editableDocFields } from './docNo';

describe('docNo', () => {
  test('14 หลักพอดี ตัวเลขหรืออักษรอังกฤษ (ผู้ใช้สั่ง 26/10/2026 เปลี่ยนจาก 10 หลัก)', () => {
    expect(clearDocNoError('CL691000012345')).toBeNull();
    expect(clearDocNoError(' 69100001234567 ')).toBeNull();
    expect(CLEAR_DOC_NO_LEN).toBe(14);
  });
  test('ว่างต้องกรอก', () => expect(clearDocNoError('  ')).toBe('กรุณากรอกเลขที่เอกสารเคลียร์เงิน'));
  test('มีขีด เว้นวรรค หรือภาษาไทยไม่ผ่าน', () => {
    for (const bad of ['CL-69100012345', 'เลข12345678901', 'CL 6910001234']) {
      expect(clearDocNoError(bad)).toContain('ตัวเลขกับอักษรอังกฤษ');
    }
  });
  test('ไม่ครบหรือเกิน 14 หลักไม่ผ่าน บอกว่าตอนนี้กี่หลัก', () => {
    expect(clearDocNoError('CL69100001')).toBe('เลขที่เอกสารเคลียร์เงินต้องมี 14 หลัก (ตอนนี้ 10 หลัก)');
    for (const bad of ['CL1', 'A'.repeat(13), 'A'.repeat(15)]) expect(clearDocNoError(bad)).toContain('14 หลัก');
  });
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
    expect(docNoEditError({})).toBe('ไม่มีเลขที่เปลี่ยน');
    expect(docNoEditError({ voucher_no: 'PV-9' })).toBeNull(); // เหตุผลไม่บังคับ เก็บประวัติไว้พอ (ผู้ใช้สั่ง 26/10/2026)
    expect(docNoEditError({ voucher_no: '' })).toBe('กรุณากรอกเลขที่ตั้งเบิก');
    expect(docNoEditError({ payment_doc_no: 'P'.repeat(51) })).toContain('50');
    expect(docNoEditError({ clear_doc_no: 'CL-2' })).toContain('ตัวเลขกับอักษรอังกฤษ');
    expect(docNoEditError({ clear_doc_no: 'CL2' })).toContain('14 หลัก');
    expect(docNoEditError({ voucher_no: 'PV-9', clear_doc_no: 'CL691000000002' })).toBeNull();
  });
});
