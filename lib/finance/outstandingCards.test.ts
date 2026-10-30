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

test('total, the 4 statuses in flow order, then overdue', () => {
  const cards = outstandingCards(base)!;
  expect(cards.map(c => [c.key, c.amount, c.hint])).toEqual([
    ['total', 87500, '15 ใบ รวมทุกสถานะ'],
    ['AWAITING_CLEARING', 32000, '5 ใบ'],
    ['CLEARING_APPROVAL', 5000, '1 ใบ'],
    ['AWAITING_REVIEW', 42000, '7 ใบ'],
    ['SENT_BACK', 8500, '2 ใบ'],
    ['overdue', 21500, '4 ใบ (อยู่ในยอดรวมแล้ว)'],
  ]);
  expect(cards[0].tone).toBe('total');
  expect(cards.at(-1)!.tone).toBe('alert');
});

test('money outside the 4 statuses shows as one extra card so the cards add up', () => {
  const cards = outstandingCards({ ...base, outstanding_amount: 87510.5 })!;
  const other = cards.find(c => c.key === 'other')!;
  expect(other.amount).toBe(10.5);
  expect(cards.indexOf(other)).toBe(5);
});

test('float noise below a satang is not an extra card', () => {
  const cards = outstandingCards({ ...base, outstanding_amount: 87500.004 })!;
  expect(cards.some(c => c.key === 'other')).toBe(false);
});

test('missing statuses and an older summary without overdue_amount read as 0', () => {
  const cards = outstandingCards({ counts: {}, overdue: 0, outstanding_amount: 0, outstanding_by_status: {} })!;
  expect(cards.map(c => c.amount)).toEqual([0, 0, 0, 0, 0, 0]);
  expect(cards[0].hint).toBe('0 ใบ รวมทุกสถานะ');
});
