import { describe, expect, test } from 'bun:test';
import { debtDocProblem, needsDebtDoc } from './petty-debt';

describe('needsDebtDoc — มี พจร. ในใบ ต้องมีเลขที่ใบรับสภาพหนี้ (ทุกประเภท)', () => {
  test('any row is พจร.', () =>
    expect(needsDebtDoc({ items: [{ driver_role: 'พจส.' }, { driver_role: 'พจร.' }], detail: {} })).toBe(true));
  test('all พจส.', () => expect(needsDebtDoc({ items: [{ driver_role: 'พจส.' }], detail: {} })).toBe(false));
  test('single claims carry it in the header', () =>
    expect(needsDebtDoc({ items: [{}], detail: { driver_role: 'พจร.' } })).toBe(true));
  test('no detail at all', () => expect(needsDebtDoc({ items: [] })).toBe(false));
});

describe('needsDebtDoc — BE flag first (needs_debt_doc), fall back to rows/header', () => {
  test('BE says true even when rows say nothing', () =>
    expect(needsDebtDoc({ items: [{ driver_role: 'พจส.' }], needs_debt_doc: true })).toBe(true));
  test('BE says false wins over a พจร. row', () =>
    expect(needsDebtDoc({ items: [{ driver_role: 'พจร.' }], needs_debt_doc: false })).toBe(false));
  test('null / missing flag = compute from rows', () => {
    expect(needsDebtDoc({ items: [{ driver_role: 'พจร.' }], needs_debt_doc: null })).toBe(true);
    expect(needsDebtDoc({ items: [{ driver_role: 'พจส.' }] })).toBe(false);
  });
});

describe('debtDocProblem — ช่องเลขรับสภาพหนี้ 1–50 ตัว', () => {
  test('empty or spaces', () => {
    expect(debtDocProblem('')).toBe('กรุณากรอกเลขรับสภาพหนี้');
    expect(debtDocProblem('   ')).toBe('กรุณากรอกเลขรับสภาพหนี้');
    expect(debtDocProblem(undefined)).toBe('กรุณากรอกเลขรับสภาพหนี้');
  });
  test('over 50 after trimming', () => {
    expect(debtDocProblem('x'.repeat(51))).toBe('เลขยาวเกิน 50 ตัว');
    expect(debtDocProblem(` ${'x'.repeat(50)} `)).toBeNull();
  });
  test('normal number is fine', () => expect(debtDocProblem('DA-2610-001')).toBeNull());
});
