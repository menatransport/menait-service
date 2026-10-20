import { describe, expect, test } from 'bun:test';
import { financeConfig, isFinanceUser, parseIdList } from './role';

describe('role', () => {
  test('parse', () => expect(parseIdList(' 4, 6 ,,')).toEqual(['4', '6']));
  test('department member', () => expect(isFinanceUser({ department_id: 6, employee_id: '1' }, ['4', '6'], [])).toBe(true));
  test('employee override', () => expect(isFinanceUser({ department_id: 21, employee_id: '680043' }, ['4', '6'], ['680043'])).toBe(true));
  test('not finance', () => expect(isFinanceUser({ department_id: 21, employee_id: '1' }, ['4', '6'], [])).toBe(false));
  test('missing data', () => expect(isFinanceUser({}, ['4', '6'], [])).toBe(false));
  test('config default', () => expect(financeConfig({}).deptIds).toEqual(['4', '6']));
  test('คุณป้อง (660057) เข้าหน้าการเงินได้เสมอ ไม่ต้องตั้ง env', () => expect(financeConfig({}).employeeIds).toContain('660057'));
  test('env ยังเพิ่มคนได้ และไม่ซ้ำ', () => expect(financeConfig({ FINANCE_EMPLOYEE_IDS: '680043,660057' }).employeeIds).toEqual(['660057', '680043']));
});
