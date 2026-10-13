import { describe, expect, test } from 'bun:test';
import { fundLabel, fundLabelWithHolder } from './petty-fund-label';

describe('fundLabel', () => {
  test('สาขาและแผนกที่รู้จัก อ่านเป็นภาษาคน', () =>
    expect(fundLabel({ branch_code: '03', division_code: 'B02' })).toBe('วงเงินสดย่อย - ลาดกระบัง - ยานยนต์'));
  test('บัญชี/จป./บุคคล ตามรายการของการเงิน', () => {
    expect(fundLabel({ branch_code: '02', division_code: 'A04' })).toBe('วงเงินสดย่อย - สระบุรี - บัญชี');
    expect(fundLabel({ branch_code: '03', division_code: 'B04' })).toBe('วงเงินสดย่อย - ลาดกระบัง - จป.');
    expect(fundLabel({ branch_code: '01', division_code: 'A03' })).toBe('วงเงินสดย่อย - กรุงเทพฯ - บุคคล');
  });
  test('สาขา/แผนกที่ไม่รู้ชื่อ ไม่เดา ใช้รหัส', () =>
    expect(fundLabel({ branch_code: '09', division_code: 'Z9' })).toBe('วงเงินสดย่อย - สาขา 09 - Z9'));
});

describe('fundLabelWithHolder', () => {
  test('มีชื่อผู้ถือเงินต่อท้าย', () =>
    expect(fundLabelWithHolder({ branch_code: '03', division_code: 'B02', holder_name: 'ณรงค์กรณ์', holder_employee_id: '670108' }))
      .toBe('วงเงินสดย่อย - ลาดกระบัง - ยานยนต์ · ณรงค์กรณ์'));
  test('ไม่มีชื่อใช้รหัสพนักงาน', () =>
    expect(fundLabelWithHolder({ branch_code: '03', division_code: 'A01', holder_name: null, holder_employee_id: '990099' }))
      .toBe('วงเงินสดย่อย - ลาดกระบัง - บริหาร · 990099'));
});
