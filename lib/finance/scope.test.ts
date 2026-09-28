import { describe, expect, test } from 'bun:test';
import { filterByScope, isAdvanceItem } from './scope';

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
