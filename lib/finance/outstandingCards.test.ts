import { expect, test } from 'bun:test';
import { outstandingCards } from './outstandingCards';
import type { AdvanceSummary } from './advanceQuery';

const base: AdvanceSummary = {
  counts: { AWAITING_VOUCHER: 2, AWAITING_PAYMENT: 2, AWAITING_CLEARING: 5, RETURNED: 0, CLEARING_APPROVAL: 1,
    AWAITING_REVIEW: 7, SENT_BACK: 2, CLOSED: 25 },
  overdue: 4,
  outstanding_amount: 87500,
  outstanding_by_status: { AWAITING_CLEARING: 32000, CLEARING_APPROVAL: 5000, AWAITING_REVIEW: 42000, SENT_BACK: 8500,
    AWAITING_VOUCHER: 0, CLOSED: 0 },
  overdue_amount: 21500,
};

test('no split from the BE → null (page keeps the old tiles)', () => {
  expect(outstandingCards(null)).toBeNull();
  expect(outstandingCards({ ...base, outstanding_by_status: undefined })).toBeNull();
});

test('total, then the 4 statuses in flow order (no overdue card)', () => {
  const cards = outstandingCards(base)!;
  expect(cards.map(c => [c.key, c.amount, c.hint])).toEqual([
    ['total', 87500, '15 ใบ รวมทุกสถานะ'],
    ['AWAITING_CLEARING', 32000, '5 ใบ'],
    ['CLEARING_APPROVAL', 5000, '1 ใบ'],
    ['AWAITING_REVIEW', 42000, '7 ใบ'],
    ['SENT_BACK', 8500, '2 ใบ'],
  ]);
  expect(cards[0].tone).toBe('total');
});

test('overdue tickets and money ride on รอเคลียร์ / ส่งกลับแก้ไข only', () => {
  const cards = outstandingCards({ ...base, overdue_by_status: {
    AWAITING_CLEARING: { count: 3, amount: 13000 }, SENT_BACK: { count: 1, amount: 8500 },
    AWAITING_REVIEW: { count: 0, amount: 0 }, CLEARING_APPROVAL: { count: 0, amount: 0 } } })!;
  const by = Object.fromEntries(cards.map(c => [c.key, c.overdue]));
  expect(by.AWAITING_CLEARING).toEqual({ count: 3, amount: 13000 });
  expect(by.SENT_BACK).toEqual({ count: 1, amount: 8500 });
  expect(by.CLEARING_APPROVAL).toBeUndefined();
  expect(by.AWAITING_REVIEW).toBeUndefined();
  expect(by.total).toBeUndefined();
});

test('no overdue split from the BE → no overdue line; a status missing from it reads as 0', () => {
  expect(outstandingCards(base)!.some(c => c.overdue)).toBe(false);
  const cards = outstandingCards({ ...base, overdue_by_status: {} })!;
  expect(cards.find(c => c.key === 'SENT_BACK')!.overdue).toEqual({ count: 0, amount: 0 });
});

test('money outside the 4 statuses shows as one extra card so the cards add up', () => {
  const cards = outstandingCards({ ...base, outstanding_amount: 87510.5 })!;
  const other = cards.find(c => c.key === 'other')!;
  expect(other.amount).toBe(10.5);
  expect(cards.at(-1)).toBe(other);
});

test('float noise below a satang is not an extra card', () => {
  const cards = outstandingCards({ ...base, outstanding_amount: 87500.004 })!;
  expect(cards.some(c => c.key === 'other')).toBe(false);
});

test('missing statuses read as 0', () => {
  const cards = outstandingCards({ counts: {}, overdue: 0, outstanding_amount: 0, outstanding_by_status: {} })!;
  expect(cards.map(c => c.amount)).toEqual([0, 0, 0, 0, 0]);
  expect(cards[0].hint).toBe('0 ใบ รวมทุกสถานะ');
});
