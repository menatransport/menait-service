import { describe, expect, test } from 'bun:test';
import { accountingConfig, financeConfig, isAccountingUser, isFinanceUser, isTreasuryUser, parseIdList } from './role';

describe('role', () => {
  test('parse', () => expect(parseIdList(' 4, 6 ,,')).toEqual(['4', '6']));
  test('department member', () => expect(isFinanceUser({ department_id: 6, employee_id: '1' }, ['4', '6'], [])).toBe(true));
  test('employee override', () => expect(isFinanceUser({ department_id: 21, employee_id: '680043' }, ['4', '6'], ['680043'])).toBe(true));
  test('not finance', () => expect(isFinanceUser({ department_id: 21, employee_id: '1' }, ['4', '6'], [])).toBe(false));
  test('missing data', () => expect(isFinanceUser({}, ['4', '6'], [])).toBe(false));
  test('config default', () => expect(financeConfig({}).deptIds).toEqual(['4', '6']));
});

describe('บัญชี vs การเงิน แยกกัน', () => {
  const env = {
    ACCOUNTING_DEPARTMENT_IDS: '4',
    TREASURY_DEPARTMENT_IDS: '6',
    ACCOUNTING_EMPLOYEE_IDS: '80001',
    TREASURY_EMPLOYEE_IDS: '90001',
  };
  const cfg = accountingConfig(env);

  test('accounting by department', () =>
    expect(isAccountingUser({ department_id: 4 }, cfg)).toBe(true));
  test('treasury by department', () =>
    expect(isTreasuryUser({ department_id: 6 }, cfg)).toBe(true));
  test('accounting is not treasury', () =>
    expect(isTreasuryUser({ department_id: 4 }, cfg)).toBe(false));
  test('named individuals win over department', () =>
    expect(isAccountingUser({ department_id: 99, employee_id: '80001' }, cfg)).toBe(true));
  test('unset env means nobody — fail closed, not open', () => {
    const empty = accountingConfig({});
    expect(isAccountingUser({ department_id: 4 }, empty)).toBe(false);
    expect(isTreasuryUser({ department_id: 6 }, empty)).toBe(false);
  });
  test('the old finance default is untouched', () =>
    expect(financeConfig({}).deptIds).toEqual(['4', '6']));
});
