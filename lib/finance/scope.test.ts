import { describe, expect, test } from 'bun:test';
import { canListAll, filterByScope, isAdvanceItem } from './scope';

describe('isAdvanceItem', () => {
  test('form_code ADV', () => expect(isAdvanceItem({ form_code: 'ADV' })).toBe(true));
  test('form_type Advance', () => expect(isAdvanceItem({ form_type: 'Advance' })).toBe(true));
  test('IT form_code', () => expect(isAdvanceItem({ form_code: 'ISSUE_IT' })).toBe(false));
  test('empty object', () => expect(isAdvanceItem({})).toBe(false));
});

describe('filterByScope', () => {
  const items = [
    { form_code: 'ADV', id: 1 },
    { form_code: 'ISSUE_IT', id: 2 },
    { form_type: 'Advance', id: 3 },
    { form_code: 'SERVICE_IT', id: 4 },
  ];

  test('it scope keeps non-advance items', () => {
    expect(filterByScope(items, 'it')).toEqual([
      { form_code: 'ISSUE_IT', id: 2 },
      { form_code: 'SERVICE_IT', id: 4 },
    ]);
  });

  test('advance scope keeps only advance items', () => {
    expect(filterByScope(items, 'advance')).toEqual([
      { form_code: 'ADV', id: 1 },
      { form_type: 'Advance', id: 3 },
    ]);
  });

  test('non-array input is returned unchanged', () => {
    const notArray = { error: 'oops' };
    expect(filterByScope(notArray, 'it')).toBe(notArray);
    expect(filterByScope(null, 'advance')).toBe(null);
  });
});

describe('canListAll', () => {
  test('IT scope: only a session IT admin who asks for role a', () => {
    expect(canListAll({ clientRole: 'a', scope: 'it', sessionRole: 'a' })).toBe(true);
    expect(canListAll({ clientRole: 'a', scope: 'it', sessionRole: 'u' })).toBe(false);
    expect(canListAll({ clientRole: 'u', scope: 'it', sessionRole: 'a' })).toBe(false);
    expect(canListAll({ clientRole: '', scope: 'it', sessionRole: 'a' })).toBe(false);
  });
  test('ADV scope: only finance, never the IT admin role', () => {
    expect(canListAll({ clientRole: 'a', scope: 'advance', sessionRole: 'a', isFinance: false })).toBe(false);
    expect(canListAll({ clientRole: 'a', scope: 'advance', sessionRole: 'a' })).toBe(false);
    expect(canListAll({ clientRole: 'a', scope: 'advance', sessionRole: 'u', isFinance: true })).toBe(true);
    expect(canListAll({ clientRole: 'u', scope: 'advance', sessionRole: 'u', isFinance: true })).toBe(false);
  });
});
