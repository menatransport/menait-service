import { describe, expect, test } from 'bun:test';
import { signatureSlots, splitByTab, stepBadge, stepChainText } from './approvalSteps';

describe('approvalSteps', () => {
  test('chain text only for 2+ steps', () => {
    expect(stepChainText(undefined)).toBeNull();
    expect(stepChainText([{ step: 1, required_level: 4, label: 'หัวหน้าระดับ 4 ขึ้นไป' }])).toBeNull();
    expect(stepChainText([
      { step: 1, required_level: 4, label: 'หัวหน้าระดับ 4 ขึ้นไป' },
      { step: 2, required_level: 5, label: 'ระดับ 5 ขึ้นไป (ข้อ 6.5 · x)' },
    ])).toBe('ขั้น 1: หัวหน้าระดับ 4 ขึ้นไป → ขั้น 2: ระดับ 5 ขึ้นไป (ข้อ 6.5 · x)');
  });
  test('badge degrades without fields', () => {
    expect(stepBadge(undefined, undefined)).toBeNull();
    expect(stepBadge(2, 2)).toBe('ขั้น 2/2');
    expect(stepBadge(1, 1)).toBeNull(); // ขั้นเดียวตาม TOA ไม่ต้องบอกขั้น (21/10/2026)
  });
});

// ไล่ทุกขั้นตาม TOA (ผู้ใช้สั่ง 26/10/2026): ใบพิมพ์มีช่องผู้อนุมัติ 3 ช่อง แต่ใบหนึ่งอาจมี 4–5 ขั้น
describe('signatureSlots', () => {
  const s = (step: number, who: string) => ({ step, who, item: who });
  test('four signers, approved: first = หัวหน้าหน่วยงาน, second = ผู้จัดการ, last = ผู้มีอำนาจอนุมัติ', () => {
    expect(signatureSlots([s(1, 'A'), s(2, 'B'), s(3, 'C'), s(4, 'D')], true))
      .toEqual({ unit_head: 'A', manager: 'B', approver: 'D' });
  });
  test('one person across consecutive steps (skip) signs once', () => {
    expect(signatureSlots([s(1, 'A'), s(2, 'A'), s(3, 'B')], true)).toEqual({ unit_head: 'A', approver: 'B' });
    expect(signatureSlots([s(1, 'A'), s(2, 'A')], true)).toEqual({ approver: 'A' });
  });
  test('still pending: signers so far fill หัวหน้าหน่วยงาน then ผู้จัดการ, approver stays empty', () => {
    expect(signatureSlots([s(1, 'A'), s(2, 'B')], false)).toEqual({ unit_head: 'A', manager: 'B' });
    expect(signatureSlots([s(1, 'A')], false)).toEqual({ unit_head: 'A' });
  });
  test('order comes from the step number, not the list order', () => {
    expect(signatureSlots([s(3, 'C'), s(1, 'A'), s(2, 'B')], true)).toEqual({ unit_head: 'A', manager: 'B', approver: 'C' });
  });
  test('nothing approved yet', () => {
    expect(signatureSlots([], false)).toEqual({});
  });
});

// แท็บรออนุมัติเคลียร์แยก รอฉันอนุมัติ / อนุมัติแทนได้ เหมือนแท็บขอเบิก (ผู้ใช้สั่ง 26/10/2026)
describe('splitByTab', () => {
  test('splits mine and delegable, keeping order', () => {
    const got = splitByTab([
      { form_id: 'A', tab: 'delegable' as const },
      { form_id: 'B', tab: 'mine' as const },
      { form_id: 'C', tab: 'mine' as const },
    ]);
    expect(got.mine.map(i => i.form_id)).toEqual(['B', 'C']);
    expect(got.delegable.map(i => i.form_id)).toEqual(['A']);
  });
  test('an item without tab (older BE) counts as mine', () => {
    const got = splitByTab([{ form_id: 'A' }]);
    expect(got.mine.map(i => i.form_id)).toEqual(['A']);
    expect(got.delegable).toEqual([]);
  });
});
