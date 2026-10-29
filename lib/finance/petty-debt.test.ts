import { describe, expect, test } from 'bun:test';
import { needsDebtDoc } from './petty-debt';

describe('needsDebtDoc — มี พจร. ในใบ ต้องมีเลขที่ใบรับสภาพหนี้ (ทุกประเภท)', () => {
  test('any row is พจร.', () =>
    expect(needsDebtDoc({ items: [{ driver_role: 'พจส.' }, { driver_role: 'พจร.' }], detail: {} })).toBe(true));
  test('all พจส.', () => expect(needsDebtDoc({ items: [{ driver_role: 'พจส.' }], detail: {} })).toBe(false));
  test('single claims carry it in the header', () =>
    expect(needsDebtDoc({ items: [{}], detail: { driver_role: 'พจร.' } })).toBe(true));
  test('no detail at all', () => expect(needsDebtDoc({ items: [] })).toBe(false));
});
