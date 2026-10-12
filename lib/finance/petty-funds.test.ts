import { describe, expect, test } from 'bun:test';
import type { PettyBalance, PettyFund } from '@/app/finance/types-petty';
import { fundSummaryRows, grandTotals } from './petty-funds';

const funds: PettyFund[] = [
  { id: 1, branch_code: '03', division_code: 'B02', holder_employee_id: '670108', holder_name: 'ณรงค์กรณ์ อัจฉริยญาติ', fund_limit: 10000, is_active: true },
  { id: 3, branch_code: '03', division_code: 'A01', holder_employee_id: '990099', holder_name: null, fund_limit: 5000, is_active: true },
  { id: 4, branch_code: '02', division_code: 'B01', holder_employee_id: '111111', holder_name: 'สมศรี', fund_limit: null, is_active: false },
];
const balances: Record<number, PettyBalance> = {
  1: { fund_id: 1, holder_employee_id: '670108', advance_outstanding: 12200, petty_committed: 1763, available: 10437, fund_limit: 10000 },
  3: { fund_id: 3, holder_employee_id: '990099', advance_outstanding: 0, petty_committed: 500, available: -500, fund_limit: 5000 },
};

describe('fundSummaryRows — หน้าสรุปยอดกองทุนของการเงิน', () => {
  const rows = fundSummaryRows(funds, balances);
  test('หนึ่งแถวต่อกองทุน เรียงสาขา-ดิวิชัน', () =>
    expect(rows.map(r => `${r.branch_code}-${r.division_code}`)).toEqual(['02-B01', '03-A01', '03-B02']));
  test('ชื่อผู้ถือเงิน ไม่มีก็รหัส', () => {
    expect(rows.find(r => r.id === 1)?.holder).toBe('ณรงค์กรณ์ อัจฉริยญาติ');
    expect(rows.find(r => r.id === 3)?.holder).toBe('990099');
  });
  test('ยอดจาก balance และธงติดลบ', () => {
    const a01 = rows.find(r => r.id === 3)!;
    expect(a01.available).toBe(-500);
    expect(a01.negative).toBe(true);
    expect(rows.find(r => r.id === 1)?.negative).toBe(false);
  });
  test('กองทุนที่ยังไม่มี balance ขึ้นเป็น null ไม่พัง', () => {
    const closed = rows.find(r => r.id === 4)!;
    expect(closed.available).toBeNull();
    expect(closed.is_active).toBe(false);
  });
  test('รวมทั้งหมดเฉพาะกองทุนที่มีตัวเลข', () =>
    expect(grandTotals(rows)).toEqual({ advance_outstanding: 12200, petty_committed: 2263, available: 9937 }));
});
