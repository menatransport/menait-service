import { describe, expect, test } from 'bun:test';
import { claimExpenseCode, expenseCodeFor, expenseCodeLabel, expenseCodeReason } from './petty-expense-code';

describe('รหัสใบสำคัญจ่าย (ข้อ 8 ผู้ใช้สั่ง 7/11/2026)', () => {
  test('พจร. → x500 ทุกฟลีท', () => {
    expect(expenseCodeFor('3B02', [{ driver_role: 'พจส.', fleet: 'Mixer L' }, { driver_role: 'พจร.' }])).toBe('3500');
    expect(expenseCodeFor('2B01', [{ driver_role: 'พจร.' }])).toBe('2500');
  });
  test('พจส. โม่ → 3200 ศลบ / 2100 สสบ · ไม่รู้ฟลีทแต่เป็น พจส. → 3200', () => {
    expect(expenseCodeFor('3B02', [{ driver_role: 'พจส.', fleet: 'Mixer S' }])).toBe('3200');
    expect(expenseCodeFor('3B02', [{ driver_role: 'พจส.' }])).toBe('3200');
    expect(expenseCodeFor('2B02', [{ driver_role: 'พจส.', fleet: 'Mixer L' }])).toBe('2100');
  });
  test('Trailer / Side curtain → 3300 ศลบ', () => {
    expect(expenseCodeFor('3B02', [{ fleet: 'Trailer' }])).toBe('3300');
    expect(expenseCodeFor('3B02', [{ driver_role: 'พจส.', fleet: 'Side curtain' }])).toBe('3300');
  });
  test('สกท หรือใบไม่มีคนขับ → ว่าง ใช้รหัสแผนกผู้เบิก', () => {
    expect(expenseCodeFor('1B06', [{ driver_role: 'พจส.' }])).toBe('');
    expect(expenseCodeFor('3B02', [{ ref_no: 'x' }])).toBe('');
    expect(claimExpenseCode({ expense_code: null, cost_center: '3B01' })).toBe('3B01');
    expect(claimExpenseCode({ expense_code: '3200', cost_center: '3B02' })).toBe('3200');
  });
  test('ป้ายและเหตุผล', () => {
    expect(expenseCodeLabel('3200')).toBe('3200 ศลบ - บริการ');
    expect(expenseCodeReason([{ driver_role: 'พจร.' }])).toContain('รถร่วม');
    expect(expenseCodeReason([{ driver_role: 'พจส.', fleet: 'Mixer L' }])).toBe('จาก พจส. · Mixer L');
  });
});
