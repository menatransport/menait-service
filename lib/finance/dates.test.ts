import { describe, expect, test } from 'bun:test';
import { isBeforeToday } from './dates';

describe('isBeforeToday', () => {
  test('yesterday is before today', () => expect(isBeforeToday('2026-09-27', '2026-09-28')).toBe(true));
  test('same day is not before', () => expect(isBeforeToday('2026-09-28', '2026-09-28')).toBe(false));
  test('future is not before', () => expect(isBeforeToday('2026-09-29', '2026-09-28')).toBe(false));
  test('empty value is not before', () => expect(isBeforeToday('', '2026-09-28')).toBe(false));
});
