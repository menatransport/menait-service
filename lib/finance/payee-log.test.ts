import { describe, expect, test } from 'bun:test';
import { formatPayeeChanges } from './payee-log';

describe('formatPayeeChanges', () => {
  test('pairs render before → after with Thai labels', () => {
    expect(formatPayeeChanges({ account_no: ['1', '2'], status: ['ACTIVE', 'INACTIVE'] }))
      .toEqual(['เลขที่บัญชี: 1 → 2', 'สถานะ: ACTIVE → INACTIVE']);
  });
  test('scalars, nulls and unknown fields are tolerated', () => {
    expect(formatPayeeChanges({ account_name: 'x', foo: [null, 'y'] })).toEqual(['ชื่อบัญชี: x', 'foo: - → y']);
  });
  test('non-objects give nothing', () => {
    expect(formatPayeeChanges(null)).toEqual([]);
    expect(formatPayeeChanges('a')).toEqual([]);
    expect(formatPayeeChanges([1])).toEqual([]);
  });
});
