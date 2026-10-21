import { describe, expect, test } from 'bun:test';
import { approvalHintText, stepBadge, stepChainText } from './approvalSteps';

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
  test('ข้อความสายอนุมัติขั้นเดียว บอกเหตุผลเมื่อระดับสูงกว่า TOA', () => {
    expect(approvalHintText({ required_level: 3, clause: '6.6', approver_label: 'Sup / Asst.M (ระดับ 3–4)' }))
      .toBe('ต้องอนุมัติโดยระดับ 3 ขึ้นไป (ข้อ 6.6 · Sup / Asst.M (ระดับ 3–4))');
    expect(approvalHintText({ required_level: 9, clause: '6.6', approver_label: 'Sup / Asst.M (ระดับ 3–4)' }))
      .toBe('ต้องอนุมัติโดยระดับ 9 ขึ้นไป (ข้อ 6.6 · Sup / Asst.M (ระดับ 3–4) · ต้องสูงกว่าระดับผู้เบิก)');
    expect(approvalHintText({ required_level: 9, clause: '6.2', approver_label: 'CEO (นโยบายระดับ 10 → ระบบใช้ 9)' }))
      .toBe('ต้องอนุมัติโดยระดับ 9 ขึ้นไป (ข้อ 6.2 · CEO (นโยบายระดับ 10 → ระบบใช้ 9))');
  });
});
