import { describe, expect, test } from 'bun:test';
import { accountCodeLine, accountGroupLine, divisionAllowed, divisionShortName, fundsForExpenseType } from './petty-account-code';

describe('รหัสค่าใช้จ่ายของบัญชี', () => {
  test('B02 → "B02 ฝ่ายยานยนต์"', () => expect(accountCodeLine({ division_code: 'B02' })).toBe('B02 ฝ่ายยานยนต์'));
  test('B01 ใช้ชื่อเต็มตามบัญชี', () =>
    expect(accountCodeLine({ division_code: 'B01' })).toBe('B01 ฝ่ายจัดส่ง (ศลบ.) / ฝ่ายศูนย์ปฏิบัติการ (สสบ. และ ศบก.)'));
  test('B05 มีในตารางแม้ยังไม่มีวงเงิน', () => expect(accountCodeLine({ division_code: 'B05' })).toBe('B05 ฝ่ายวิเคราะห์ข้อมูลและต้นทุน'));
  test('รหัสที่บัญชีไม่รู้จัก พิมพ์รหัสเฉย ๆ · ไม่มีวงเงิน = ว่าง', () => {
    expect(accountCodeLine({ division_code: 'Z09' })).toBe('Z09');
    expect(accountCodeLine(null)).toBe('');
  });
  test('กลุ่ม B = Operation & Support', () => expect(accountGroupLine('B02')).toBe('B Operation & Support'));
  test('ชื่อสั้นใช้ในดรอปดาวน์', () => expect(divisionShortName('B04')).toBe('จป.'));
});

describe('ประเภทการเบิก ↔ แผนกที่เบิกได้', () => {
  test('ค่าชั่งน้ำหนัก เบิกได้ B01 B02 B04 B05 แต่ไม่ใช่ A04', () => {
    for (const d of ['B01', 'B02', 'B04', 'B05']) expect(divisionAllowed('WEIGH', d)).toBe(true);
    expect(divisionAllowed('WEIGH', 'A04')).toBe(false);
  });
  test('ยาง/ซ่อมฉุกเฉิน เบิกได้แค่ยานยนต์', () => {
    expect(divisionAllowed('TIRE', 'B02')).toBe(true);
    expect(divisionAllowed('TIRE', 'B01')).toBe(false);
    expect(divisionAllowed('REPAIR', 'B04')).toBe(false);
  });
  test('ประเภทที่บัญชียังไม่กำหนด (ทางด่วน/เดินทาง) เปิดได้ทุกแผนก', () => {
    expect(divisionAllowed('TOLL', 'A04')).toBe(true);
    expect(divisionAllowed('', 'A04')).toBe(true);
  });
  test('fundsForExpenseType กรองวงเงินตามกติกา', () => {
    const funds = [{ id: 1, division_code: 'B02' }, { id: 2, division_code: 'A04' }, { id: 3, division_code: 'B01' }];
    expect(fundsForExpenseType('TIRE', funds).map(f => f.id)).toEqual([1]);
    expect(fundsForExpenseType('WEIGH', funds).map(f => f.id)).toEqual([1, 3]);
    expect(fundsForExpenseType('TOLL', funds).map(f => f.id)).toEqual([1, 2, 3]);
  });
});
