import { describe, expect, test } from 'bun:test';
import type { PettyClaim } from '@/app/finance/types-petty';
import {
  BLANK, applyFilters, createdDate, createdTime, distinctOptions, monthLabel, pettyColumns, sortRows,
} from './petty-grid';

const claim = (over: Partial<PettyClaim>): PettyClaim => ({
  id: 1, form_id: 'LB-1', fund_id: 1, expense_type: 'WEIGH', expense_date: '2026-10-10', period_from: null, period_to: null,
  driver_employee_id: null, driver_name: null, payee_name: 'A', amount: 100, dd_no: null, receipt_no: null,
  status: 'PENDING_APPROVAL', created_by: '680043', created_by_name: 'กฤตบุญ', approved_by: null, approved_at: null,
  transfer_date: null, review_remark: null, return_reason: null, reviewed_by: null, reviewed_at: null,
  submitted_to_acc_at: null, dup_override_reason: null, batch_id: null, items: [], ...over,
}) as PettyClaim;

const cols = pettyColumns(code => (code === 'WEIGH' ? 'ค่าชั่ง' : 'ค่ายาง'));
const col = (k: string) => cols.find(c => c.key === k)!;

const rows = [
  claim({ id: 1, amount: 300, payee_name: 'ข', dd_no: 'DD1', status: 'CLOSED' }),
  claim({ id: 2, amount: 50, payee_name: 'ก', expense_type: 'TIRE', expense_date: '2026-09-02' }),
  claim({ id: 3, amount: 1000, payee_name: null, status: 'RETURNED' }),
];

describe('sortRows', () => {
  test('amount numeric both ways', () => {
    expect(sortRows(rows, col('amount'), 'asc').map(r => r.id)).toEqual([2, 1, 3]);
    expect(sortRows(rows, col('amount'), 'desc').map(r => r.id)).toEqual([3, 1, 2]);
  });
  test('blank payee stays last in both directions', () => {
    expect(sortRows(rows, col('payee'), 'asc').map(r => r.id)).toEqual([2, 1, 3]);
    expect(sortRows(rows, col('payee'), 'desc').map(r => r.id)).toEqual([1, 2, 3]);
  });
  test('status follows flow order, not alphabet', () => {
    expect(sortRows(rows, col('status'), 'asc').map(r => r.status)).toEqual(['PENDING_APPROVAL', 'RETURNED', 'CLOSED']);
  });
});

describe('filters', () => {
  test('nothing ticked = no filter', () => {
    expect(applyFilters(rows, cols, {})).toHaveLength(3);
    expect(applyFilters(rows, cols, { type: [] })).toHaveLength(3);
  });
  test('ticked values keep only those rows; blank matches (ว่าง)', () => {
    expect(applyFilters(rows, cols, { type: ['ค่ายาง'] }).map(r => r.id)).toEqual([2]);
    expect(applyFilters(rows, cols, { dd: [BLANK] }).map(r => r.id)).toEqual([2, 3]);
  });
  test('columns combine with AND; except skips its own column', () => {
    const f = { dd: [BLANK], type: ['ค่าชั่ง'] };
    expect(applyFilters(rows, cols, f).map(r => r.id)).toEqual([3]);
    expect(applyFilters(rows, cols, f, 'type').map(r => r.id)).toEqual([2, 3]);
  });
});

describe('distinctOptions', () => {
  test('counts and sorts by column order, blank last', () => {
    expect(distinctOptions(rows, col('dd'))).toEqual([{ value: 'DD1', count: 1 }, { value: BLANK, count: 2 }]);
    expect(distinctOptions(rows, col('period')).map(o => o.value)).toEqual(['ก.ย. 2026', 'ต.ค. 2026']);
  });
});

test('monthLabel', () => {
  expect(monthLabel('2026-10-14')).toBe('ต.ค. 2026');
  expect(monthLabel('')).toBe('');
});

describe('created', () => {
  const c = (over: Partial<PettyClaim>) => claim({ created_at: '2026-10-20T18:30:00+00:00', ...over }); // = 21/10 01:30 ไทย
  test('created date and time are Bangkok time', () => {
    expect(createdDate(c({}))).toBe('2026-10-21');
    expect(createdTime(c({}))).toBe('01:30');
    expect(createdDate(c({ created_at: null }))).toBe('');
  });
});
