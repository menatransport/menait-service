import { describe, expect, test } from 'bun:test';
import { fundMapCounts, fundMapRows } from './petty-fund-map';
import { COST_CENTERS } from './petty-cost-centers';

const F = (id: number, branch_code: string, division_code: string) => ({ id, branch_code, division_code });
const funds = [F(1, '03', 'B02'), F(12, '03', 'A04'), F(13, '02', 'B02')];

describe('ตารางวงเงินตามแผนก (16/11/2026)', () => {
  test('ทุกศูนย์และแผนกมีหนึ่งแถว', () => {
    expect(fundMapRows(funds, 'GENERAL')).toHaveLength(COST_CENTERS.length);
  });
  test('แผนกมีวงเงินเอง · ไม่มีใช้บัญชีสาขาเดียวกัน · สาขาที่ไม่มีบัญชี = ไม่มีวงเงิน', () => {
    const rows = Object.fromEntries(fundMapRows(funds, 'GENERAL').map(r => [r.code, r]));
    expect(rows['3B02']).toMatchObject({ via: 'department', fund: { id: 1 } });
    expect(rows['3A02']).toMatchObject({ via: 'accounting', fund: { id: 12 } });
    expect(rows['2B02']).toMatchObject({ via: 'department', fund: { id: 13 } });
    expect(rows['2A01'].via).toBe('none');
  });
  test('ประเภทที่จำกัดแผนก (ยาง) วงเงินบัญชีใช้ไม่ได้', () => {
    const rows = Object.fromEntries(fundMapRows(funds, 'TIRE').map(r => [r.code, r]));
    expect(rows['3B02'].via).toBe('department');
    expect(rows['3A02'].via).toBe('none');
  });
  test('นับตามที่มา', () => {
    const c = fundMapCounts(fundMapRows(funds, 'GENERAL'));
    expect(c.department + c.accounting + c.none).toBe(COST_CENTERS.length);
  });
});
