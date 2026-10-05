import { describe, expect, test } from 'bun:test';
import { latestReturnRemark } from './returnInfo';

describe('latestReturnRemark', () => {
  test('none', () => expect(latestReturnRemark([])).toBe(''));
  test('null safe', () => expect(latestReturnRemark(null)).toBe(''));
  test('ignores other actions', () =>
    expect(latestReturnRemark([{ action: 'VOUCHER', remark: 'x', created_at: '2026-10-01' }])).toBe(''));
  test('takes the latest RETURN', () =>
    expect(latestReturnRemark([
      { action: 'RETURN', remark: 'เก่า', created_at: '2026-10-01T10:00:00' },
      { action: 'RETURN', remark: 'ใหม่', created_at: '2026-10-03T10:00:00' },
      { action: 'RESUBMIT', remark: null, created_at: '2026-10-04T10:00:00' },
    ])).toBe('ใหม่'));
  test('list order breaks ties', () =>
    expect(latestReturnRemark([
      { action: 'RETURN', remark: 'a', created_at: null },
      { action: 'RETURN', remark: 'b', created_at: null },
    ])).toBe('b'));
});
