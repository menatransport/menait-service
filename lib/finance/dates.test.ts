import { describe, expect, test } from 'bun:test';
import { formatDateFull, isBeforeToday, isoToLocalDate, localDateToIso, toBkkDate } from './dates';

describe('isBeforeToday', () => {
  test('yesterday is before today', () => expect(isBeforeToday('2026-09-27', '2026-09-28')).toBe(true));
  test('same day is not before', () => expect(isBeforeToday('2026-09-28', '2026-09-28')).toBe(false));
  test('future is not before', () => expect(isBeforeToday('2026-09-29', '2026-09-28')).toBe(false));
  test('empty value is not before', () => expect(isBeforeToday('', '2026-09-28')).toBe(false));
});

test('formatDateFull dd/mm/yyyy', () => {
  expect(formatDateFull('2026-09-29')).toBe('29/09/2026');
  expect(formatDateFull('')).toBe('');
  expect(formatDateFull(null)).toBe('');
});
test('local date round trip', () => {
  expect(localDateToIso(isoToLocalDate('2026-01-31'))).toBe('2026-01-31');
});
test('toBkkDate', () => {
  expect(toBkkDate('2026-10-01T00:00:00+00:00')).toBe('2026-10-01');
  expect(toBkkDate('2026-09-30T20:00:00+00:00')).toBe('2026-10-01'); // 03:00 BKK next day
  expect(toBkkDate('2026-10-01')).toBe('2026-10-01');
  expect(toBkkDate(null)).toBe('');
  expect(toBkkDate('garbage')).toBe('');
});
