import { describe, expect, test } from 'bun:test';
import {
  STATUS_LABELS, addDays, computeSettle, displayFileName, formatBaht, formatDate, parseAmount,
  settleLabel, todayBkk, toBkkYM, uniqueFileName,
} from './status';

describe('labels', () => {
  test('awaiting clearing label', () => expect(STATUS_LABELS.AWAITING_CLEARING).toBe('จ่ายแล้วรอเคลียร์'));
  test('awaiting review label', () => expect(STATUS_LABELS.AWAITING_REVIEW).toBe('รอบัญชีตรวจ'));
});

describe('addDays', () => {
  test('plus 7', () => expect(addDays('2026-06-25', 7)).toBe('2026-07-02'));
  test('crosses month end', () => expect(addDays('2026-06-28', 7)).toBe('2026-07-05'));
  test('invalid input gives empty string', () => expect(addDays('', 7)).toBe(''));
});

describe('parseAmount', () => {
  test('commas', () => expect(parseAmount('1,000.50')).toBe(1000.5));
  test('rounds to 2 decimals', () => expect(parseAmount('10.126')).toBe(10.13));
  test('blank is null, not zero', () => expect(parseAmount('  ')).toBeNull());
  test('garbage is null', () => expect(parseAmount('abc')).toBeNull());
  test('number passthrough', () => expect(parseAmount(4840)).toBe(4840));
});

describe('settle', () => {
  test('return', () => expect(computeSettle(1000, 800.5)).toBe(199.5));
  test('extra', () => expect(computeSettle(1000, 1250)).toBe(-250));
  test('labels', () => {
    expect(settleLabel(1)).toBe('รับคืน');
    expect(settleLabel(-1)).toBe('เบิกเพิ่ม');
    expect(settleLabel(0)).toBe('พอดี (ไม่มียอดคงค้าง)');
    expect(settleLabel(null)).toBe('-');
  });
});

describe('formatting', () => {
  test('baht', () => expect(formatBaht(12740)).toBe('12,740.00'));
  test('baht null', () => expect(formatBaht(null)).toBe('-'));
  test('date-only never shifts', () => expect(formatDate('2026-07-09')).toBe('09/07/26'));
  test('UTC datetime shown in Bangkok', () => expect(formatDate('2026-07-08T18:30:00+00:00')).toBe('09/07/26'));
  test('empty', () => expect(formatDate(null)).toBe('-'));
  test('todayBkk after 17:00 UTC is next day', () =>
    expect(todayBkk(new Date('2026-07-08T17:30:00Z'))).toBe('2026-07-09'));
});

describe('toBkkYM', () => {
  test('UTC datetime rolls into next day/month in Bangkok', () =>
    expect(toBkkYM('2026-07-31T18:00:00+00:00')).toBe('2026-08'));
  test('date-only string keeps its own month', () => expect(toBkkYM('2026-07-09')).toBe('2026-07'));
});

describe('file names', () => {
  test('same name gets unique key', () => {
    expect(uniqueFileName('slip.jpg', 1751980000000)).toBe('1751980000000-slip.jpg');
    expect(uniqueFileName('a/b.pdf', 1)).toBe('1-a_b.pdf');
  });
  test('display strips prefix', () => expect(displayFileName('1751980000000-slip.jpg')).toBe('slip.jpg'));
});
