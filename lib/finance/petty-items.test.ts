import { describe, expect, test } from 'bun:test';
import { claimTotal, lineAmount, normalizePlate, parseTruckPaste, periodOf } from './petty-items';

describe('normalizePlate', () => {
  test('dash and space are the same truck', () => {
    expect(normalizePlate('71-4285')).toBe(normalizePlate('71 4285'));
    expect(normalizePlate('71-4285')).toBe('714285');
  });
  test('trailing space ignored', () => expect(normalizePlate('71-4285 ')).toBe('714285'));
  test('thai letters kept', () => expect(normalizePlate('70-ขก 1234')).toBe('70ขก1234'));
  test('latin uppercased', () => expect(normalizePlate('f014')).toBe('F014'));
  test('blank', () => expect(normalizePlate(null)).toBe(''));
});

describe('totals', () => {
  test('real voucher: 16 trucks, 3 rates', () => {
    const items = [
      ...Array(12).fill({ qty: 1, rate: 100 }),
      ...Array(3).fill({ qty: 1, rate: 120 }),
      { qty: 1, rate: 80 },
    ];
    expect(claimTotal(items)).toBe(1640);
  });
  test('line rounds to satang', () => expect(lineAmount(1.5, 33.333)).toBe(50));
  test('total is sum of rounded lines, not rounded sum', () => {
    const items = Array(3).fill({ qty: 1, rate: 0.005 });
    expect(claimTotal(items)).toBe(0.03);
  });
  test('empty is zero', () => expect(claimTotal([])).toBe(0));
  test('blank rate counts as zero, never NaN', () => expect(claimTotal([{ qty: 1, rate: NaN }])).toBe(0));
});

describe('periodOf', () => {
  test('min and max', () => {
    expect(periodOf([{ event_date: '2026-09-24' }, { event_date: '2026-09-17' }]))
      .toEqual({ from: '2026-09-17', to: '2026-09-24' });
  });
  test('empty', () => expect(periodOf([])).toEqual({ from: null, to: null }));
});

describe('parseTruckPaste', () => {
  test('spaces, commas and newlines all split', () => {
    expect(parseTruckPaste('161 144, F014\nF016')).toEqual(['161', '144', 'F014', 'F016']);
  });
  test('keeps duplicates — ของจริงมีรถซ้ำในใบเดียว', () => {
    expect(parseTruckPaste('1093 1093')).toEqual(['1093', '1093']);
  });
  test('drops empty fragments', () => expect(parseTruckPaste(' , ,161,, ')).toEqual(['161']));
  test('blank input', () => expect(parseTruckPaste('')).toEqual([]));
});
