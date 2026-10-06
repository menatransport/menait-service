import { expect, test } from 'bun:test';
import { buildAdvanceQuery, fetchAllAdvances, monthEnd, tabCount, type AdvancePage } from './advanceQuery';
import type { AdvanceItem } from '@/app/finance/types';

const summary = { counts: { AWAITING_CLEARING: 3, SENT_BACK: 2, CLOSED: 5 }, overdue: 4, outstanding_amount: 100 };

test('monthEnd handles leap years and 31-day months', () => {
  expect(monthEnd('2028-02')).toBe('2028-02-29');
  expect(monthEnd('2026-02')).toBe('2026-02-28');
  expect(monthEnd('2026-12')).toBe('2026-12-31');
  expect(monthEnd('bad')).toBe('');
});

test('query carries tab, scope and paging; "all" cost center is dropped', () => {
  const qs = new URLSearchParams(buildAdvanceQuery(
    { q: ' abc ', startMonth: '2026-01', endMonth: '2026-03', costCenter: 'all' },
    { status: ['AWAITING_CLEARING', 'SENT_BACK'] }, 2, 20));
  expect(qs.get('status')).toBe('AWAITING_CLEARING,SENT_BACK');
  expect(qs.get('q')).toBe('abc');
  expect(qs.get('date_from')).toBe('2026-01-01');
  expect(qs.get('date_to')).toBe('2026-03-31');
  expect(qs.get('cost_center')).toBeNull();
  expect(qs.get('page')).toBe('2');
  expect(qs.get('page_size')).toBe('20');
});

test('overdue tab sends overdue=true and no status', () => {
  const qs = new URLSearchParams(buildAdvanceQuery({}, { overdue: true }, 1, 200));
  expect(qs.get('overdue')).toBe('true');
  expect(qs.get('status')).toBeNull();
});

test('tabCount sums statuses, uses overdue, or totals all', () => {
  expect(tabCount({ status: ['AWAITING_CLEARING', 'SENT_BACK'] }, summary)).toBe(5);
  expect(tabCount({ overdue: true }, summary)).toBe(4);
  expect(tabCount({}, summary)).toBe(10);
  expect(tabCount({}, null)).toBeNull();
});

test('fetchAllAdvances walks pages sequentially', async () => {
  const mk = (n: number) => ({ form_id: `F${n}` }) as AdvanceItem;
  const calls: number[] = [];
  const res = await fetchAllAdvances(async query => {
    const page = Number(new URLSearchParams(query).get('page'));
    calls.push(page);
    return { items: page < 3 ? [mk(page * 2), mk(page * 2 + 1)] : [mk(99)], total: 5, page, page_size: 2, summary } as AdvancePage;
  }, {}, {}, 2);
  expect(calls).toEqual([1, 2, 3]);
  expect(res.length).toBe(5);
});
